-- =====================================================================
-- Les Brunos — Initial schema migration (single, dependency-ordered)
-- Postgres / Supabase. Runs top-to-bottom on a fresh project.
-- auth.users and the storage schema are assumed to already exist.
--
-- Dependency order:
--   (1) extensions
--   (2) enum types
--   (3) helper function referenced by table triggers (set_updated_at)
--   (4) tables
--   (5) indexes
--   (6) updated_at triggers + question-edit-lock + handle_new_user
--       + vote_answers edition auto-fill (cross-edition integrity carrier)
--   (7) SECURITY DEFINER RLS helpers (defined AFTER the tables they read,
--       BEFORE the policies that call them)
--   (8) ENABLE/FORCE RLS + all policies (+ participants self-update guard)
--   (9) storage bucket + storage policies
--
-- NOTE ON ORDERING: with check_function_bodies = on (the default), a
-- LANGUAGE sql function body is validated against referenced tables at
-- CREATE time. The cross-table RLS helpers are therefore defined in
-- section (7), after the tables exist, but still before the policies in
-- section (8) that reference them. set_updated_at() touches no tables and
-- is wired into table triggers, so it stays in section (3).
--
-- Idempotent-friendly where reasonable (create-if-not-exists,
-- create-or-replace, do-blocks guarding CREATE TYPE, drop-then-create for
-- policies/triggers).
-- =====================================================================


-- =====================================================================
-- (1) EXTENSIONS
-- =====================================================================
-- gen_random_uuid() is provided by pgcrypto on Supabase.
create extension if not exists pgcrypto;


-- =====================================================================
-- (2) ENUM TYPES
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'player', 'jury');
  end if;
  if not exists (select 1 from pg_type where typname = 'edition_state') then
    create type public.edition_state as enum
      ('CONSTRUCTION', 'SENT_FOR_VOTE', 'COMPILATION', 'LOCKED', 'LIVE', 'ARCHIVED');
  end if;
  if not exists (select 1 from pg_type where typname = 'drink_rule') then
    create type public.drink_rule as enum ('TOP_UNIQUE', 'ESCALATION');
  end if;
  if not exists (select 1 from pg_type where typname = 'question_format') then
    create type public.question_format as enum ('ranking', 'single_choice');
  end if;
  if not exists (select 1 from pg_type where typname = 'rsvp_status') then
    create type public.rsvp_status as enum ('yes', 'no', 'maybe');
  end if;
  if not exists (select 1 from pg_type where typname = 'participant_kind') then
    create type public.participant_kind as enum ('player', 'jury');
  end if;
  if not exists (select 1 from pg_type where typname = 'result_audience') then
    create type public.result_audience as enum ('players', 'jury');
  end if;
end$$;


-- =====================================================================
-- (3) HELPER FUNCTION USED BY TABLE TRIGGERS
--   set_updated_at() references no tables, so it is safe to define before
--   the tables. It is wired into BEFORE UPDATE triggers in section (6).
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- =====================================================================
-- (4) TABLES
-- =====================================================================

-- 4.1 people — persistent human identity across editions.
create table if not exists public.people (
  id            uuid primary key default gen_random_uuid(),
  display_name  text not null check (length(btrim(display_name)) > 0),
  -- nullable: pure nominees may have no auth account.
  auth_user_id  uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint people_auth_user_id_key unique (auth_user_id)
);

-- 4.2 profiles — 1:1 with auth.users, global role.
create table if not exists public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null default 'player',
  -- RESTRICT: a person row carries cross-edition history; don't orphan a live profile.
  person_id   uuid not null references public.people (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_person_id_key unique (person_id)
);

-- 4.3 editions.
create table if not exists public.editions (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(btrim(name)) > 0),
  year           int  not null check (year > 2000),
  event_at       timestamptz,
  venue_name     text,
  venue_address  text,
  description    text,
  state          public.edition_state not null default 'CONSTRUCTION',
  vote_deadline  timestamptz,                      -- RLS gates vote writes on this
  drink_rule     public.drink_rule not null default 'ESCALATION',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 4.4 players — a person's participation in an edition (= an answer choice).
create table if not exists public.players (
  id             uuid primary key default gen_random_uuid(),
  edition_id     uuid not null references public.editions (id) on delete cascade,
  -- RESTRICT: deleting a person who is a nominee would silently drop them as
  -- an answer choice and corrupt ballots; force explicit cleanup.
  person_id      uuid not null references public.people (id) on delete restrict,
  headshot_url   text,
  display_order  int  not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint players_edition_person_key unique (edition_id, person_id),
  constraint players_edition_display_order_key unique (edition_id, display_order)
    deferrable initially deferred,
  -- Composite key so vote_answers can FK (player_id, edition_id) and the DB
  -- proves a ballot row can only reference a player from its own edition.
  constraint players_id_edition_key unique (id, edition_id)
);

-- 4.5 participants — who can vote in an edition, and how.
create table if not exists public.participants (
  id               uuid primary key default gen_random_uuid(),
  edition_id       uuid not null references public.editions (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  kind             public.participant_kind not null,
  -- jury must point at the player they're attached to; players must not.
  linked_player_id uuid references public.players (id) on delete restrict,
  relation_label   text,                          -- e.g. "Mère de Raphaël"
  rsvp             public.rsvp_status,            -- nullable: no response yet
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint participants_edition_user_key unique (edition_id, user_id),
  -- Composite key so votes can FK (participant_id, edition_id) and the DB
  -- proves votes.edition_id always equals the participant's edition.
  constraint participants_id_edition_key unique (id, edition_id),
  constraint participants_jury_fields_chk check (
    (kind = 'jury'
       and linked_player_id is not null
       and relation_label is not null
       and length(btrim(relation_label)) > 0)
    or
    (kind = 'player'
       and linked_player_id is null
       and relation_label is null)
  )
);

-- 4.6 questions.
create table if not exists public.questions (
  id                   uuid primary key default gen_random_uuid(),
  edition_id           uuid not null references public.editions (id) on delete cascade,
  prompt               text not null check (length(btrim(prompt)) > 0),
  format               public.question_format not null,
  position             int  not null default 0,    -- authoring order (drag-and-drop)
  drink_rule_override  public.drink_rule,           -- null = inherit edition.drink_rule
  is_selected_for_show boolean not null default false,
  show_order           int,                          -- presentation order; null until selected
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint questions_edition_position_key unique (edition_id, position)
    deferrable initially deferred,
  constraint questions_edition_show_order_key unique (edition_id, show_order)
    deferrable initially deferred,
  constraint questions_show_order_consistency_chk check (
    (is_selected_for_show = true  and show_order is not null) or
    (is_selected_for_show = false and show_order is null)
  ),
  -- Composite key so vote_answers can FK (question_id, edition_id) and the DB
  -- proves a ballot row can only reference a question from its own edition.
  constraint questions_id_edition_key unique (id, edition_id)
);

-- 4.7 votes — one ballot per (edition, participant).
create table if not exists public.votes (
  id             uuid primary key default gen_random_uuid(),
  edition_id     uuid not null references public.editions (id) on delete cascade,
  participant_id uuid not null,
  submitted_at   timestamptz,                     -- null = draft/in-progress
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint votes_edition_participant_key unique (edition_id, participant_id),
  -- Composite key so vote_answers can FK (vote_id, edition_id).
  constraint votes_id_edition_key unique (id, edition_id),
  -- Composite FK ties the ballot's edition to the participant's edition, so
  -- votes.edition_id is provably equal to the participant's edition even on
  -- service_role (BYPASSRLS) write paths. Replaces the bare participant FK.
  constraint votes_participant_edition_fk
    foreign key (participant_id, edition_id)
    references public.participants (id, edition_id) on delete cascade
);

-- 4.8 vote_answers — one row per (vote, question, ranked player).
--   edition_id is a denormalized carrier so the parent vote, the referenced
--   question, and the referenced player are all FK-tied to the SAME edition
--   (composite FKs below). It is auto-populated from the parent vote by the
--   tg_vote_answers_set_edition trigger (section 6e), so clients never supply
--   it; any value they do supply is overwritten with the vote's edition.
create table if not exists public.vote_answers (
  id          uuid primary key default gen_random_uuid(),
  vote_id     uuid not null,
  question_id uuid not null,
  player_id   uuid not null,
  edition_id  uuid not null,
  -- ranking: 1..N ; single_choice: 1 = chosen.
  rank        int not null check (rank >= 1),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint vote_answers_vote_question_player_key unique (vote_id, question_id, player_id),
  -- A given rank is used at most once per (vote, question).
  constraint vote_answers_vote_question_rank_key unique (vote_id, question_id, rank)
    deferrable initially deferred,
  -- Cross-edition integrity: each parent is tied to the SAME edition_id, so a
  -- ballot row physically cannot mix questions/players/votes across editions.
  -- This holds even for service_role (BYPASSRLS) compute/seed paths.
  constraint vote_answers_vote_edition_fk
    foreign key (vote_id, edition_id)
    references public.votes (id, edition_id) on delete cascade,
  constraint vote_answers_question_edition_fk
    foreign key (question_id, edition_id)
    references public.questions (id, edition_id) on delete cascade,
  constraint vote_answers_player_edition_fk
    foreign key (player_id, edition_id)
    references public.players (id, edition_id) on delete cascade
);

-- 4.9 results — computed snapshot cache (per question, player, audience).
create table if not exists public.results (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  borda_score int,                                 -- ranking aggregate (nullable)
  vote_count  int,                                 -- single_choice aggregate (nullable)
  final_rank  int not null check (final_rank >= 1),
  drinks      numeric(6,2) not null default 0 check (drinks >= 0),
  audience    public.result_audience not null,     -- official vs entourage ranking
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint results_question_player_audience_key unique (question_id, player_id, audience)
);


-- =====================================================================
-- (5) INDEXES
-- =====================================================================
create index if not exists people_auth_user_id_idx on public.people (auth_user_id);

create index if not exists profiles_person_id_idx on public.profiles (person_id);
create index if not exists profiles_role_idx      on public.profiles (role);

create index if not exists editions_state_idx    on public.editions (state);
create index if not exists editions_year_idx     on public.editions (year);
create index if not exists editions_event_at_idx on public.editions (event_at);

create index if not exists players_edition_id_idx on public.players (edition_id);
create index if not exists players_person_id_idx  on public.players (person_id);

create index if not exists participants_edition_id_idx       on public.participants (edition_id);
create index if not exists participants_user_id_idx          on public.participants (user_id);
create index if not exists participants_linked_player_id_idx on public.participants (linked_player_id);
create index if not exists participants_kind_idx             on public.participants (edition_id, kind);

create index if not exists questions_edition_id_idx       on public.questions (edition_id);
create index if not exists questions_edition_selected_idx on public.questions (edition_id, is_selected_for_show);

create index if not exists votes_edition_id_idx     on public.votes (edition_id);
create index if not exists votes_participant_id_idx on public.votes (participant_id);
create index if not exists votes_submitted_at_idx   on public.votes (submitted_at);

create index if not exists vote_answers_vote_id_idx        on public.vote_answers (vote_id);
create index if not exists vote_answers_question_id_idx    on public.vote_answers (question_id);
create index if not exists vote_answers_player_id_idx      on public.vote_answers (player_id);
-- Supports the composite FKs (player_id/question_id/vote_id, edition_id) and
-- cascade deletes that fan out from editions/questions/players by edition_id.
create index if not exists vote_answers_edition_id_idx     on public.vote_answers (edition_id);
-- Fast aggregation per question across all ballots.
create index if not exists vote_answers_question_player_idx on public.vote_answers (question_id, player_id);

create index if not exists results_question_id_idx       on public.results (question_id);
create index if not exists results_player_id_idx         on public.results (player_id);
create index if not exists results_question_audience_idx on public.results (question_id, audience);


-- =====================================================================
-- (6) TRIGGERS — updated_at bumpers + question-edit lock + new-user hook
-- =====================================================================

-- 6a. updated_at: attach the bumper to every table.
--     (vote_answers / results are append/recompute caches but still carry
--      updated_at here, so we bump them too — harmless and consistent.)
do $$
declare
  t text;
begin
  foreach t in array array[
    'people','profiles','editions','players','participants',
    'questions','votes','vote_answers','results'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at
         before update on public.%I
         for each row execute function public.set_updated_at();', t);
  end loop;
end$$;

-- 6b. Question-edit lock (spec §4/§5.3): once an edition leaves
--     CONSTRUCTION, questions are structurally frozen. Two escape hatches:
--       (a) a transaction-local override GUC app.allow_question_edit='on'
--           set only by trusted admin server code (after the two-step
--           confirm that wipes dependent answers), or
--       (b) an UPDATE that touches ONLY the curation columns
--           (is_selected_for_show, show_order) — the equalizer needs these
--           in COMPILATION/LOCKED and they are not "structural".
--     SECURITY DEFINER so it can read editions.state regardless of RLS.
--     PL/pgSQL body => not validated against tables at CREATE time, so it
--     may safely reference public.editions defined above.
create or replace function public.tg_questions_edit_lock()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_state         public.edition_state;
  v_edition       uuid;
  v_override      boolean;
  v_only_curation boolean;
begin
  v_edition := coalesce(new.edition_id, old.edition_id);

  select e.state into v_state
  from public.editions e
  where e.id = v_edition;

  -- In CONSTRUCTION everything is permitted.
  if v_state = 'CONSTRUCTION'::public.edition_state then
    return coalesce(new, old);
  end if;

  -- Transaction-local override (set by trusted admin server code only).
  v_override := coalesce(
    nullif(current_setting('app.allow_question_edit', true), ''),
    'off'
  ) = 'on';

  if v_override then
    return coalesce(new, old);
  end if;

  -- Outside CONSTRUCTION and without override: permit ONLY curation-column
  -- UPDATEs. INSERT and DELETE of questions are structural -> blocked.
  if tg_op = 'UPDATE' then
    v_only_curation :=
          new.edition_id          is not distinct from old.edition_id
      and new.prompt              is not distinct from old.prompt
      and new.format              is not distinct from old.format
      and new.position            is not distinct from old.position
      and new.drink_rule_override is not distinct from old.drink_rule_override;
    if v_only_curation then
      return new;   -- is_selected_for_show / show_order may change freely
    end if;
  end if;

  raise exception
    'Questions are locked: edition % is in state % (not CONSTRUCTION). '
    'Structural edits require the two-step admin override that wipes '
    'associated answers (set_config(''app.allow_question_edit'',''on'',true)).',
    v_edition, v_state
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists questions_edit_lock on public.questions;
create trigger questions_edit_lock
  before insert or update or delete on public.questions
  for each row execute function public.tg_questions_edit_lock();

-- 6c. Admin-only RPC performing the destructive structural unlock the
--     right way: verify admin, require explicit confirmation, wipe the now
--     invalid vote_answers + votes for the edition, then flip the
--     transaction-local override so the caller's subsequent UPDATE/DELETE
--     in the SAME transaction is permitted. Call inside one transaction.
--     (References public.is_admin(), defined in section (7); resolved at
--      call time, not at CREATE time, so order is fine.)
create or replace function public.admin_unlock_questions(
  p_edition uuid,
  p_confirm boolean default false
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin may unlock questions'
      using errcode = 'insufficient_privilege';
  end if;
  if p_confirm is not true then
    raise exception 'Refusing to wipe answers without explicit confirmation (p_confirm=true)'
      using errcode = 'check_violation';
  end if;

  -- Destroy answers + ballots tied to this edition (now invalid).
  delete from public.vote_answers va
  using public.votes v
  where va.vote_id = v.id
    and v.edition_id = p_edition;

  delete from public.votes v
  where v.edition_id = p_edition;

  -- Transaction-local: only THIS transaction can now restructure questions.
  perform set_config('app.allow_question_edit', 'on', true);
end;
$$;

-- 6d. handle_new_user(): auto-create a people + 1:1 profile row on signup.
--     Default role 'player'. SECURITY DEFINER because it writes public
--     tables in response to an auth.users insert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_person_id uuid;
begin
  -- Idempotent: if the hook re-fires for an already-provisioned auth user
  -- (admin re-provision, manual backfill, re-insert of the auth row), reuse
  -- the existing person instead of raising unique_violation on auth_user_id.
  -- The no-op update lets RETURNING yield the existing row's id, so
  -- v_person_id is always populated and the profiles insert below is reached.
  insert into public.people (display_name, auth_user_id)
  values (
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(new.email, '@', 1)
    ),
    new.id
  )
  on conflict (auth_user_id) do update
    set auth_user_id = excluded.auth_user_id
  returning id into v_person_id;

  insert into public.profiles (user_id, role, person_id)
  values (new.id, 'player'::public.user_role, v_person_id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6e. vote_answers.edition_id auto-fill: always derive edition_id from the
--     parent vote, regardless of what the client/service_role supplied. This
--     keeps the denormalized carrier authoritative; the composite FKs in
--     section (4.8) then guarantee question + player belong to that same
--     edition. Runs BEFORE the row is checked, so RLS WITH CHECK and the FKs
--     see the corrected value. SECURITY DEFINER so it can read votes even
--     under FORCE RLS. PL/pgSQL => body not validated against tables at
--     CREATE time (votes already exists here anyway).
create or replace function public.tg_vote_answers_set_edition()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_edition uuid;
begin
  select v.edition_id into v_edition
  from public.votes v
  where v.id = new.vote_id;

  if v_edition is null then
    raise exception 'vote_answers.vote_id % does not reference an existing vote', new.vote_id
      using errcode = 'foreign_key_violation';
  end if;

  new.edition_id := v_edition;
  return new;
end;
$$;

drop trigger if exists vote_answers_set_edition on public.vote_answers;
create trigger vote_answers_set_edition
  before insert or update on public.vote_answers
  for each row execute function public.tg_vote_answers_set_edition();


-- =====================================================================
-- (7) SECURITY DEFINER RLS HELPERS
--   Defined AFTER the tables they read (so LANGUAGE sql bodies validate)
--   and BEFORE the policies that call them. These read RLS-protected
--   tables as the function owner (postgres, which bypasses RLS), so a
--   policy that calls them never re-enters the calling table's own
--   policies => no policy recursion. Each pins search_path; EXECUTE is
--   revoked from PUBLIC and granted to authenticated.
-- =====================================================================

-- 7a-i. user_role(): the caller's global role, or NULL if no profile.
create or replace function public.user_role()
returns public.user_role
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select p.role
  from public.profiles p
  where p.user_id = auth.uid();
$$;

-- 7a-ii. is_admin(): true iff the caller's profile role = 'admin'.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'::public.user_role
  );
$$;

-- 7a-iii. is_edition_participant(p_edition): true iff caller has a
--         participants row for this edition. Admin is intentionally NOT
--         short-circuited here; compose with is_admin() in policies.
create or replace function public.is_edition_participant(p_edition uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.participants pa
    where pa.edition_id = p_edition
      and pa.user_id = auth.uid()
  );
$$;

-- 7a-iv. current_participant_id(p_edition): caller's participants.id for
--        this edition, or NULL. (NULL never equals a real participant_id,
--        so a non-participant is denied by the equality test in policies.)
create or replace function public.current_participant_id(p_edition uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select pa.id
  from public.participants pa
  where pa.edition_id = p_edition
    and pa.user_id = auth.uid()
  limit 1;
$$;

-- 7a-v. edition_accepts_votes(p_edition): the ballot write window —
--       state = SENT_FOR_VOTE AND (deadline NULL OR now() < deadline).
create or replace function public.edition_accepts_votes(p_edition uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.editions e
    where e.id = p_edition
      and e.state = 'SENT_FOR_VOTE'::public.edition_state
      and (e.vote_deadline is null or now() < e.vote_deadline)
  );
$$;

-- 7a-vi. edition_is_archived(p_edition): true iff state = ARCHIVED.
create or replace function public.edition_is_archived(p_edition uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.editions e
    where e.id = p_edition
      and e.state = 'ARCHIVED'::public.edition_state
  );
$$;

-- 7a-vii. edition_of_question(p_question): the question's edition_id. Lets
--         results policies resolve edition context without touching
--         questions' RLS.
create or replace function public.edition_of_question(p_question uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select q.edition_id
  from public.questions q
  where q.id = p_question;
$$;

-- 7a-viii. vote_belongs_to_caller(p_vote): true iff the parent votes row
--          belongs to the caller. DEFINER read of votes (+participants),
--          so vote_answers policies never invoke votes' policies.
create or replace function public.vote_belongs_to_caller(p_vote uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.votes v
    join public.participants pa on pa.id = v.participant_id
    where v.id = p_vote
      and pa.user_id = auth.uid()
  );
$$;

-- 7a-ix. vote_is_in_open_window(p_vote): resolves the vote's edition and
--        returns edition_accepts_votes(edition_id). Write window for the
--        child vote_answers rows.
create or replace function public.vote_is_in_open_window(p_vote uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select coalesce(
    (select public.edition_accepts_votes(v.edition_id)
       from public.votes v
       where v.id = p_vote),
    false
  );
$$;

-- 7a-x. vote_answer_is_consistent(p_vote, p_question, p_player): true iff the
--       question AND the player both belong to the SAME edition as the parent
--       vote. Defense-in-depth at the RLS layer for the vote_answers write
--       policies — the composite FKs in (4.8) already make a cross-edition
--       ballot row physically impossible, but this rejects it earlier with a
--       policy error instead of an FK error and documents the invariant.
create or replace function public.vote_answer_is_consistent(
  p_vote uuid, p_question uuid, p_player uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.votes v
    join public.questions q on q.id = p_question and q.edition_id = v.edition_id
    join public.players  pl on pl.id = p_player   and pl.edition_id = v.edition_id
    where v.id = p_vote
  );
$$;

-- 7a-xi. current_person_id(): the caller's profiles.person_id, or NULL. Used
--        to pin person_id in the non-admin profiles self-update so a user
--        cannot re-point their account at another human's identity.
create or replace function public.current_person_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select p.person_id
  from public.profiles p
  where p.user_id = auth.uid();
$$;

-- 7a-xii. person_is_edition_nominee_for_caller(p_person): true iff the person
--         is a nominee (players row) in some edition the caller participates
--         in. Replaces the inline EXISTS-against-players subquery formerly in
--         people_select_self, so that read no longer re-enters players' own
--         RLS (keeps the "no policy queries a protected table directly"
--         invariant and removes a latent recursion risk).
create or replace function public.person_is_edition_nominee_for_caller(p_person uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select exists (
    select 1
    from public.players pl
    where pl.person_id = p_person
      and public.is_edition_participant(pl.edition_id)
  );
$$;

-- 7b. Lock down EXECUTE on every SECURITY DEFINER function: revoke from
--     PUBLIC, grant only to authenticated. (anon has no profile/participant
--     row, so the helpers return NULL/false for anon anyway.)
revoke execute on function public.user_role()                       from public;
revoke execute on function public.is_admin()                        from public;
revoke execute on function public.is_edition_participant(uuid)      from public;
revoke execute on function public.current_participant_id(uuid)      from public;
revoke execute on function public.edition_accepts_votes(uuid)       from public;
revoke execute on function public.edition_is_archived(uuid)         from public;
revoke execute on function public.edition_of_question(uuid)         from public;
revoke execute on function public.vote_belongs_to_caller(uuid)      from public;
revoke execute on function public.vote_is_in_open_window(uuid)      from public;
revoke execute on function public.vote_answer_is_consistent(uuid, uuid, uuid) from public;
revoke execute on function public.current_person_id()              from public;
revoke execute on function public.person_is_edition_nominee_for_caller(uuid) from public;
revoke execute on function public.admin_unlock_questions(uuid, boolean) from public;

grant execute on function public.user_role()                       to authenticated;
grant execute on function public.is_admin()                        to authenticated;
grant execute on function public.is_edition_participant(uuid)      to authenticated;
grant execute on function public.current_participant_id(uuid)      to authenticated;
grant execute on function public.edition_accepts_votes(uuid)       to authenticated;
grant execute on function public.edition_is_archived(uuid)         to authenticated;
grant execute on function public.edition_of_question(uuid)         to authenticated;
grant execute on function public.vote_belongs_to_caller(uuid)      to authenticated;
grant execute on function public.vote_is_in_open_window(uuid)      to authenticated;
grant execute on function public.vote_answer_is_consistent(uuid, uuid, uuid) to authenticated;
grant execute on function public.current_person_id()              to authenticated;
grant execute on function public.person_is_edition_nominee_for_caller(uuid) to authenticated;
grant execute on function public.admin_unlock_questions(uuid, boolean) to authenticated;


-- =====================================================================
-- (8) ROW LEVEL SECURITY — ENABLE + FORCE + POLICIES
--
-- FORCE so the table owner is not exempt. Supabase service_role is
-- BYPASSRLS and still bypasses these — intended for compute/admin server
-- paths (Borda aggregation, equalizer, results snapshot). Policies govern
-- the anon/authenticated end-user paths only; anon gets nothing on app
-- tables (no anon policies => deny).
--
-- Recursion safety: every cross-table / same-table-context predicate is
-- routed through a SECURITY DEFINER helper from section (7), so no policy
-- re-queries its OWN RLS-protected table.
-- =====================================================================

alter table public.people        enable row level security;
alter table public.people        force  row level security;
alter table public.profiles      enable row level security;
alter table public.profiles      force  row level security;
alter table public.editions      enable row level security;
alter table public.editions      force  row level security;
alter table public.players       enable row level security;
alter table public.players       force  row level security;
alter table public.participants  enable row level security;
alter table public.participants  force  row level security;
alter table public.questions     enable row level security;
alter table public.questions     force  row level security;
alter table public.votes         enable row level security;
alter table public.votes         force  row level security;
alter table public.vote_answers  enable row level security;
alter table public.vote_answers  force  row level security;
alter table public.results       enable row level security;
alter table public.results       force  row level security;

-- ---------------------------------------------------------------------
-- 8.1 people
--   Read: own person row; participants of an edition see the people behind
--         that edition's players (to render ballots/cards); admin all.
--   Write: admin only.
-- ---------------------------------------------------------------------
drop policy if exists people_select_self  on public.people;
drop policy if exists people_insert_admin on public.people;
drop policy if exists people_update_admin on public.people;
drop policy if exists people_delete_admin on public.people;

create policy people_select_self on public.people
  for select to authenticated
  using (
    public.is_admin()
    or auth_user_id = auth.uid()
    -- Routed through a DEFINER helper so this read does not re-enter players'
    -- own RLS (consistent with every other cross-table predicate here).
    or public.person_is_edition_nominee_for_caller(people.id)
  );

create policy people_insert_admin on public.people
  for insert to authenticated
  with check (public.is_admin());

create policy people_update_admin on public.people
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy people_delete_admin on public.people
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- 8.2 profiles
--   Read: own row + admin.
--   Insert: own row only and NOT as admin (no self-promotion); admin any.
--   Update: non-admin self-update may not change role/person_id (both pinned
--           via DEFINER helpers); admin may update any row.
--   Delete: admin only.
-- ---------------------------------------------------------------------
drop policy if exists profiles_select_self_or_admin       on public.profiles;
drop policy if exists profiles_insert_self                on public.profiles;
drop policy if exists profiles_update_self_no_role_change on public.profiles;
drop policy if exists profiles_update_admin               on public.profiles;
drop policy if exists profiles_delete_admin               on public.profiles;

create policy profiles_select_self_or_admin on public.profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
  );

create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      user_id = auth.uid()
      and role <> 'admin'::public.user_role     -- nobody self-provisions as admin
    )
  );

-- Non-admin self-update cannot change role OR person_id: the submitted values
-- must still equal what is currently stored, read via DEFINER helpers
-- user_role() / current_person_id() (no same-table subselect, so zero
-- recursion ambiguity). Pinning person_id stops a user from re-pointing their
-- account at another human's persistent identity (cross-edition stats hijack).
create policy profiles_update_self_no_role_change on public.profiles
  for update to authenticated
  using (user_id = auth.uid() and not public.is_admin())
  with check (
    user_id = auth.uid()
    and role = public.user_role()
    and person_id = public.current_person_id()
  );

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- 8.3 editions
--   Read: participants of that edition + admin. Write: admin only.
-- ---------------------------------------------------------------------
drop policy if exists editions_select_participant on public.editions;
drop policy if exists editions_insert_admin       on public.editions;
drop policy if exists editions_update_admin       on public.editions;
drop policy if exists editions_delete_admin       on public.editions;

create policy editions_select_participant on public.editions
  for select to authenticated
  using (
    public.is_admin()
    or public.is_edition_participant(editions.id)
  );

create policy editions_insert_admin on public.editions
  for insert to authenticated
  with check (public.is_admin());

create policy editions_update_admin on public.editions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy editions_delete_admin on public.editions
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- 8.4 players (the answer choices)
--   Read: participants of the edition + admin. Write: admin only.
-- ---------------------------------------------------------------------
drop policy if exists players_select_participant on public.players;
drop policy if exists players_insert_admin       on public.players;
drop policy if exists players_update_admin       on public.players;
drop policy if exists players_delete_admin       on public.players;

create policy players_select_participant on public.players
  for select to authenticated
  using (
    public.is_admin()
    or public.is_edition_participant(players.edition_id)
  );

create policy players_insert_admin on public.players
  for insert to authenticated
  with check (public.is_admin());

create policy players_update_admin on public.players
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy players_delete_admin on public.players
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- 8.5 participants
--   Read: own row + admin.
--   Insert/Delete: admin only.
--   Update: admin (any), plus a self-update for own row (RSVP self-service,
--           spec §5.1). Column-level guarding of the self-update (only rsvp
--           may change) is enforced by the trigger below, since RLS cannot
--           compare to OLD values.
-- ---------------------------------------------------------------------
drop policy if exists participants_select_self_or_admin on public.participants;
drop policy if exists participants_insert_admin         on public.participants;
drop policy if exists participants_update_admin         on public.participants;
drop policy if exists participants_update_own_rsvp      on public.participants;
drop policy if exists participants_delete_admin         on public.participants;

create policy participants_select_self_or_admin on public.participants
  for select to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
  );

create policy participants_insert_admin on public.participants
  for insert to authenticated
  with check (public.is_admin());

create policy participants_update_admin on public.participants
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Self-service: a participant may PATCH their own row (RSVP). The trigger
-- participants_self_update_guard restricts non-admin self-updates to the
-- rsvp column only.
create policy participants_update_own_rsvp on public.participants
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy participants_delete_admin on public.participants
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- 8.6 questions
--   Read: participants of the edition + admin. Write: admin only (RLS);
--         structural immutability after CONSTRUCTION enforced by the
--         questions_edit_lock trigger from section (6).
-- ---------------------------------------------------------------------
drop policy if exists questions_select_participant on public.questions;
drop policy if exists questions_insert_admin       on public.questions;
drop policy if exists questions_update_admin       on public.questions;
drop policy if exists questions_delete_admin       on public.questions;

create policy questions_select_participant on public.questions
  for select to authenticated
  using (
    public.is_admin()
    or public.is_edition_participant(questions.edition_id)
  );

create policy questions_insert_admin on public.questions
  for insert to authenticated
  with check (public.is_admin());

create policy questions_update_admin on public.questions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy questions_delete_admin on public.questions
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- 8.7 votes (one ballot per participant per edition)
--   Read: owner + admin. NEVER another voter's ballot (secrecy total to
--         non-admins, in every state including ARCHIVED).
--   Insert/Update/Delete: owner, only while edition accepts votes.
--   Delete: admin anytime (separate policy).
-- ---------------------------------------------------------------------
drop policy if exists votes_select_owner_or_admin on public.votes;
drop policy if exists votes_insert_owner_open      on public.votes;
drop policy if exists votes_update_owner_open      on public.votes;
drop policy if exists votes_delete_owner_open      on public.votes;
drop policy if exists votes_delete_admin           on public.votes;

create policy votes_select_owner_or_admin on public.votes
  for select to authenticated
  using (
    public.is_admin()
    or participant_id = public.current_participant_id(votes.edition_id)
  );

create policy votes_insert_owner_open on public.votes
  for insert to authenticated
  with check (
    participant_id = public.current_participant_id(edition_id)
    and public.edition_accepts_votes(edition_id)
  );

create policy votes_update_owner_open on public.votes
  for update to authenticated
  using (
    participant_id = public.current_participant_id(votes.edition_id)
    and public.edition_accepts_votes(votes.edition_id)
  )
  with check (
    participant_id = public.current_participant_id(edition_id)
    and public.edition_accepts_votes(edition_id)
  );

create policy votes_delete_owner_open on public.votes
  for delete to authenticated
  using (
    participant_id = public.current_participant_id(votes.edition_id)
    and public.edition_accepts_votes(votes.edition_id)
  );

create policy votes_delete_admin on public.votes
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- 8.8 vote_answers (the secret payload — strictest table)
--   Ownership resolved through DEFINER helpers so vote_answers policies
--   never trigger votes' policies.
--   Read: owner + admin (no archive exception — raw answers stay private).
--   Insert/Update/Delete: owner, only while the edition accepts votes.
--   Insert/Update additionally require question + player to belong to the
--   SAME edition as the parent vote (cross-edition ballot injection guard).
-- ---------------------------------------------------------------------
drop policy if exists vote_answers_select_owner_or_admin on public.vote_answers;
drop policy if exists vote_answers_insert_owner_open      on public.vote_answers;
drop policy if exists vote_answers_update_owner_open      on public.vote_answers;
drop policy if exists vote_answers_delete_owner_open      on public.vote_answers;

create policy vote_answers_select_owner_or_admin on public.vote_answers
  for select to authenticated
  using (
    public.is_admin()
    or public.vote_belongs_to_caller(vote_id)
  );

create policy vote_answers_insert_owner_open on public.vote_answers
  for insert to authenticated
  with check (
    public.vote_belongs_to_caller(vote_id)
    and public.vote_is_in_open_window(vote_id)
    -- question + player must belong to the SAME edition as the parent vote,
    -- so a participant of one open edition cannot cast ballot rows against a
    -- different edition's questions/players (cross-edition ballot injection).
    and public.vote_answer_is_consistent(vote_id, question_id, player_id)
  );

create policy vote_answers_update_owner_open on public.vote_answers
  for update to authenticated
  using (
    public.vote_belongs_to_caller(vote_id)
    and public.vote_is_in_open_window(vote_id)
  )
  with check (
    public.vote_belongs_to_caller(vote_id)
    and public.vote_is_in_open_window(vote_id)
    and public.vote_answer_is_consistent(vote_id, question_id, player_id)
  );

create policy vote_answers_delete_owner_open on public.vote_answers
  for delete to authenticated
  using (
    public.vote_belongs_to_caller(vote_id)
    and public.vote_is_in_open_window(vote_id)
  );

-- ---------------------------------------------------------------------
-- 8.9 results (computed snapshot cache)
--   Read: participants of the result's edition ONLY once ARCHIVED; admin
--         anytime. Edition resolved via DEFINER helper (no questions RLS).
--   Insert/Update/Delete: admin only (compute writes run as service_role).
-- ---------------------------------------------------------------------
drop policy if exists results_select_archived_participant on public.results;
drop policy if exists results_insert_admin                on public.results;
drop policy if exists results_update_admin                on public.results;
drop policy if exists results_delete_admin                on public.results;

create policy results_select_archived_participant on public.results
  for select to authenticated
  using (
    public.is_admin()
    or (
      public.is_edition_participant(public.edition_of_question(question_id))
      and public.edition_is_archived(public.edition_of_question(question_id))
    )
  );

create policy results_insert_admin on public.results
  for insert to authenticated
  with check (public.is_admin());

create policy results_update_admin on public.results
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy results_delete_admin on public.results
  for delete to authenticated
  using (public.is_admin());

-- 8.10 participants self-update column guard.
--   A non-admin self-update (participants_update_own_rsvp) may change ONLY
--   the rsvp column; everything else must stay equal to OLD. Admins are
--   exempt (their own admin policy governs full edits). Enforced by trigger
--   because RLS WITH CHECK cannot compare to OLD values. Defined here (after
--   is_admin() exists in section (7)).
create or replace function public.tg_participants_self_update_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  -- Admins may change anything.
  if public.is_admin() then
    return new;
  end if;

  -- A non-admin self-update (RLS already enforces user_id = auth.uid() on
  -- both OLD and NEW) may change only rsvp.
  if    new.id               is distinct from old.id
     or new.edition_id       is distinct from old.edition_id
     or new.user_id          is distinct from old.user_id
     or new.kind             is distinct from old.kind
     or new.linked_player_id is distinct from old.linked_player_id
     or new.relation_label   is distinct from old.relation_label
  then
    raise exception
      'Self-service updates may only change rsvp; other columns are admin-only.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists participants_self_update_guard on public.participants;
create trigger participants_self_update_guard
  before update on public.participants
  for each row execute function public.tg_participants_self_update_guard();


-- =====================================================================
-- (9) STORAGE — 'headshots' bucket (public read) + object policies
--   storage.objects already has RLS enabled by Supabase. Public bucket
--   serves objects without a token, but an explicit public SELECT policy
--   is still required for direct API listing/reads. Writes are admin-only.
-- =====================================================================

-- 9a. Bucket (idempotent). public=true => served via public CDN URL.
insert into storage.buckets (id, name, public)
values ('headshots', 'headshots', true)
on conflict (id) do update set public = excluded.public;

-- 9b. Object policies scoped to bucket_id = 'headshots'.
drop policy if exists headshots_public_read  on storage.objects;
drop policy if exists headshots_admin_insert on storage.objects;
drop policy if exists headshots_admin_update on storage.objects;
drop policy if exists headshots_admin_delete on storage.objects;

create policy headshots_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'headshots');

create policy headshots_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'headshots' and public.is_admin());

create policy headshots_admin_update on storage.objects
  for update to authenticated
  using      (bucket_id = 'headshots' and public.is_admin())
  with check (bucket_id = 'headshots' and public.is_admin());

create policy headshots_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'headshots' and public.is_admin());

-- =====================================================================
-- END
-- =====================================================================
