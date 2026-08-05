-- =====================================================================
-- Les Brunos — le bulletin des proches, par lien, sans compte.
--
-- CE QUI CHANGE DANS LE JEU
--   Jusqu'ici l'entourage répondait aux MÊMES questions que les joueurs, et
--   son classement était décoratif : `resultRowsFor` figeait `drinks: 0`.
--   Désormais les proches ont leurs propres questions. Ils n'y classent
--   personne : ils notent LEUR joueur de 1 à 10. On moyenne les notes reçues
--   par chaque joueur, on classe les moyennes, et ce classement fait boire.
--
-- POURQUOI DES TABLES SÉPARÉES PLUTÔT QUE `votes` / `vote_answers`
--   Deux raisons dirimantes, pas une préférence de style.
--   1. `votes.participant_id` référence `participants`, dont `user_id` est
--      NOT NULL. Un bulletin sans compte est donc littéralement impossible à
--      écrire dans la table existante.
--   2. `vote_answers` contraint `(vote_id, question_id, rank)` à être unique
--      et `rank >= 1`. Une note n'est pas un rang : deux joueurs peuvent
--      recevoir 7. Réutiliser la colonne marcherait par accident tant qu'un
--      proche ne note qu'une personne, et casserait au premier élargissement.
--
-- LE JETON EST L'AUTHENTIFICATION
--   `edition_entourage.ballot_token` est un uuid v4 non devinable. Les tables
--   ci-dessous ne sont lisibles que par l'administration ; `anon` n'a aucun
--   droit dessus. Tout passe par trois fonctions SECURITY DEFINER qui
--   résolvent le jeton et ne rendent JAMAIS que le bulletin de son porteur.
--   Un proche ne peut donc pas voir les votes des joueurs, ni ceux des autres
--   proches, ni même la liste des nommés au-delà du sien.
-- =====================================================================


-- ---------------------------------------------------------------------
-- (1) Le jeton vit sur l'intention, pas sur le bulletin : l'administration
--     doit pouvoir copier le lien dès qu'elle ajoute le proche, bien avant
--     que celui-ci ait ouvert quoi que ce soit.
-- ---------------------------------------------------------------------
alter table public.edition_entourage
  add column if not exists ballot_token uuid not null default gen_random_uuid();

create unique index if not exists edition_entourage_ballot_token_key
  on public.edition_entourage (ballot_token);

comment on column public.edition_entourage.ballot_token is
  'Secret du lien de bulletin. Le régénérer révoque le lien précédent.';


-- ---------------------------------------------------------------------
-- (2) Les questions réservées à l'entourage portent leur règle en propre.
--
--     Une question entourage est intrinsèquement « la plus haute note cale » :
--     hériter de la règle de l'édition n'aurait aucun sens, et la laisser à
--     null ferait retomber le calcul sur `editions.drink_rule`. On la fixe
--     donc en base, tout en laissant l'administration la changer si elle veut
--     une catégorie où c'est la note la plus BASSE qui trinque.
-- ---------------------------------------------------------------------
-- Le choix unique, lui, n'a JAMAIS eu de choix à offrir. On désigne une seule
-- personne : la faire boire, elle, est la seule conséquence qui ait un sens.
-- Une escalade supposerait un classement des places 2 à N, or ce classement
-- n'existe pas — ce ne sont que des décomptes de voix qui n'ont jamais été
-- demandés. Proposer l'option dans l'interface était une erreur ; on la ferme
-- ici, à la source, pour que ni un import ni le seed ne puissent la rouvrir.
create or replace function public.tg_questions_force_rule()
returns trigger
language plpgsql
as $$
begin
  if new.format = 'entourage'::public.question_format
     and new.drink_rule_override is null then
    new.drink_rule_override := 'ESCALATION_INVERSE'::public.drink_rule;
  end if;

  if new.format = 'single_choice'::public.question_format then
    new.drink_rule_override := 'TOP_UNIQUE'::public.drink_rule;
  end if;

  return new;
end;
$$;

drop trigger if exists questions_default_entourage_rule on public.questions;
drop trigger if exists questions_force_rule on public.questions;
create trigger questions_force_rule
  before insert or update of format, drink_rule_override on public.questions
  for each row execute function public.tg_questions_force_rule();

-- Reprise : les questions à choix unique déjà écrites avec une autre règle.
update public.questions
set drink_rule_override = 'TOP_UNIQUE'::public.drink_rule
where format = 'single_choice'::public.question_format
  and drink_rule_override is distinct from 'TOP_UNIQUE'::public.drink_rule;


-- ---------------------------------------------------------------------
-- (3) Le bulletin d'un proche pour une édition.
--     La clé composite (edition_id, person_id) référence directement
--     `edition_entourage` : un bulletin ne peut donc pas exister pour
--     quelqu'un que l'administration n'a pas déclaré proche de cette soirée.
-- ---------------------------------------------------------------------
create table if not exists public.entourage_ballots (
  id           uuid primary key default gen_random_uuid(),
  edition_id   uuid not null,
  person_id    uuid not null,
  submitted_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint entourage_ballots_edition_person_key unique (edition_id, person_id),
  constraint entourage_ballots_id_edition_key     unique (id, edition_id),
  constraint entourage_ballots_entourage_fk
    foreign key (edition_id, person_id)
    references public.edition_entourage (edition_id, person_id) on delete cascade
);

drop trigger if exists set_updated_at on public.entourage_ballots;
create trigger set_updated_at
  before update on public.entourage_ballots
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- (4) Les notes. Une seule par (bulletin, question) : le proche ne se
--     prononce que sur SON joueur. `player_id` est redondant avec
--     `edition_entourage.linked_player_id` mais rend la donnée lisible seule,
--     et les FK composites interdisent tout mélange d'éditions, exactement
--     comme sur `vote_answers`.
-- ---------------------------------------------------------------------
create table if not exists public.entourage_ratings (
  id          uuid primary key default gen_random_uuid(),
  ballot_id   uuid not null,
  question_id uuid not null,
  player_id   uuid not null,
  edition_id  uuid not null,
  rating      smallint not null check (rating between 1 and 10),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint entourage_ratings_ballot_question_key unique (ballot_id, question_id),
  constraint entourage_ratings_ballot_edition_fk
    foreign key (ballot_id, edition_id)
    references public.entourage_ballots (id, edition_id) on delete cascade,
  constraint entourage_ratings_question_edition_fk
    foreign key (question_id, edition_id)
    references public.questions (id, edition_id) on delete cascade,
  constraint entourage_ratings_player_edition_fk
    foreign key (player_id, edition_id)
    references public.players (id, edition_id) on delete cascade
);

create index if not exists entourage_ratings_question_idx
  on public.entourage_ratings (question_id);

drop trigger if exists set_updated_at on public.entourage_ratings;
create trigger set_updated_at
  before update on public.entourage_ratings
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- (5) RLS : administration seulement.
--     Volontairement aucune politique pour les joueurs. Une note est un avis
--     nominatif d'un conjoint sur son conjoint ; l'exposer ligne à ligne
--     transformerait la soirée en règlement de comptes. Ce que la salle voit,
--     ce sont les MOYENNES figées dans `results`, jamais le détail.
-- ---------------------------------------------------------------------
alter table public.entourage_ballots enable row level security;
alter table public.entourage_ballots force  row level security;
alter table public.entourage_ratings enable row level security;
alter table public.entourage_ratings force  row level security;

drop policy if exists entourage_ballots_admin on public.entourage_ballots;
create policy entourage_ballots_admin on public.entourage_ballots
  for all to authenticated
  using (public.is_admin_of_edition(edition_id))
  with check (public.is_admin_of_edition(edition_id));

drop policy if exists entourage_ratings_admin on public.entourage_ratings;
create policy entourage_ratings_admin on public.entourage_ratings
  for all to authenticated
  using (public.is_admin_of_edition(edition_id))
  with check (public.is_admin_of_edition(edition_id));

grant select, insert, update, delete on public.entourage_ballots to authenticated;
grant select, insert, update, delete on public.entourage_ratings to authenticated;
-- `anon` ne reçoit rien : son seul chemin est les fonctions de la section (7).


-- ---------------------------------------------------------------------
-- (6) La moyenne figée. `borda_score` et `vote_count` ne savent pas
--     représenter une note moyenne ; on lui donne sa colonne.
-- ---------------------------------------------------------------------
alter table public.results
  add column if not exists avg_rating numeric(4,2);

comment on column public.results.avg_rating is
  'Moyenne des notes de l''entourage (questions entourage). Null ailleurs.';


-- ---------------------------------------------------------------------
-- (7) Les trois fonctions du lien. Elles sont le SEUL chemin d'un porteur de
--     jeton vers la base.
-- ---------------------------------------------------------------------

-- 7a. Tout ce qu'il faut pour afficher le bulletin, et rien de plus.
create or replace function public.entourage_ballot_info(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select jsonb_build_object(
    'edition', jsonb_build_object(
      'id',            e.id,
      'name',          e.name,
      'event_at',      e.event_at,
      'vote_deadline', e.vote_deadline,
      'venue_name',    e.venue_name,
      'open',          public.edition_accepts_votes(e.id)
    ),
    'voter', jsonb_build_object(
      'display_name',   pe.display_name,
      'relation_label', ee.relation_label
    ),
    'player', jsonb_build_object(
      'id',           pl.id,
      'display_name', ppe.display_name,
      'headshot_url', ppe.headshot_url
    ),
    'submitted_at', b.submitted_at,
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',     q.id,
          'prompt', q.prompt,
          'rating', (
            select r.rating from public.entourage_ratings r
            where r.ballot_id = b.id and r.question_id = q.id
          )
        ) order by q.position
      )
      from public.questions q
      where q.edition_id = e.id
        and q.format = 'entourage'::public.question_format
    ), '[]'::jsonb)
  )
  from public.edition_entourage ee
  join public.editions e   on e.id   = ee.edition_id
  join public.people   pe  on pe.id  = ee.person_id
  join public.players  pl  on pl.id  = ee.linked_player_id
  join public.people   ppe on ppe.id = pl.person_id
  left join public.entourage_ballots b
    on b.edition_id = ee.edition_id and b.person_id = ee.person_id
  where ee.ballot_token = p_token;
$$;


-- 7b. Brouillon. Idempotent : on remplace l'intégralité des notes du bulletin.
create or replace function public.save_entourage_ratings(p_token uuid, p_ratings jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_edition uuid;
  v_person  uuid;
  v_player  uuid;
  v_ballot  uuid;
begin
  select ee.edition_id, ee.person_id, ee.linked_player_id
    into v_edition, v_person, v_player
  from public.edition_entourage ee
  where ee.ballot_token = p_token;

  if v_edition is null then
    raise exception 'Lien de bulletin invalide.' using errcode = 'no_data_found';
  end if;
  if not public.edition_accepts_votes(v_edition) then
    raise exception 'Le vote n''est pas ouvert.' using errcode = 'check_violation';
  end if;

  insert into public.entourage_ballots (edition_id, person_id)
  values (v_edition, v_person)
  on conflict (edition_id, person_id) do update set updated_at = now()
  returning id into v_ballot;

  if (select submitted_at from public.entourage_ballots where id = v_ballot) is not null then
    raise exception 'Votre bulletin a déjà été envoyé.' using errcode = 'check_violation';
  end if;

  delete from public.entourage_ratings where ballot_id = v_ballot;

  -- `player_id` vient du serveur, jamais du client : un porteur de jeton ne
  -- peut pas noter quelqu'un d'autre que son propre joueur.
  insert into public.entourage_ratings (ballot_id, edition_id, question_id, player_id, rating)
  select v_ballot, v_edition, (r->>'question_id')::uuid, v_player, (r->>'rating')::smallint
  from jsonb_array_elements(p_ratings) as r
  where nullif(r->>'rating', '') is not null
    and exists (
      select 1 from public.questions q
      where q.id = (r->>'question_id')::uuid
        and q.edition_id = v_edition
        and q.format = 'entourage'::public.question_format
    );
end;
$$;


-- 7c. Envoi définitif. Exige que TOUTES les questions entourage soient notées,
--     puis verrouille et prévient l'administration.
create or replace function public.submit_entourage_ballot(p_token uuid, p_ratings jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_edition   uuid;
  v_person    uuid;
  v_ballot    uuid;
  v_expected  int;
  v_answered  int;
  v_name      text;
  v_player    text;
begin
  perform public.save_entourage_ratings(p_token, p_ratings);

  select ee.edition_id, ee.person_id into v_edition, v_person
  from public.edition_entourage ee
  where ee.ballot_token = p_token;

  select b.id into v_ballot
  from public.entourage_ballots b
  where b.edition_id = v_edition and b.person_id = v_person;

  select count(*) into v_expected
  from public.questions q
  where q.edition_id = v_edition
    and q.format = 'entourage'::public.question_format;

  select count(*) into v_answered
  from public.entourage_ratings r
  where r.ballot_id = v_ballot;

  if v_expected = 0 then
    raise exception 'Aucune question n''attend votre avis pour l''instant.'
      using errcode = 'check_violation';
  end if;
  if v_answered < v_expected then
    raise exception 'Il reste % question(s) sans note.', v_expected - v_answered
      using errcode = 'check_violation';
  end if;

  update public.entourage_ballots set submitted_at = now() where id = v_ballot;

  select pe.display_name, ppe.display_name into v_name, v_player
  from public.edition_entourage ee
  join public.people  pe  on pe.id  = ee.person_id
  join public.players pl  on pl.id  = ee.linked_player_id
  join public.people  ppe on ppe.id = pl.person_id
  where ee.edition_id = v_edition and ee.person_id = v_person;

  insert into public.notifications (edition_id, participant_id, kind, message)
  values (
    v_edition, null, 'entourage_vote_submitted',
    coalesce(v_name, 'Un proche') || ' a noté ' || coalesce(v_player, 'son joueur') || '.'
  );
end;
$$;

revoke execute on function public.entourage_ballot_info(uuid)            from public;
revoke execute on function public.save_entourage_ratings(uuid, jsonb)    from public;
revoke execute on function public.submit_entourage_ballot(uuid, jsonb)   from public;

grant execute on function public.entourage_ballot_info(uuid)          to anon, authenticated;
grant execute on function public.save_entourage_ratings(uuid, jsonb)  to anon, authenticated;
grant execute on function public.submit_entourage_ballot(uuid, jsonb) to anon, authenticated;


-- ---------------------------------------------------------------------
-- (8) Étanchéité dans l'autre sens : le bulletin des JOUEURS ne doit jamais
--     contenir de question entourage. L'écran les filtre déjà, mais un
--     client bricolé ne le ferait pas, et une réponse parasite fausserait le
--     classement d'une question sans que rien ne l'indique.
-- ---------------------------------------------------------------------
create or replace function public.submit_ballot(p_edition uuid, p_answers jsonb)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_participant uuid;
  v_vote uuid;
  v_name text;
begin
  v_participant := public.current_participant_id(p_edition);
  if v_participant is null then
    raise exception 'Vous ne participez pas à cette édition.' using errcode = 'check_violation';
  end if;
  if not public.edition_accepts_votes(p_edition) then
    raise exception 'Le vote n''est pas ouvert.' using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_answers) as a
    join public.questions q on q.id = (a->>'question_id')::uuid
    where q.format = 'entourage'::public.question_format
  ) then
    raise exception 'Les questions de l''entourage ne se répondent pas ici.'
      using errcode = 'check_violation';
  end if;

  select id into v_vote
  from public.votes
  where edition_id = p_edition and participant_id = v_participant;

  if v_vote is not null
     and (select submitted_at from public.votes where id = v_vote) is not null then
    raise exception 'Votre vote a déjà été envoyé.' using errcode = 'check_violation';
  end if;

  if v_vote is null then
    insert into public.votes (edition_id, participant_id, submitted_at)
    values (p_edition, v_participant, now())
    returning id into v_vote;
  else
    update public.votes set submitted_at = now() where id = v_vote;
  end if;

  delete from public.vote_answers where vote_id = v_vote;
  insert into public.vote_answers (vote_id, edition_id, question_id, player_id, rank)
  select v_vote, p_edition,
         (a->>'question_id')::uuid, (a->>'player_id')::uuid, (a->>'rank')::int
  from jsonb_array_elements(p_answers) as a;

  select coalesce(pe.display_name, 'Un participant') into v_name
  from public.participants pa
  left join public.people pe on pe.auth_user_id = pa.user_id
  where pa.id = v_participant;

  insert into public.notifications (edition_id, participant_id, kind, message)
  values (p_edition, v_participant, 'vote_submitted',
          coalesce(v_name, 'Un participant') || ' a envoyé son vote.');
end;
$$;
