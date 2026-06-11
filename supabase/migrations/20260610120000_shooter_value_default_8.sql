-- A shot is worth 8 gorgées by default (was 4). Affects new editions only;
-- existing editions keep their configured value.
alter table public.editions alter column shooter_value set default 8;
