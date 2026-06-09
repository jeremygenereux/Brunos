-- =====================================================================
-- Les Brunos — Admin-configurable shooter value (per edition)
--
-- A "shooter" is worth N gorgées; the exact constant is an admin decision
-- (spec §14 left it open). Stored on the edition so the admin sets it per
-- édition, consumed by the drink-charge / equalizer compute layer.
-- =====================================================================

alter table public.editions
  add column if not exists shooter_value numeric(6, 2) not null default 4;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'editions_shooter_value_positive_chk'
  ) then
    alter table public.editions
      add constraint editions_shooter_value_positive_chk check (shooter_value > 0);
  end if;
end$$;

comment on column public.editions.shooter_value is
  'Gorgées equivalent of one shooter (admin-configurable). Used by the drink-charge compute.';
