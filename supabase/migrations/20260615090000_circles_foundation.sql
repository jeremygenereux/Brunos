-- =====================================================================
-- Les Brunos — Cercles (multi-tenant) : fondation.
--
-- Un CERCLE est un groupe autonome : ses joueurs, ses cérémonies, ses
-- questions, ses statistiques. Rien n'est partagé entre cercles.
--
-- RÈGLE D'IDENTITÉ retenue : une personne appartient à UN SEUL cercle. Si
-- quelqu'un participe à deux cercles, ce sont deux fiches distinctes avec deux
-- courriels distincts. Seule exception, le super-admin : un même compte auth
-- peut porter une fiche PAR cercle (d'où l'unicité de auth_user_id qui devient
-- (circle_id, auth_user_id) au lieu d'être globale), ce qui lui donne des
-- statistiques propres à chaque cercle.
--
-- CE FICHIER pose la structure et les fonctions d'autorisation. Le
-- recâblage des politiques RLS existantes suit dans la migration suivante,
-- pour que chaque étape reste lisible et vérifiable.
-- =====================================================================


-- ---------------------------------------------------------------------
-- (1) Le cercle.
-- ---------------------------------------------------------------------
create table if not exists public.circles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.circles;
create trigger set_updated_at
  before update on public.circles
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- (2) Le rôle de super-admin, et les admins par cercle.
--
-- `profiles.role` reste le rôle GLOBAL du compte ; seul 'super_admin' y a un
-- sens transversal. L'administration d'un cercle donné est une appartenance,
-- pas un rôle : d'où circle_admins.
--
-- La valeur d'enum elle-même est ajoutée par la migration précédente
-- (`20260615085000_user_role_super_admin.sql`) : Postgres refuse qu'on
-- l'emploie dans la transaction qui la crée, et les fonctions ci-dessous
-- l'emploient.
-- ---------------------------------------------------------------------

create table if not exists public.circle_admins (
  circle_id   uuid not null references public.circles (id) on delete cascade,
  user_id     uuid not null references auth.users (id)     on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create index if not exists circle_admins_user_idx on public.circle_admins (user_id);


-- ---------------------------------------------------------------------
-- (3) Rattachement des données existantes.
--     Tout ce qui existe part dans un premier cercle ; la colonne devient
--     obligatoire une fois le remplissage fait.
-- ---------------------------------------------------------------------
alter table public.people    add column if not exists circle_id uuid references public.circles (id) on delete restrict;
alter table public.editions  add column if not exists circle_id uuid references public.circles (id) on delete restrict;

do $$
declare
  v_circle uuid;
begin
  if exists (select 1 from public.people where circle_id is null)
     or exists (select 1 from public.editions where circle_id is null) then
    select id into v_circle from public.circles order by created_at limit 1;
    if v_circle is null then
      insert into public.circles (name) values ('Les Brunos') returning id into v_circle;
    end if;
    update public.people   set circle_id = v_circle where circle_id is null;
    update public.editions set circle_id = v_circle where circle_id is null;
  end if;
end$$;

alter table public.people   alter column circle_id set not null;
alter table public.editions alter column circle_id set not null;

create index if not exists people_circle_idx   on public.people (circle_id);
create index if not exists editions_circle_idx on public.editions (circle_id);

-- Un compte peut désormais porter une fiche par cercle (cas du super-admin).
alter table public.people drop constraint if exists people_auth_user_id_key;
create unique index if not exists people_circle_auth_user_key
  on public.people (circle_id, auth_user_id)
  where auth_user_id is not null;


-- ---------------------------------------------------------------------
-- (4) Fonctions d'autorisation.
--     Toutes SECURITY DEFINER : elles traversent des tables protégées et
--     seraient sinon prises dans la récursion de leurs propres politiques.
-- ---------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'super_admin'::public.user_role
  );
$$;

create or replace function public.is_circle_admin(p_circle uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.is_super_admin()
     or exists (
       select 1 from public.circle_admins ca
       where ca.circle_id = p_circle and ca.user_id = auth.uid()
     );
$$;

create or replace function public.circle_of_edition(p_edition uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select e.circle_id from public.editions e where e.id = p_edition;
$$;

create or replace function public.circle_of_person(p_person uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select pe.circle_id from public.people pe where pe.id = p_person;
$$;

create or replace function public.is_admin_of_edition(p_edition uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.is_circle_admin(public.circle_of_edition(p_edition));
$$;

create or replace function public.is_admin_of_person(p_person uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.is_circle_admin(public.circle_of_person(p_person));
$$;

-- `is_admin()` conserve sa signature (38 politiques l'appellent encore à ce
-- stade) mais change de sens : « administre au moins un cercle ». La migration
-- suivante remplace chaque appel par sa variante cadrée ; ce filet évite toute
-- fenêtre où plus personne ne serait admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.is_super_admin()
     or exists (select 1 from public.circle_admins ca where ca.user_id = auth.uid());
$$;

revoke all on function public.is_super_admin()             from public, anon;
revoke all on function public.is_circle_admin(uuid)        from public, anon;
revoke all on function public.circle_of_edition(uuid)      from public, anon;
revoke all on function public.circle_of_person(uuid)       from public, anon;
revoke all on function public.is_admin_of_edition(uuid)    from public, anon;
revoke all on function public.is_admin_of_person(uuid)     from public, anon;


-- ---------------------------------------------------------------------
-- (5) Reprise des rôles : les admins actuels deviennent super-admins, et
--     administrent le cercle de départ. Sans cela, plus personne n'aurait
--     accès à l'administration après le changement de sens de is_admin().
-- ---------------------------------------------------------------------
insert into public.circle_admins (circle_id, user_id)
select c.id, p.user_id
from public.profiles p
cross join lateral (select id from public.circles order by created_at limit 1) c
where p.role = 'admin'::public.user_role
on conflict do nothing;

update public.profiles
set role = 'super_admin'::public.user_role
where role = 'admin'::public.user_role;


-- ---------------------------------------------------------------------
-- (6) RLS sur les nouvelles tables.
-- ---------------------------------------------------------------------
alter table public.circles       enable row level security;
alter table public.circles       force  row level security;
alter table public.circle_admins enable row level security;
alter table public.circle_admins force  row level security;

drop policy if exists circles_select on public.circles;
create policy circles_select on public.circles
  for select to authenticated
  using (
    public.is_circle_admin(id)
    -- On voit son propre cercle : celui de sa fiche.
    or exists (
      select 1 from public.people pe
      where pe.circle_id = circles.id and pe.auth_user_id = auth.uid()
    )
  );

drop policy if exists circles_write_super on public.circles;
create policy circles_write_super on public.circles
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists circle_admins_select on public.circle_admins;
create policy circle_admins_select on public.circle_admins
  for select to authenticated
  using (public.is_circle_admin(circle_id) or user_id = auth.uid());

drop policy if exists circle_admins_write_super on public.circle_admins;
create policy circle_admins_write_super on public.circle_admins
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
