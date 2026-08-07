-- =====================================================================
-- Les Brunos — l'archive appartient au CERCLE, pas aux seuls participants.
--
-- SYMPTÔME
--   Un joueur qui n'a participé qu'à deux éditions sur trois voyait des
--   statistiques différentes de tout le monde : trophées all-time calculés
--   sur deux galas, compteur « éditions » faux pour chacun, et l'édition
--   manquée absente de l'archive comme si elle n'avait jamais eu lieu.
--
-- CAUSE
--   Les politiques SELECT d'editions / players / results / votes /
--   vote_answers / participants exigeaient is_edition_participant(). Les
--   pages de statistiques calculent côté serveur avec le client RLS du
--   visiteur : chacun recevait donc un sous-ensemble différent des mêmes
--   données, et l'agrégat divergeait en silence.
--
-- DÉCISION PRODUIT (5 août 2026)
--   Une édition ARCHIVÉE est publique pour TOUT le cercle, intégralement :
--   classements, statistiques, et la transparence des bulletins (« qui a
--   voté pour qui »). Avoir manqué un gala ne prive pas de son histoire.
--   Rien ne change pour les états non archivés : le secret du vote reste
--   entier de CONSTRUCTION à LIVE.
-- =====================================================================

-- ---------------------------------------------------------------------
-- (1) L'appartenance au cercle. La fiche `people` du visiteur porte son
--     cercle ; c'est elle qui fait foi, compte ou pas.
-- ---------------------------------------------------------------------
create or replace function public.is_member_of_circle(p_circle uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1 from public.people pe
    where pe.auth_user_id = auth.uid()
      and pe.circle_id = p_circle
  );
$$;

revoke all on function public.is_member_of_circle(uuid) from public, anon;
grant execute on function public.is_member_of_circle(uuid) to authenticated;

-- Le prédicat complet, factorisé : « cette édition est archivée ET elle est
-- de mon cercle ». Une seule définition pour les six politiques, pour que la
-- règle ne puisse pas diverger d'une table à l'autre.
create or replace function public.circle_can_read_archive(p_edition uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.edition_is_archived(p_edition)
     and public.is_member_of_circle(public.circle_of_edition(p_edition));
$$;

revoke all on function public.circle_can_read_archive(uuid) from public, anon;
grant execute on function public.circle_can_read_archive(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- (2) Les six politiques, réécrites en entier. Elles avaient déjà été
--     réécrites dynamiquement par la migration des cercles ; on repart des
--     définitions explicites pour que ce fichier soit la dernière parole.
-- ---------------------------------------------------------------------

drop policy if exists editions_select_participant on public.editions;
create policy editions_select_participant on public.editions
  for select to authenticated
  using (
    public.is_circle_admin(circle_id)
    or public.is_edition_participant(editions.id)
    or (editions.state = 'ARCHIVED'::public.edition_state
        and public.is_member_of_circle(editions.circle_id))
  );

drop policy if exists players_select_participant on public.players;
create policy players_select_participant on public.players
  for select to authenticated
  using (
    public.is_admin_of_edition(players.edition_id)
    or public.is_edition_participant(players.edition_id)
    or public.circle_can_read_archive(players.edition_id)
  );

-- Les questions elles-mêmes : l'archive commence par lire les énoncés retenus
-- pour la soirée, avant même les classements. Sans cette extension, la page
-- restait vide et le trou passait pour un problème de résultats.
drop policy if exists questions_select_participant on public.questions;
create policy questions_select_participant on public.questions
  for select to authenticated
  using (
    public.is_admin_of_edition(edition_id)
    or public.is_edition_participant(edition_id)
    or public.circle_can_read_archive(edition_id)
  );

drop policy if exists results_select_archived_participant on public.results;
create policy results_select_archived_participant on public.results
  for select to authenticated
  using (
    public.is_admin_of_edition(public.edition_of_question(question_id))
    or (
      public.is_edition_participant(public.edition_of_question(question_id))
      and public.edition_is_archived(public.edition_of_question(question_id))
    )
    or public.circle_can_read_archive(public.edition_of_question(question_id))
  );

-- La transparence post-archivage (votes, réponses, liste des votants) suit
-- la même extension : le détail nominatif fait partie de l'archive.
drop policy if exists vote_answers_select_owner_or_admin on public.vote_answers;
create policy vote_answers_select_owner_or_admin on public.vote_answers
  for select to authenticated
  using (
    public.is_admin_of_edition(edition_id)
    or public.vote_belongs_to_caller(vote_id)
    or (public.is_edition_participant(edition_id) and public.edition_is_archived(edition_id))
    or public.circle_can_read_archive(edition_id)
  );

drop policy if exists votes_select_owner_or_admin on public.votes;
create policy votes_select_owner_or_admin on public.votes
  for select to authenticated
  using (
    public.is_admin_of_edition(edition_id)
    or (participant_id = public.current_participant_id(edition_id))
    or (public.is_edition_participant(edition_id) and public.edition_is_archived(edition_id))
    or public.circle_can_read_archive(edition_id)
  );

drop policy if exists participants_select_self_or_admin on public.participants;
create policy participants_select_self_or_admin on public.participants
  for select to authenticated
  using (
    public.is_admin_of_edition(edition_id)
    or (user_id = auth.uid())
    or (public.is_edition_participant(edition_id) and public.edition_is_archived(edition_id))
    or public.circle_can_read_archive(edition_id)
  );

-- Les noms. Sans cette extension, un joueur du cercle verrait le classement
-- d'une édition manquée mais des visages « Sans nom » : la politique people
-- ne montrait que soi-même et les co-nommés.
drop policy if exists people_select_self on public.people;
create policy people_select_self on public.people
  for select to authenticated
  using (
    public.is_circle_admin(circle_id)
    or auth_user_id = auth.uid()
    or public.person_is_edition_nominee_for_caller(people.id)
    or public.is_member_of_circle(people.circle_id)
  );


-- ---------------------------------------------------------------------
-- (3) La fonction qui nomme les votants du dévoilement, alignée sur le
--     même prédicat. Elle gardait l'ancien garde-fou « participant
--     seulement » et aurait rendu une liste vide aux absents du gala.
-- ---------------------------------------------------------------------
create or replace function public.archived_edition_voters(p_edition uuid)
returns table (participant_id uuid, person_id uuid, display_name text, kind text)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select
    pa.id as participant_id,
    pe.id as person_id,
    coalesce(
      pe.display_name,
      pa.relation_label,
      case when pa.kind = 'jury'::public.participant_kind then 'Entourage' else 'Joueur' end
    ) as display_name,
    pa.kind::text as kind
  from public.participants pa
  left join public.people pe on pe.auth_user_id = pa.user_id
  where pa.edition_id = p_edition
    and (
      public.is_admin_of_edition(p_edition)
      or (public.is_edition_participant(p_edition) and public.edition_is_archived(p_edition))
      or public.circle_can_read_archive(p_edition)
    );
$$;
