-- =====================================================================
-- Les Brunos — L'invitation appartient à la PERSONNE, pas au compte.
--
-- SYMPTÔME
--   Un joueur ajouté à une cérémonie n'apparaissait nulle part dans la liste
--   des liens d'invitation : impossible de lui en attribuer un.
--
-- CAUSE
--   `apple_invite_url` vivait sur `participants`, dont `user_id` est NOT NULL.
--   L'auto-inscription ne crée donc une ligne QUE pour les personnes ayant
--   déjà un compte. Un nommé sans compte — le cas le plus courant avant une
--   première cérémonie — n'avait aucune ligne pour porter son lien. Or c'est
--   précisément à ces gens-là qu'il faut envoyer une invitation.
--
-- CORRECTIF
--   Une table d'invitations cadrée sur (cérémonie, personne). Elle couvre les
--   nommés comme l'entourage, avec ou sans compte, puisque `people` est
--   l'annuaire pérenne et ne dépend d'aucune authentification.
-- =====================================================================

create table if not exists public.edition_invites (
  edition_id       uuid not null references public.editions (id) on delete cascade,
  person_id        uuid not null references public.people (id)   on delete cascade,
  apple_invite_url text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (edition_id, person_id)
);

create index if not exists edition_invites_person_idx on public.edition_invites (person_id);

drop trigger if exists set_updated_at on public.edition_invites;
create trigger set_updated_at
  before update on public.edition_invites
  for each row execute function public.set_updated_at();

alter table public.edition_invites enable row level security;
alter table public.edition_invites force row level security;

-- Chacun voit sa propre invitation ; l'administrateur du cercle voit et écrit
-- celles de ses cérémonies.
drop policy if exists edition_invites_select on public.edition_invites;
create policy edition_invites_select on public.edition_invites
  for select to authenticated
  using (
    public.is_admin_of_edition(edition_id)
    or person_id = public.current_person_id()
  );

drop policy if exists edition_invites_write_admin on public.edition_invites;
create policy edition_invites_write_admin on public.edition_invites
  for all to authenticated
  using (public.is_admin_of_edition(edition_id))
  with check (public.is_admin_of_edition(edition_id));

grant select, insert, update, delete on public.edition_invites to authenticated;


-- ---------------------------------------------------------------------
-- Reprise des liens déjà saisis, puis retrait de l'ancienne colonne.
-- ---------------------------------------------------------------------
insert into public.edition_invites (edition_id, person_id, apple_invite_url)
select pa.edition_id, pe.id, pa.apple_invite_url
from public.participants pa
join public.people pe on pe.auth_user_id = pa.user_id
where pa.apple_invite_url is not null
on conflict (edition_id, person_id) do nothing;

-- Le garde-fou d'auto-modification énumérait la colonne : il faut le réécrire
-- AVANT de la supprimer, sinon la fonction casse au premier UPDATE.
create or replace function public.tg_participants_self_update_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if    new.id               is distinct from old.id
     or new.edition_id       is distinct from old.edition_id
     or new.user_id          is distinct from old.user_id
     or new.kind             is distinct from old.kind
     or new.linked_player_id is distinct from old.linked_player_id
     or new.relation_label   is distinct from old.relation_label
  then
    raise exception
      'Self-service updates may only change rsvp; other columns are admin-only.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

alter table public.participants drop column if exists apple_invite_url;
