-- =====================================================================
-- Les Brunos — Distinguer les JOUEURS des PROCHES, et rattacher un proche
-- à une édition donnée.
--
-- PROBLÈME
--   `people` mélangeait tout le monde : les six joueurs et les membres de la
--   famille. Rien n'empêchait donc d'ajouter une belle-mère comme NOMMÉE dans
--   une édition — ce qui n'a aucun sens : on ne vote pas « qui est le plus
--   susceptible de… » sur l'entourage.
--   Symétriquement, il n'existait aucun moyen de dire « cette tante participe
--   à l'édition 2026 » : le seul chemin était le lien d'invitation, où la
--   personne se déclarait elle-même.
--
-- CE QUE FAIT CETTE MIGRATION
--   (1) people.kind — « joueur » ou « proche », sur la fiche pérenne.
--   (2) un garde en base : un proche ne peut pas devenir un nommé.
--   (3) edition_entourage — l'INTENTION de l'admin : « telle personne est
--       l'entourage de tel joueur pour telle édition ».
--   (4) matérialisation automatique en `participants` dès que la personne a
--       un compte, exactement comme l'auto-enrôlement des joueurs.
--
-- POURQUOI UNE TABLE D'INTENTION plutôt que d'écrire directement dans
-- `participants` : `participants.user_id` est NOT NULL, donc impossible à
-- créer tant que la personne n'a pas de compte. L'admin doit pouvoir
-- composer sa tablée AVANT que les invitations soient acceptées ; la ligne
-- `participants` apparaît ensuite toute seule.
-- =====================================================================


-- ---------------------------------------------------------------------
-- (1) La nature d'une personne. On réutilise l'enum participant_kind pour
--     garder un seul vocabulaire dans tout le schéma.
-- ---------------------------------------------------------------------
alter table public.people
  add column if not exists kind public.participant_kind not null default 'player';

comment on column public.people.kind is
  'Joueur (peut être nommé dans une édition) ou proche (entourage, vote mais n''est jamais nommé).';


-- ---------------------------------------------------------------------
-- (2) Un proche ne peut pas être nommé.
--     En base plutôt qu'en UI seule : l'import, le seed et un futur écran
--     passeraient sinon à côté de la règle.
-- ---------------------------------------------------------------------
create or replace function public.tg_players_reject_entourage()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_kind public.participant_kind;
  v_name text;
begin
  select p.kind, p.display_name into v_kind, v_name
  from public.people p where p.id = new.person_id;

  if v_kind = 'jury'::public.participant_kind then
    raise exception
      '% fait partie de l''entourage : un proche ne peut pas être nommé dans une édition. '
      'Ajoute-le plutôt via l''entourage de l''édition.', coalesce(v_name, 'Cette personne')
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists players_reject_entourage on public.players;
create trigger players_reject_entourage
  before insert or update of person_id on public.players
  for each row execute function public.tg_players_reject_entourage();


-- ---------------------------------------------------------------------
-- (3) L'entourage d'une édition — l'intention, indépendante des comptes.
-- ---------------------------------------------------------------------
create table if not exists public.edition_entourage (
  edition_id       uuid not null references public.editions (id) on delete cascade,
  person_id        uuid not null references public.people (id)   on delete cascade,
  linked_player_id uuid not null,
  relation_label   text not null check (length(btrim(relation_label)) > 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (edition_id, person_id),
  -- Clé composite : la BD garantit que le joueur rattaché appartient bien à
  -- CETTE édition (même motif que votes/vote_answers).
  constraint edition_entourage_player_fk
    foreign key (linked_player_id, edition_id)
    references public.players (id, edition_id) on delete cascade
);

create index if not exists edition_entourage_person_idx
  on public.edition_entourage (person_id);

drop trigger if exists set_updated_at on public.edition_entourage;
create trigger set_updated_at
  before update on public.edition_entourage
  for each row execute function public.set_updated_at();

alter table public.edition_entourage enable row level security;
alter table public.edition_entourage force  row level security;

drop policy if exists edition_entourage_select on public.edition_entourage;
create policy edition_entourage_select on public.edition_entourage
  for select to authenticated
  using (public.is_admin() or public.is_edition_participant(edition_id));

drop policy if exists edition_entourage_write_admin on public.edition_entourage;
create policy edition_entourage_write_admin on public.edition_entourage
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---------------------------------------------------------------------
-- (4) Matérialisation en `participants`.
--     On étend autoenroll_person : elle couvre désormais les deux chemins —
--     nommé d'une édition (kind 'player') et entourage déclaré (kind 'jury').
-- ---------------------------------------------------------------------
create or replace function public.autoenroll_person(p_person_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  -- Joueur : toute édition où la personne est nommée.
  insert into public.participants (edition_id, user_id, kind)
  select pl.edition_id, pe.auth_user_id, 'player'::public.participant_kind
  from public.players pl
  join public.people pe on pe.id = pl.person_id
  where pl.person_id = p_person_id
    and pe.auth_user_id is not null
  on conflict (edition_id, user_id) do nothing;

  -- Entourage : toute édition où l'admin l'a déclarée proche d'un joueur.
  insert into public.participants
    (edition_id, user_id, kind, linked_player_id, relation_label)
  select ee.edition_id, pe.auth_user_id, 'jury'::public.participant_kind,
         ee.linked_player_id, ee.relation_label
  from public.edition_entourage ee
  join public.people pe on pe.id = ee.person_id
  where ee.person_id = p_person_id
    and pe.auth_user_id is not null
  on conflict (edition_id, user_id) do nothing;
end;
$$;

revoke all on function public.autoenroll_person(uuid) from public, anon, authenticated;

-- Déclarer un proche l'enrôle aussitôt s'il a déjà un compte.
create or replace function public.tg_entourage_autoenroll()
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

drop trigger if exists entourage_autoenroll on public.edition_entourage;
create trigger entourage_autoenroll
  after insert or update on public.edition_entourage
  for each row execute function public.tg_entourage_autoenroll();


-- ---------------------------------------------------------------------
-- (5) Reprise de l'existant : les participants déjà inscrits comme 'jury'
--     sont, par définition, des proches. On aligne leur fiche et on
--     enregistre leur rattachement pour que l'admin le retrouve à l'écran.
-- ---------------------------------------------------------------------
update public.people pe
set kind = 'jury'::public.participant_kind
where exists (
  select 1 from public.participants pa
  where pa.user_id = pe.auth_user_id
    and pa.kind = 'jury'::public.participant_kind
)
and not exists (
  -- Sécurité : quelqu'un qui a DÉJÀ été nommé quelque part reste un joueur.
  select 1 from public.players pl where pl.person_id = pe.id
);

insert into public.edition_entourage (edition_id, person_id, linked_player_id, relation_label)
select pa.edition_id, pe.id, pa.linked_player_id, pa.relation_label
from public.participants pa
join public.people pe on pe.auth_user_id = pa.user_id
where pa.kind = 'jury'::public.participant_kind
  and pa.linked_player_id is not null
  and pa.relation_label is not null
on conflict (edition_id, person_id) do nothing;
