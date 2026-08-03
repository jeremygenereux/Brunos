-- =====================================================================
-- Les Brunos — Cercles : cloisonnement des politiques RLS.
--
-- La migration précédente a changé le SENS de is_admin() : « administre au
-- moins un cercle ». Tel quel, un admin de Sherbrooke verrait les données de
-- Drummondville. Ce fichier remplace chaque appel par sa variante cadrée sur
-- le cercle de la ligne concernée.
--
-- MÉTHODE : plutôt que de retranscrire 38 politiques à la main (et d'y glisser
-- une erreur), on les recrée à partir de leur définition courante en ne
-- substituant que `is_admin()`. Chaque table sait dire où est son cercle :
--   people            → son propre circle_id
--   editions          → son propre circle_id
--   person_invites    → le cercle de la personne
--   tout le reste     → le cercle de l'édition
--   results           → l'édition passe par la question
--
-- `profiles` est traité à part : il porte le rôle global, et deux de ses
-- politiques ont une sémantique particulière (voir plus bas).
-- =====================================================================

begin;

do $$
declare
  r record;
  v_scope text;
  v_qual text;
  v_check text;
  v_sql text;
begin
  for r in
    select tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename <> 'profiles'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%is_admin()%'
  loop
    v_scope := case r.tablename
      when 'people'            then 'public.is_circle_admin(circle_id)'
      when 'editions'          then 'public.is_circle_admin(circle_id)'
      when 'person_invites'    then 'public.is_admin_of_person(person_id)'
      when 'results'           then 'public.is_admin_of_edition(public.edition_of_question(question_id))'
      else                          'public.is_admin_of_edition(edition_id)'
    end;

    v_qual  := replace(coalesce(r.qual, ''),       'is_admin()', v_scope);
    v_check := replace(coalesce(r.with_check, ''), 'is_admin()', v_scope);

    v_sql := format('drop policy if exists %I on public.%I;', r.policyname, r.tablename);
    execute v_sql;

    v_sql := format('create policy %I on public.%I for %s to authenticated',
                    r.policyname, r.tablename,
                    case r.cmd when 'ALL' then 'all' else lower(r.cmd) end);
    if r.qual is not null then
      v_sql := v_sql || format(' using (%s)', v_qual);
    end if;
    if r.with_check is not null then
      v_sql := v_sql || format(' with check (%s)', v_check);
    end if;
    execute v_sql || ';';
  end loop;
end$$;


-- ---------------------------------------------------------------------
-- profiles — traité à la main.
--
--  • insert_self : la liste noire des rôles auto-attribuables doit inclure
--    'super_admin', sinon n'importe qui se donne les pleins pouvoirs à
--    l'inscription. C'est le trou qu'ouvrait l'ajout de la valeur d'enum.
--  • update_self_no_role_change : le `NOT is_admin()` y signifie « je ne suis
--    pas administrateur », pas « je n'administre pas ce cercle ». On le laisse
--    donc tel quel.
--  • Les autres se cadrent sur le cercle de la personne : un admin de cercle
--    ne touche qu'aux comptes de son cercle.
-- ---------------------------------------------------------------------
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_of_person(person_id));

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (
    public.is_admin_of_person(person_id)
    or (
      user_id = auth.uid()
      and role not in ('admin'::public.user_role, 'super_admin'::public.user_role)
    )
  );

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin_of_person(person_id))
  with check (public.is_admin_of_person(person_id));

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (public.is_admin_of_person(person_id));

-- Seul un super-admin peut créer ou promouvoir un super-admin.
drop policy if exists profiles_no_self_promotion on public.profiles;
create policy profiles_no_self_promotion on public.profiles
  as restrictive
  for update to authenticated
  with check (
    role <> 'super_admin'::public.user_role
    or public.is_super_admin()
  );

commit;
