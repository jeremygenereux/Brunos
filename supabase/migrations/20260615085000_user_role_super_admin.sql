-- =====================================================================
-- Les Brunos — Cercles : le rôle `super_admin`, seul.
--
-- POURQUOI UN FICHIER À PART.
--   PostgreSQL interdit d'UTILISER une valeur d'enum ajoutée dans la même
--   transaction que son ajout (55P04 « unsafe use of new value »). Or la
--   migration `circles_foundation` s'en sert aussitôt, dans ses fonctions
--   d'autorisation. Chaque fichier de migration étant sa propre transaction,
--   isoler l'ALTER TYPE ici garantit qu'il est validé avant tout usage.
--
--   Ne rien ajouter d'autre dans ce fichier : ce serait revenir au problème.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'user_role' and e.enumlabel = 'super_admin'
  ) then
    alter type public.user_role add value 'super_admin';
  end if;
end$$;
