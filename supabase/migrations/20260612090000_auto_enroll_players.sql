-- =====================================================================
-- Les Brunos — Auto-enrôlement des joueurs + rattachement par courriel.
--
-- PROBLÈME RÉSOLU
--   Ajouter quelqu'un à une édition crée une ligne `players` (un nommé, qui
--   n'a pas besoin de compte). Mais la visibilité passe par `participants`
--   (`editions_select_participant`), dont `user_id` est NOT NULL — donc
--   réservée à qui possède un compte. Résultat : le seul chemin était le lien
--   d'invitation `/join/<token>`.
--
-- CE QUE FAIT CETTE MIGRATION
--   (1) person_invites : le courriel d'invitation d'une personne, ADMIN SEUL.
--   (2) autoenroll_person() : rend participante toute personne qui est joueuse
--       dans une édition ET possède un compte.
--   (3) trigger sur players : l'ajout d'un joueur enrôle immédiatement.
--   (4) handle_new_user() v2 : à l'inscription, RÉCLAME la personne pré-créée
--       qui porte ce courriel (au lieu d'en créer une nouvelle), puis enrôle.
--   (5) rattrapage des données existantes.
--
-- CE QUE ÇA NE FAIT PAS
--   L'entourage (`jury`) continue de passer par le lien : lui seul peut
--   déclarer à quel joueur il se rattache et sous quel lien de parenté.
--   L'auto-enrôlement ne crée donc QUE des participants `kind = 'player'`.
-- =====================================================================


-- ---------------------------------------------------------------------
-- (1) person_invites — courriel d'invitation.
--
-- Volontairement HORS de public.people : la policy `people_select_self`
-- laisse tout participant lire les lignes `people` des nommés de son
-- édition. Un courriel posé sur `people` serait donc lisible par toute la
-- tablée. Ici, RLS admin-seul ; les fonctions SECURITY DEFINER ci-dessous
-- (propriété de postgres, BYPASSRLS) y accèdent quand même.
-- ---------------------------------------------------------------------
create table if not exists public.person_invites (
  person_id   uuid primary key references public.people (id) on delete cascade,
  email       text not null
                check (email = lower(btrim(email)) and position('@' in email) > 1),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Un courriel ne peut pointer que vers une seule personne.
create unique index if not exists person_invites_email_key
  on public.person_invites (email);

drop trigger if exists set_updated_at on public.person_invites;
create trigger set_updated_at
  before update on public.person_invites
  for each row execute function public.set_updated_at();

alter table public.person_invites enable row level security;
alter table public.person_invites force  row level security;

drop policy if exists person_invites_all_admin on public.person_invites;
create policy person_invites_all_admin on public.person_invites
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---------------------------------------------------------------------
-- (2) autoenroll_person() — le cœur de l'affaire.
--
-- Pour chaque édition où la personne est joueuse et où elle possède un
-- compte, on crée sa ligne `participants`. Idempotent : `on conflict do
-- nothing` sur (edition_id, user_id). Si la personne s'était déjà inscrite
-- comme `jury` via le lien, sa ligne existante est préservée telle quelle.
-- ---------------------------------------------------------------------
create or replace function public.autoenroll_person(p_person_id uuid)
returns void
language sql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  insert into public.participants (edition_id, user_id, kind)
  select pl.edition_id, pe.auth_user_id, 'player'::public.participant_kind
  from public.players pl
  join public.people pe on pe.id = pl.person_id
  where pl.person_id = p_person_id
    and pe.auth_user_id is not null
  on conflict (edition_id, user_id) do nothing;
$$;

revoke all on function public.autoenroll_person(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- (3) Ajouter un joueur à une édition l'enrôle aussitôt (s'il a un compte).
-- ---------------------------------------------------------------------
-- Échappatoire `app.skip_autoenroll` (même motif que `app.allow_question_edit`) :
-- un script qui pose lui-même ses lignes `participants` avec des id explicites
-- — typiquement supabase/seed.sql, dont les votes référencent ces id — doit
-- pouvoir désactiver l'enrôlement automatique le temps de son exécution.
create or replace function public.tg_players_autoenroll()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if coalesce(current_setting('app.skip_autoenroll', true), '') = 'on' then
    return new;
  end if;
  perform public.autoenroll_person(new.person_id);
  return new;
end;
$$;

drop trigger if exists players_autoenroll on public.players;
create trigger players_autoenroll
  after insert on public.players
  for each row execute function public.tg_players_autoenroll();


-- ---------------------------------------------------------------------
-- (4) handle_new_user() v2 — rattachement par courriel.
--
-- Avant : toute inscription créait une NOUVELLE personne, donc un compte
-- n'était jamais relié au nommé pré-créé par l'admin (deux lignes `people`
-- pour la même personne).
-- Maintenant : si un person_invites porte ce courriel et que la personne
-- visée n'a pas encore de compte, on la réclame. Puis on enrôle.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_person_id uuid;
  v_email     text := lower(btrim(coalesce(new.email, '')));
begin
  -- (a) Rattachement à une personne pré-créée, si l'admin a noté ce courriel.
  if v_email <> '' then
    select pi.person_id
      into v_person_id
    from public.person_invites pi
    join public.people p on p.id = pi.person_id
    where pi.email = v_email
      and p.auth_user_id is null      -- jamais voler une personne déjà reliée
    limit 1;

    if v_person_id is not null then
      update public.people
         set auth_user_id = new.id,
             display_name = coalesce(
               nullif(new.raw_user_meta_data ->> 'display_name', ''),
               display_name
             )
       where id = v_person_id;
    end if;
  end if;

  -- (b) Sinon : comportement d'origine — une nouvelle personne.
  --     Idempotent si le hook re-tire pour un auth user déjà provisionné.
  if v_person_id is null then
    insert into public.people (display_name, auth_user_id)
    values (
      coalesce(
        nullif(new.raw_user_meta_data ->> 'display_name', ''),
        split_part(new.email, '@', 1)
      ),
      new.id
    )
    on conflict (auth_user_id) do update
      set auth_user_id = excluded.auth_user_id
    returning id into v_person_id;
  end if;

  insert into public.profiles (user_id, role, person_id)
  values (new.id, 'player'::public.user_role, v_person_id)
  on conflict (user_id) do nothing;

  -- (c) Enrôlement immédiat dans les éditions où elle est déjà joueuse.
  perform public.autoenroll_person(v_person_id);

  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- (5) Rattrapage — les joueurs déjà en base qui ont un compte deviennent
--     participants sans attendre une nouvelle inscription.
-- ---------------------------------------------------------------------
insert into public.participants (edition_id, user_id, kind)
select pl.edition_id, pe.auth_user_id, 'player'::public.participant_kind
from public.players pl
join public.people pe on pe.id = pl.person_id
where pe.auth_user_id is not null
on conflict (edition_id, user_id) do nothing;
