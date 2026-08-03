-- =====================================================================
-- Les Brunos — Déléguer l'administration d'un cercle.
--
-- Jusqu'ici seul un super-admin pouvait toucher à `circle_admins`. Or un
-- administrateur de cercle doit pouvoir désigner ses pairs — c'est le sens
-- même d'un cercle autonome. Ce qui reste réservé au super-admin, c'est la
-- création et la suppression des cercles eux-mêmes.
--
-- La délégation ne franchit jamais la frontière d'un cercle : `is_circle_admin
-- (circle_id)` s'évalue sur la ligne visée, donc un admin de Sherbrooke ne peut
-- rien écrire dans la liste de Drummondville.
-- =====================================================================

drop policy if exists circle_admins_write_super on public.circle_admins;

drop policy if exists circle_admins_write on public.circle_admins;
create policy circle_admins_write on public.circle_admins
  for all to authenticated
  using (public.is_circle_admin(circle_id))
  with check (public.is_circle_admin(circle_id));

-- Un cercle ne peut pas se retrouver sans administrateur : on refuse le retrait
-- du dernier. Sans ce garde-fou, un cercle deviendrait inadministrable et seul
-- un super-admin pourrait le récupérer.
create or replace function public.tg_circle_admins_keep_one()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.circle_admins
    where circle_id = old.circle_id and user_id <> old.user_id
  ) then
    raise exception
      'Ce cercle n''aurait plus d''administrateur. Désignez son remplaçant avant de le retirer.'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists circle_admins_keep_one on public.circle_admins;
create trigger circle_admins_keep_one
  before delete on public.circle_admins
  for each row execute function public.tg_circle_admins_keep_one();
