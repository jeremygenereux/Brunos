-- =====================================================================
-- Backfill d'UNE édition historique — gabarit à copier puis remplir.
--
--   cp template-edition.sql 2024.sql   puis remplace les valeurs en MAJUSCULES.
--
-- Lire supabase/backfill/README.md avant : il liste les pièges (comptes
-- obligatoires pour les votants, réutilisation des `people`, etc.).
--
-- À la fin, l'édition est en COMPILATION. C'est l'interface admin qui la fait
-- passer en LOCKED — et c'est CETTE transition qui calcule et fige `results`.
-- =====================================================================

begin;

-- Les `participants` sont posés à la main ci-dessous avec des id explicites
-- (les `votes` les référencent) : on met l'auto-enrôlement en pause le temps
-- du script, comme le fait supabase/seed.sql.
set local app.skip_autoenroll = 'on';


-- ---------------------------------------------------------------------
-- (1) LES PERSONNES — réutilise l'existant, ne recrée que ce qui manque.
--     Vérifie d'abord :  select id, display_name from public.people order by 1;
-- ---------------------------------------------------------------------
-- insert into public.people (id, display_name) values
--   ('00000000-0000-4000-8000-00000000p001', 'PRÉNOM NOM');


-- ---------------------------------------------------------------------
-- (2) L'ÉDITION.
-- ---------------------------------------------------------------------
insert into public.editions (
  id, name, year, event_at, venue_name, description,
  state, drink_rule, shooter_value
) values (
  'ANNEE0000-0000-4000-8000-000000000001'::uuid,  -- ← id fixe : rejouable
  'Les Brunos ANNÉE',
  2024,                                            -- ← année
  '2024-08-29 19:00:00-04',                        -- ← date de la soirée
  'LIEU',
  null,
  'COMPILATION'::public.edition_state,             -- l'admin fera la suite
  'ESCALATION'::public.drink_rule,                 -- ou 'TOP_UNIQUE'
  8                                                -- gorgées dans un shooter
);


-- ---------------------------------------------------------------------
-- (3) LES NOMMÉS (players) — les choix de réponse. Aucun compte requis.
--     display_order doit être unique dans l'édition ; pas de ON CONFLICT
--     possible sur cette contrainte (elle est deferrable).
-- ---------------------------------------------------------------------
insert into public.players (id, edition_id, person_id, display_order) values
  ('ANNEE0000-0000-4000-8000-0000000001aa'::uuid,
   'ANNEE0000-0000-4000-8000-000000000001'::uuid,
   'PERSON_ID_1'::uuid, 1);
-- , (…, 2), (…, 3) …


-- ---------------------------------------------------------------------
-- (4) LES CATÉGORIES (questions).
--     format : 'ranking' (on classe tout le monde) | 'single_choice'.
--     is_selected_for_show : true = présentée pendant la cérémonie.
-- ---------------------------------------------------------------------
insert into public.questions (
  id, edition_id, prompt, format, show_order, is_selected_for_show
) values
  ('ANNEE0000-0000-4000-8000-0000000002aa'::uuid,
   'ANNEE0000-0000-4000-8000-000000000001'::uuid,
   'ÉNONCÉ DE LA CATÉGORIE',
   'ranking'::public.question_format,
   1, true);


-- ---------------------------------------------------------------------
-- (5) LES VOTANTS (participants).
--     ⚠ user_id est NOT NULL → chaque votant DOIT avoir un compte auth.
--        Récupère les id existants :
--          select u.id, u.email, p.display_name
--          from auth.users u
--          join public.profiles pr on pr.user_id = u.id
--          join public.people p on p.id = pr.person_id;
--        Pour un votant qui n'aura jamais de compte, crée-lui un compte de
--        substitution (voir README).
--     kind 'jury' EXIGE linked_player_id + relation_label ; 'player' exige
--     que les deux soient nuls (contrainte participants_jury_fields_chk).
-- ---------------------------------------------------------------------
insert into public.participants (
  id, edition_id, user_id, kind, linked_player_id, relation_label
) values
  ('ANNEE0000-0000-4000-8000-0000000003aa'::uuid,
   'ANNEE0000-0000-4000-8000-000000000001'::uuid,
   'AUTH_USER_ID'::uuid,
   'player'::public.participant_kind, null, null);
-- Exemple entourage :
--  (…, 'jury'::public.participant_kind, 'PLAYER_ID'::uuid, 'Mère de X');


-- ---------------------------------------------------------------------
-- (6) LES BULLETINS.
--     Un `votes` par (participant, édition), puis ses réponses.
-- ---------------------------------------------------------------------
insert into public.votes (id, edition_id, participant_id) values
  ('ANNEE0000-0000-4000-8000-0000000004aa'::uuid,
   'ANNEE0000-0000-4000-8000-000000000001'::uuid,
   'ANNEE0000-0000-4000-8000-0000000003aa'::uuid);

-- ranking      → une ligne par joueur, rank 1..N (1 = le plus probable).
-- single_choice→ UNE seule ligne, rank = 1.
-- edition_id est rempli par un trigger : ne pas le fournir.
insert into public.vote_answers (vote_id, question_id, player_id, rank) values
  ('ANNEE0000-0000-4000-8000-0000000004aa'::uuid,
   'ANNEE0000-0000-4000-8000-0000000002aa'::uuid,
   'ANNEE0000-0000-4000-8000-0000000001aa'::uuid, 1);


-- ---------------------------------------------------------------------
-- (7) Contrôles avant de valider. Décommente, lis, puis commit ou rollback.
-- ---------------------------------------------------------------------
-- select (select count(*) from public.players      where edition_id = 'ANNEE0000-0000-4000-8000-000000000001') as nommes,
--        (select count(*) from public.questions    where edition_id = 'ANNEE0000-0000-4000-8000-000000000001') as categories,
--        (select count(*) from public.participants where edition_id = 'ANNEE0000-0000-4000-8000-000000000001') as votants,
--        (select count(*) from public.votes        where edition_id = 'ANNEE0000-0000-4000-8000-000000000001') as bulletins,
--        (select count(*) from public.vote_answers where edition_id = 'ANNEE0000-0000-4000-8000-000000000001') as reponses;

commit;
-- rollback;  -- ← pour un essai à blanc

-- ---------------------------------------------------------------------
-- ENSUITE, dans /admin/editions/<id> :
--   « Verrouiller l'édition »  → calcule et FIGE les results
--   « Passer en direct »
--   « Envoyer à l'archive »    → l'édition devient publique dans l'archive
-- ---------------------------------------------------------------------
