-- =====================================================================
-- Les Brunos — l'appartenance à un cercle devient PLURIELLE.
--
-- SYMPTÔME
--   Le super-admin crée un second cercle en production… et n'y figure pas.
--   Son répertoire est vide, impossible de s'y ajouter : `people.circle_id`
--   est une colonne unique, et `people.auth_user_id` aussi — une personne,
--   une fiche, UN cercle. Créer un cercle donnait le droit de l'administrer,
--   jamais celui d'en faire partie.
--
-- CE QUE FAIT CETTE MIGRATION
--   (1) `circle_members (circle_id, person_id)` — l'appartenance, désormais
--       n-à-n. `people.circle_id` reste et devient le cercle D'ORIGINE : il
--       nourrit l'inscription et sert de valeur par défaut, mais ce sont les
--       adhésions qui font foi partout ailleurs.
--   (2) Reprise de l'existant : chaque fiche adhère à son cercle d'origine,
--       et chaque administrateur adhère aux cercles qu'il administre. C'est
--       cette seconde ligne qui répare le symptôme, rétroactivement.
--   (3) Deux déclencheurs entretiennent la table sans intervention :
--       poser un circle_id sur une fiche crée l'adhésion, devenir
--       administrateur d'un cercle aussi. « Je crée un cercle → j'y suis. »
--   (4) Les aides RLS basculent sur les adhésions. `is_member_of_circle()`
--       est le SEUL point qui définissait l'appartenance côté lecture
--       d'archives : les politiques de la migration précédente suivent sans
--       qu'on les touche.
--
-- SEGMENTATION — décision produit (5 août 2026)
--   Chaque cercle a son propre palmarès. Les adhésions ouvrent la LECTURE des
--   archives d'un cercle ; l'agrégation par cercle, elle, se fait côté
--   application (les chargeurs de statistiques prennent un cercle et ne
--   mélangent jamais deux cercles dans un même total).
-- =====================================================================

-- ---------------------------------------------------------------------
-- (1) La table.
-- ---------------------------------------------------------------------
create table if not exists public.circle_members (
  circle_id  uuid not null references public.circles (id) on delete cascade,
  person_id  uuid not null references public.people (id)  on delete cascade,
  created_at timestamptz not null default now(),
  primary key (circle_id, person_id)
);

create index if not exists circle_members_person_idx on public.circle_members (person_id);

alter table public.circle_members enable row level security;
alter table public.circle_members force  row level security;

-- ---------------------------------------------------------------------
-- (2) Reprise de l'existant.
-- ---------------------------------------------------------------------
insert into public.circle_members (circle_id, person_id)
select pe.circle_id, pe.id
from public.people pe
where pe.circle_id is not null
on conflict do nothing;

insert into public.circle_members (circle_id, person_id)
select ca.circle_id, pe.id
from public.circle_admins ca
join public.people pe on pe.auth_user_id = ca.user_id
on conflict do nothing;

-- ---------------------------------------------------------------------
-- (3) Les déclencheurs d'entretien.
-- ---------------------------------------------------------------------
create or replace function public.tg_people_sync_membership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.circle_id is not null then
    insert into public.circle_members (circle_id, person_id)
    values (new.circle_id, new.id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists people_sync_membership on public.people;
create trigger people_sync_membership
  after insert or update of circle_id on public.people
  for each row execute function public.tg_people_sync_membership();

create or replace function public.tg_circle_admins_sync_membership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  insert into public.circle_members (circle_id, person_id)
  select new.circle_id, pe.id
  from public.people pe
  where pe.auth_user_id = new.user_id
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists circle_admins_sync_membership on public.circle_admins;
create trigger circle_admins_sync_membership
  after insert on public.circle_admins
  for each row execute function public.tg_circle_admins_sync_membership();

-- ---------------------------------------------------------------------
-- (4) Les aides RLS basculent sur les adhésions.
-- ---------------------------------------------------------------------

-- L'appartenance du LECTEUR à un cercle. Toutes les politiques d'archives de
-- la migration précédente passent par ici : elles deviennent multi-cercles
-- sans être réécrites.
create or replace function public.is_member_of_circle(p_circle uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.circle_members cm
    join public.people pe on pe.id = cm.person_id
    where cm.circle_id = p_circle
      and pe.auth_user_id = auth.uid()
  );
$$;

-- Administrer UNE PERSONNE = administrer au moins un cercle dont elle est
-- membre. Le repli sur le cercle d'origine couvre les fiches dont l'adhésion
-- n'aurait pas encore été matérialisée.
create or replace function public.is_admin_of_person(p_person uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.is_super_admin()
     or exists (
       select 1
       from public.circle_members cm
       join public.circle_admins ca on ca.circle_id = cm.circle_id
       where cm.person_id = p_person
         and ca.user_id = auth.uid()
     )
     or public.is_circle_admin(public.circle_of_person(p_person));
$$;

-- Deux personnes se « voient » si elles partagent au moins un cercle.
create or replace function public.shares_circle_with_caller(p_person uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.circle_members mine
    join public.people me on me.id = mine.person_id and me.auth_user_id = auth.uid()
    join public.circle_members theirs on theirs.circle_id = mine.circle_id
    where theirs.person_id = p_person
  );
$$;

revoke all on function public.shares_circle_with_caller(uuid) from public, anon;
grant execute on function public.shares_circle_with_caller(uuid) to authenticated;

-- Politiques de la table d'adhésion elle-même : un membre voit la composition
-- de ses cercles, l'administration du cercle la gère.
drop policy if exists circle_members_select on public.circle_members;
create policy circle_members_select on public.circle_members
  for select to authenticated
  using (
    public.is_circle_admin(circle_id)
    or public.is_member_of_circle(circle_id)
  );

drop policy if exists circle_members_write_admin on public.circle_members;
create policy circle_members_write_admin on public.circle_members
  for all to authenticated
  using (public.is_circle_admin(circle_id))
  with check (public.is_circle_admin(circle_id));

grant select, insert, update, delete on public.circle_members to authenticated;

-- On voit un cercle si on en est membre (et non plus seulement si sa fiche y
-- est née) — c'est ce qui fait apparaître le nouveau cercle dans le sélecteur.
drop policy if exists circles_select on public.circles;
create policy circles_select on public.circles
  for select to authenticated
  using (
    public.is_circle_admin(id)
    or public.is_member_of_circle(id)
  );

-- La fiche d'une personne est visible de quiconque partage un cercle avec
-- elle, et de l'administration de N'IMPORTE LEQUEL de ses cercles.
drop policy if exists people_select_self on public.people;
create policy people_select_self on public.people
  for select to authenticated
  using (
    public.is_admin_of_person(people.id)
    or auth_user_id = auth.uid()
    or public.person_is_edition_nominee_for_caller(people.id)
    or public.shares_circle_with_caller(people.id)
  );
