-- =====================================================================
-- Les Brunos — Cercles : réparer l'inscription.
--
-- L'introduction des cercles a cassé handle_new_user() de deux façons :
--   1. il faisait `on conflict (auth_user_id)`, or cette contrainte globale a
--      cédé la place à un index unique (circle_id, auth_user_id) ;
--   2. il crée une fiche `people`, dont circle_id est devenu obligatoire —
--      sans savoir à quel cercle rattacher un nouvel arrivant.
--
-- DÉCISION : circle_id redevient FACULTATIF sur `people`.
--   • Inscription sur invitation (le cas normal) : person_invites désigne une
--     fiche déjà créée par l'admin, donc déjà dans un cercle. Rien à deviner.
--   • Inscription sans invitation : la personne n'est affiliée à rien. Une
--     fiche sans cercle est INVISIBLE des admins de cercle — `is_circle_admin
--     (NULL)` ne vaut jamais vrai — ce qui est le comportement sûr. Un
--     super-admin peut ensuite l'affecter.
-- =====================================================================

alter table public.people alter column circle_id drop not null;

comment on column public.people.circle_id is
  'Cercle d''appartenance. NULL = compte créé sans invitation, pas encore affilié : invisible des admins de cercle.';

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
  -- (a) Rattachement à une fiche pré-créée par l'admin, si ce courriel a été
  --     noté. C'est elle qui porte le cercle.
  if v_email <> '' then
    select pi.person_id
      into v_person_id
    from public.person_invites pi
    join public.people p on p.id = pi.person_id
    where pi.email = v_email
      and p.auth_user_id is null      -- ne jamais voler une fiche déjà reliée
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

  -- (b) Sinon : une fiche neuve, sans cercle tant que personne ne l'affilie.
  --     Idempotent si le hook re-tire pour un compte déjà provisionné : on
  --     réutilise la fiche existante plutôt que d'en créer une seconde.
  if v_person_id is null then
    select p.id into v_person_id
    from public.people p
    where p.auth_user_id = new.id
    limit 1;
  end if;

  if v_person_id is null then
    insert into public.people (display_name, auth_user_id)
    values (
      coalesce(
        nullif(new.raw_user_meta_data ->> 'display_name', ''),
        split_part(new.email, '@', 1)
      ),
      new.id
    )
    returning id into v_person_id;
  end if;

  insert into public.profiles (user_id, role, person_id)
  values (new.id, 'player'::public.user_role, v_person_id)
  on conflict (user_id) do nothing;

  -- (c) Enrôlement dans les cérémonies où cette fiche est déjà attendue.
  perform public.autoenroll_person(v_person_id);

  return new;
end;
$$;
