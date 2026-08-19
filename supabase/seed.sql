-- =====================================================================
-- Les Brunos — Local development seed (COMPREHENSIVE)
--
-- Loaded by `supabase db reset` AFTER the migrations, per
-- supabase/config.toml -> [db.seed] sql_paths = ["./seed.sql"].
--
-- NOTE — auto-enrolment: this seed inserts its own `participants` rows with
-- explicit ids (the `votes` rows below reference them), so the players →
-- participants auto-enrolment trigger must stay out of the way. Same escape
-- hatch as `app.allow_question_edit`.
set app.skip_autoenroll = 'on';
--
-- WHAT THIS SEED DOES
--   Populates realistic mock data covering EVERY edition lifecycle state so
--   the whole app can be exercised locally without signing up by hand:
--
--     • 6 core players, present in EVERY edition, each with a real
--       Supabase Auth account (so they can log in AND be voters).
--     • Raphaël Tremblay is the ADMIN/owner and the dev login.
--     • 4 editions, all on 29 août of their year, one per lifecycle stage:
--         2028 (+2) CONSTRUCTION  — admin still WRITING the questions (draft)
--         2027 (+1) SENT_FOR_VOTE — voting OPEN right now, partial ballots
--         2026 (now) COMPILATION  — voting CLOSED, 40 q, full ballots, ready
--         2025 (-1) ARCHIVED      — presentation done, 40 q / 20 selected,
--                                   family voters, frozen Borda results
--     • Family / entourage voters (kind='jury') with their own ballots.
--     • shooter_value set per edition (the "égaliseur" constant).
--     • notifications (vote_submitted, results_compiled, …) for the admin.
--     • invite_token on every edition + edition_invites (liens Apple).
--
-- HOW WE HANDLE auth.users
--   participants/votes/profiles all FK auth.users(id), so authenticated rows
--   are mandatory here. We insert auth.users + auth.identities directly with
--   a bcrypt password via pgcrypto's crypt(). The schema's on_auth_user_created
--   trigger then auto-provisions a public.people + public.profiles row for
--   each (default role 'player'). We reference people by their UNIQUE
--   auth_user_id (never by a hand-picked people.id), so we never fight the
--   trigger and the seed stays deterministic + idempotent.
--
-- IDEMPOTENT
--   Fixed UUID literals + ON CONFLICT DO NOTHING / DO UPDATE on the correct
--   unique keys throughout. Safe to re-run; `db reset` rebuilds from scratch.
--
-- RLS / EDIT-LOCK
--   `db reset` runs this as the postgres superuser (BYPASSRLS + owner), so
--   admin-only write policies do not block it. The questions_edit_lock trigger
--   DOES still fire, so for editions that have already left CONSTRUCTION we
--   insert their questions while the edition is temporarily in CONSTRUCTION
--   and flip the real state at the very end (see section 9).
--
-- jsonb SAFETY
--   No jsonb columns are written here, but where JSON-ish values are built we
--   use jsonb_build_object/_array — never  '...' || expr || '...'::jsonb
--   (the ::jsonb cast binds tighter than || and would break).
-- =====================================================================

-- (Pas de begin/commit : le seeder Supabase exécute par batches sur des
--  connexions séparées ; en autocommit, les tables d'aide permanentes
--  restent visibles d'un batch à l'autre.)

-- =====================================================================
-- 0) FIXED IDENTIFIERS
--    auth.users UUIDs are the stable anchor; people.id is derived by the
--    trigger and looked up via auth_user_id. Naming:
--      a17h…  auth user        ed17…  edition
--      b1a5…  player           fa27…  participant
--      b00e…  question         70e7…  vote
--      no7f…  notification
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0a) AUTH USERS — 6 core players + a few family members.
--     Direct insert into auth.users (+ auth.identities) with a bcrypt
--     password. The on_auth_user_created trigger fires AFTER each insert
--     and creates the matching public.people + public.profiles rows.
--
--     Dev login:  raphael@brunos.local  /  Password123!
--     (every seeded account uses the same password for convenience).
-- ---------------------------------------------------------------------
-- NOTE: confirmation_token / recovery_token / email_change_token_new /
-- email_change are NOT NULL with no default in GoTrue; we set them to '' (the
-- proven local-seed pattern). Without them the insert fails on a NULL token.
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  -- Core 6 (also become nominees + voters in every edition).
  ('00000000-0000-0000-0000-000000000000', 'a17e0000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'raphael@brunos.local',
   crypt('Password123!', gen_salt('bf')), now(),
   jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
   jsonb_build_object('display_name','Raphaël Tremblay'),
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a17e0000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'felix@brunos.local',
   crypt('Password123!', gen_salt('bf')), now(),
   jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
   jsonb_build_object('display_name','Félix Lachance'),
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a17e0000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'samuel@brunos.local',
   crypt('Password123!', gen_salt('bf')), now(),
   jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
   jsonb_build_object('display_name','Samuel Painchaud'),
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a17e0000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'vincent@brunos.local',
   crypt('Password123!', gen_salt('bf')), now(),
   jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
   jsonb_build_object('display_name','Vincent Beaulieu'),
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a17e0000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'nicolas@brunos.local',
   crypt('Password123!', gen_salt('bf')), now(),
   jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
   jsonb_build_object('display_name','Nicolas Ouellet'),
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a17e0000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'gabriel@brunos.local',
   crypt('Password123!', gen_salt('bf')), now(),
   jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
   jsonb_build_object('display_name','Gabriel Morin'),
   now(), now(), '', '', '', ''),
  -- Family / entourage voters (kind='jury'). Authenticated so they can vote.
  ('00000000-0000-0000-0000-000000000000', 'a17e0000-0000-4000-8000-0000000000f1', 'authenticated', 'authenticated', 'danielle@brunos.local',
   crypt('Password123!', gen_salt('bf')), now(),
   jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
   jsonb_build_object('display_name','Danielle Tremblay'),
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a17e0000-0000-4000-8000-0000000000f2', 'authenticated', 'authenticated', 'camille@brunos.local',
   crypt('Password123!', gen_salt('bf')), now(),
   jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
   jsonb_build_object('display_name','Camille Lachance'),
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a17e0000-0000-4000-8000-0000000000f3', 'authenticated', 'authenticated', 'rosalie@brunos.local',
   crypt('Password123!', gen_salt('bf')), now(),
   jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
   jsonb_build_object('display_name','Rosalie Painchaud'),
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a17e0000-0000-4000-8000-0000000000f4', 'authenticated', 'authenticated', 'gilles@brunos.local',
   crypt('Password123!', gen_salt('bf')), now(),
   jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
   jsonb_build_object('display_name','Gilles Beaulieu'),
   now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- auth.identities — the email/password identity row Supabase expects per user.
-- provider_id must equal the user id for the 'email' provider.
insert into auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
select
  u.id,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  u.id::text,
  now(), now(), now()
from auth.users u
where u.id in (
  'a17e0000-0000-4000-8000-000000000001','a17e0000-0000-4000-8000-000000000002',
  'a17e0000-0000-4000-8000-000000000003','a17e0000-0000-4000-8000-000000000004',
  'a17e0000-0000-4000-8000-000000000005','a17e0000-0000-4000-8000-000000000006',
  'a17e0000-0000-4000-8000-0000000000f1','a17e0000-0000-4000-8000-0000000000f2',
  'a17e0000-0000-4000-8000-0000000000f3','a17e0000-0000-4000-8000-0000000000f4'
)
on conflict (provider, provider_id) do nothing;

-- ---------------------------------------------------------------------
-- 0b) Reconcile people / profiles created by the trigger.
--     The trigger seeds display_name from raw_user_meta_data.display_name
--     already, but we set it explicitly here so the seed is correct even if
--     the trigger is ever changed. Then promote Raphaël to ADMIN.
-- ---------------------------------------------------------------------
update public.people pe
set display_name = case u.id
    when 'a17e0000-0000-4000-8000-000000000001' then 'Raphaël Tremblay'
    when 'a17e0000-0000-4000-8000-000000000002' then 'Félix Lachance'
    when 'a17e0000-0000-4000-8000-000000000003' then 'Samuel Painchaud'
    when 'a17e0000-0000-4000-8000-000000000004' then 'Vincent Beaulieu'
    when 'a17e0000-0000-4000-8000-000000000005' then 'Nicolas Ouellet'
    when 'a17e0000-0000-4000-8000-000000000006' then 'Gabriel Morin'
    when 'a17e0000-0000-4000-8000-0000000000f1' then 'Danielle Tremblay'
    when 'a17e0000-0000-4000-8000-0000000000f2' then 'Camille Lachance'
    when 'a17e0000-0000-4000-8000-0000000000f3' then 'Rosalie Painchaud'
    when 'a17e0000-0000-4000-8000-0000000000f4' then 'Gilles Beaulieu'
  end
from auth.users u
where pe.auth_user_id = u.id
  and u.id in (
    'a17e0000-0000-4000-8000-000000000001','a17e0000-0000-4000-8000-000000000002',
    'a17e0000-0000-4000-8000-000000000003','a17e0000-0000-4000-8000-000000000004',
    'a17e0000-0000-4000-8000-000000000005','a17e0000-0000-4000-8000-000000000006',
    'a17e0000-0000-4000-8000-0000000000f1','a17e0000-0000-4000-8000-0000000000f2',
    'a17e0000-0000-4000-8000-0000000000f3','a17e0000-0000-4000-8000-0000000000f4'
  );

update public.profiles p
set role = 'super_admin'::public.user_role
from public.people pe
where p.person_id = pe.id
  and pe.auth_user_id = 'a17e0000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------
-- 0b-bis) LE CERCLE
--     Depuis le multi-tenant, tout appartient à un cercle : les éditions
--     l'exigent (NOT NULL) et une fiche sans cercle reste invisible pour
--     les administrateurs de cercle. On le pose donc AVANT les éditions,
--     et on y rattache tout le monde.
-- ---------------------------------------------------------------------
insert into public.circles (id, name)
values ('c1c1e000-0000-4000-8000-000000000001', 'Les Brunos')
on conflict (id) do nothing;

update public.people set circle_id = 'c1c1e000-0000-4000-8000-000000000001' where circle_id is null;

-- Le super-admin est aussi administrateur de ce cercle : les deux voies
-- d'accès (rôle global, appartenance) sont ainsi exercées en local.
insert into public.circle_admins (circle_id, user_id)
values ('c1c1e000-0000-4000-8000-000000000001', 'a17e0000-0000-4000-8000-000000000001')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 0c) (Removed) A helper table mapping short key -> people.id used to live
--     here, but the Supabase seed runner cannot see an object the seed
--     creates and later references. Each consuming statement now folds the
--     same (short key -> auth_user_id) VALUES list inline and joins
--     public.people on auth_user_id directly. No object is created here.
-- ---------------------------------------------------------------------


-- =====================================================================
-- 1) EDITIONS
--    All four are inserted in CONSTRUCTION so the questions_edit_lock
--    trigger permits inserting their questions. Their REAL lifecycle state
--    is applied at the very end (section 9), after every dependent row
--    (questions/votes/answers/results) is in place.
--
--    Event date is fixed at 29 août of each year. Vote windows are set
--    relative to "now" (2026-06-15):
--      2028 (+2)  draft, no deadline yet
--      2027 (+1)  vote OPEN: deadline in the near future (now < deadline)
--      2026 (now) vote CLOSED: deadline in the recent past
--      2025 (-1)  archived: deadline long past
--    shooter_value varies per edition to exercise the equalizer constant.
-- =====================================================================
insert into public.editions
  (id, name, year, event_at, venue_name, venue_address, description, state,
   vote_deadline, drink_rule, shooter_value, invite_token, circle_id)
values
  -- 2028 — CONSTRUCTION (draft). No deadline yet.
  ('ed170000-0000-4000-8000-000000002028',
   'Les Brunos 2028', 2028,
   '2028-08-29 18:00:00-04', 'Chalet du Lac-aux-Hérons',
   '45 chemin du Tour-du-Lac, Sainte-Adèle, QC',
   'Édition en préparation. Le maître de jeu rédige encore les questions.',
   'CONSTRUCTION', null, 'ESCALATION', 8,
   '1271770e-0000-4000-8000-000000002028',
   'c1c1e000-0000-4000-8000-000000000001'),

  -- 2027 — will become SENT_FOR_VOTE. Deadline ~2.5 months out (open now).
  ('ed170000-0000-4000-8000-000000002027',
   'Les Brunos 2027', 2027,
   '2027-08-29 18:00:00-04', 'Microbrasserie du Vieux-Moulin',
   '801 chemin du Vieux-Moulin, Sainte-Adèle, QC',
   'Le vote est ouvert ! Désigne qui est le plus susceptible de…',
   'CONSTRUCTION', '2026-08-28 23:59:59-04', 'ESCALATION', 8,
   '1271770e-0000-4000-8000-000000002027',
   'c1c1e000-0000-4000-8000-000000000001'),

  -- 2026 — will become COMPILATION. Deadline already passed (vote closed).
  ('ed170000-0000-4000-8000-000000002026',
   'Les Brunos 2026', 2026,
   '2026-08-29 18:00:00-04', 'Le Pavillon des Brunos',
   '1200 avenue de la Fête, Sainte-Adèle, QC',
   'Le vote est clos. Compilation des classements en cours.',
   'CONSTRUCTION', '2026-06-10 23:59:59-04', 'ESCALATION', 8,
   '1271770e-0000-4000-8000-000000002026',
   'c1c1e000-0000-4000-8000-000000000001'),

  -- 2025 — will become ARCHIVED. Everything in the past.
  ('ed170000-0000-4000-8000-000000002025',
   'Les Brunos 2025 (démonstration)', 2025,
   '2025-08-29 18:00:00-04', 'Auberge des Trois-Pins',
   '14 chemin des Bouleaux, Sainte-Adèle, QC',
   'Édition archivée. La présentation a eu lieu, les résultats sont publics.',
   'CONSTRUCTION', '2025-08-22 23:59:59-04', 'ESCALATION', 10,
   '1271770e-0000-4000-8000-000000002025',
   'c1c1e000-0000-4000-8000-000000000001')
on conflict (id) do nothing;


-- =====================================================================
-- 2) PLAYERS — the 6 core nominees in EVERY edition (= answer choices).
--    display_order is UNIQUE per edition; kept contiguous from 0.
--    headshot_url uses placeholder images (no real upload needed).
--    player UUID scheme: b1a5YYYY-…-00000000000P  (YYYY=year, P=index 1..6).
-- =====================================================================
insert into public.players (id, edition_id, person_id, headshot_url, display_order)
select
  pl.player_id,
  pl.edition_id,
  pe.id,
  case pl.k
    when 'raphael'        then '/players/joueur-1.png'
    when 'felix'          then '/players/joueur-2.png'
    when 'samuel'         then '/players/joueur-3.png'
    when 'vincent'        then '/players/joueur-4.png'
    when 'nicolas'        then '/players/joueur-5.png'
    when 'gabriel' then '/players/joueur-6.png'
    else 'https://placehold.co/512x512/0a0a0b/d4af37.png?text=' || pl.label
  end,
  pl.ord
from (values
  -- 2028
  ('b1a52028-0000-4000-8000-000000000001'::uuid, 'ed170000-0000-4000-8000-000000002028'::uuid, 'raphael',    0, 'Raphael'),
  ('b1a52028-0000-4000-8000-000000000002'::uuid, 'ed170000-0000-4000-8000-000000002028'::uuid, 'felix',    1, 'Felix'),
  ('b1a52028-0000-4000-8000-000000000003'::uuid, 'ed170000-0000-4000-8000-000000002028'::uuid, 'samuel',  2, 'Samuel'),
  ('b1a52028-0000-4000-8000-000000000004'::uuid, 'ed170000-0000-4000-8000-000000002028'::uuid, 'vincent',   3, 'Vincent'),
  ('b1a52028-0000-4000-8000-000000000005'::uuid, 'ed170000-0000-4000-8000-000000002028'::uuid, 'nicolas',   4, 'Nicolas'),
  ('b1a52028-0000-4000-8000-000000000006'::uuid, 'ed170000-0000-4000-8000-000000002028'::uuid, 'gabriel', 5, 'Gabriel'),
  -- 2027
  ('b1a52027-0000-4000-8000-000000000001'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'raphael',    0, 'Raphael'),
  ('b1a52027-0000-4000-8000-000000000002'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'felix',    1, 'Felix'),
  ('b1a52027-0000-4000-8000-000000000003'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'samuel',  2, 'Samuel'),
  ('b1a52027-0000-4000-8000-000000000004'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'vincent',   3, 'Vincent'),
  ('b1a52027-0000-4000-8000-000000000005'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'nicolas',   4, 'Nicolas'),
  ('b1a52027-0000-4000-8000-000000000006'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'gabriel', 5, 'Gabriel'),
  -- 2026
  ('b1a52026-0000-4000-8000-000000000001'::uuid, 'ed170000-0000-4000-8000-000000002026'::uuid, 'raphael',    0, 'Raphael'),
  ('b1a52026-0000-4000-8000-000000000002'::uuid, 'ed170000-0000-4000-8000-000000002026'::uuid, 'felix',    1, 'Felix'),
  ('b1a52026-0000-4000-8000-000000000003'::uuid, 'ed170000-0000-4000-8000-000000002026'::uuid, 'samuel',  2, 'Samuel'),
  ('b1a52026-0000-4000-8000-000000000004'::uuid, 'ed170000-0000-4000-8000-000000002026'::uuid, 'vincent',   3, 'Vincent'),
  ('b1a52026-0000-4000-8000-000000000005'::uuid, 'ed170000-0000-4000-8000-000000002026'::uuid, 'nicolas',   4, 'Nicolas'),
  ('b1a52026-0000-4000-8000-000000000006'::uuid, 'ed170000-0000-4000-8000-000000002026'::uuid, 'gabriel', 5, 'Gabriel'),
  -- 2025
  ('b1a52025-0000-4000-8000-000000000001'::uuid, 'ed170000-0000-4000-8000-000000002025'::uuid, 'raphael',    0, 'Raphael'),
  ('b1a52025-0000-4000-8000-000000000002'::uuid, 'ed170000-0000-4000-8000-000000002025'::uuid, 'felix',    1, 'Felix'),
  ('b1a52025-0000-4000-8000-000000000003'::uuid, 'ed170000-0000-4000-8000-000000002025'::uuid, 'samuel',  2, 'Samuel'),
  ('b1a52025-0000-4000-8000-000000000004'::uuid, 'ed170000-0000-4000-8000-000000002025'::uuid, 'vincent',   3, 'Vincent'),
  ('b1a52025-0000-4000-8000-000000000005'::uuid, 'ed170000-0000-4000-8000-000000002025'::uuid, 'nicolas',   4, 'Nicolas'),
  ('b1a52025-0000-4000-8000-000000000006'::uuid, 'ed170000-0000-4000-8000-000000002025'::uuid, 'gabriel', 5, 'Gabriel')
) as pl(player_id, edition_id, k, ord, label)
-- Inline (short key -> auth_user_id) mapping, then resolve to people.id via
-- auth_user_id (the seed references no object it creates, so this is folded in).
join (values
  ('raphael',   'a17e0000-0000-4000-8000-000000000001'::uuid),
  ('felix',   'a17e0000-0000-4000-8000-000000000002'::uuid),
  ('samuel', 'a17e0000-0000-4000-8000-000000000003'::uuid),
  ('vincent',  'a17e0000-0000-4000-8000-000000000004'::uuid),
  ('nicolas',  'a17e0000-0000-4000-8000-000000000005'::uuid),
  ('gabriel','a17e0000-0000-4000-8000-000000000006'::uuid),
  ('danielle',   'a17e0000-0000-4000-8000-0000000000f1'::uuid),
  ('camille','a17e0000-0000-4000-8000-0000000000f2'::uuid),
  ('rosalie',    'a17e0000-0000-4000-8000-0000000000f3'::uuid),
  ('gilles',     'a17e0000-0000-4000-8000-0000000000f4'::uuid)
) as sp(k, auth_id) on sp.k = pl.k
join public.people pe on pe.auth_user_id = sp.auth_id
on conflict (id) do nothing;


-- =====================================================================
-- 3) PARTICIPANTS — who may vote in an edition, and how.
--    kind='player'  -> linked_player_id NULL, relation_label NULL.
--    kind='jury'    -> linked_player_id (a player of THIS edition) + a
--                      non-empty relation_label  (participants_jury_fields_chk).
--    user_id FK auth.users; UNIQUE (edition_id, user_id).
--    participant UUID scheme: fa27YYYY-…-00000000000X  (X = person tag).
--
-- 3a) Core 6 as players in all four editions.
-- =====================================================================
insert into public.participants (id, edition_id, user_id, kind, linked_player_id, relation_label)
select
  pt.participant_id, pt.edition_id, u.id, 'player'::public.participant_kind, null, null
from (values
  -- 2028 (draft) — only the admin/owner is in so far; the rest get added when
  -- the edition opens. Keeps the CONSTRUCTION edition realistically empty.
  ('fa272028-0000-4000-8000-000000000001'::uuid, 'ed170000-0000-4000-8000-000000002028'::uuid, 'a17e0000-0000-4000-8000-000000000001'::uuid, null),
  -- 2027 (vote open) — all 6 players.
  ('fa272027-0000-4000-8000-000000000001'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'a17e0000-0000-4000-8000-000000000001'::uuid, 'https://invites.apple.com/brunos-2027/jeremy'),
  ('fa272027-0000-4000-8000-000000000002'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'a17e0000-0000-4000-8000-000000000002'::uuid, null),
  ('fa272027-0000-4000-8000-000000000003'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'a17e0000-0000-4000-8000-000000000003'::uuid, null),
  ('fa272027-0000-4000-8000-000000000004'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'a17e0000-0000-4000-8000-000000000004'::uuid, null),
  ('fa272027-0000-4000-8000-000000000005'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'a17e0000-0000-4000-8000-000000000005'::uuid, null),
  ('fa272027-0000-4000-8000-000000000006'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'a17e0000-0000-4000-8000-000000000006'::uuid, null),
  -- 2026 (compilation) — all 6 players.
  ('fa272026-0000-4000-8000-000000000001'::uuid, 'ed170000-0000-4000-8000-000000002026'::uuid, 'a17e0000-0000-4000-8000-000000000001'::uuid, 'https://invites.apple.com/brunos-2026/jeremy'),
  ('fa272026-0000-4000-8000-000000000002'::uuid, 'ed170000-0000-4000-8000-000000002026'::uuid, 'a17e0000-0000-4000-8000-000000000002'::uuid, null),
  ('fa272026-0000-4000-8000-000000000003'::uuid, 'ed170000-0000-4000-8000-000000002026'::uuid, 'a17e0000-0000-4000-8000-000000000003'::uuid, null),
  ('fa272026-0000-4000-8000-000000000004'::uuid, 'ed170000-0000-4000-8000-000000002026'::uuid, 'a17e0000-0000-4000-8000-000000000004'::uuid, null),
  ('fa272026-0000-4000-8000-000000000005'::uuid, 'ed170000-0000-4000-8000-000000002026'::uuid, 'a17e0000-0000-4000-8000-000000000005'::uuid, null),
  ('fa272026-0000-4000-8000-000000000006'::uuid, 'ed170000-0000-4000-8000-000000002026'::uuid, 'a17e0000-0000-4000-8000-000000000006'::uuid, null),
  -- 2025 (archived) — all 6 players.
  ('fa272025-0000-4000-8000-000000000001'::uuid, 'ed170000-0000-4000-8000-000000002025'::uuid, 'a17e0000-0000-4000-8000-000000000001'::uuid, null),
  ('fa272025-0000-4000-8000-000000000002'::uuid, 'ed170000-0000-4000-8000-000000002025'::uuid, 'a17e0000-0000-4000-8000-000000000002'::uuid, null),
  ('fa272025-0000-4000-8000-000000000003'::uuid, 'ed170000-0000-4000-8000-000000002025'::uuid, 'a17e0000-0000-4000-8000-000000000003'::uuid, null),
  ('fa272025-0000-4000-8000-000000000004'::uuid, 'ed170000-0000-4000-8000-000000002025'::uuid, 'a17e0000-0000-4000-8000-000000000004'::uuid, null),
  ('fa272025-0000-4000-8000-000000000005'::uuid, 'ed170000-0000-4000-8000-000000002025'::uuid, 'a17e0000-0000-4000-8000-000000000005'::uuid, null),
  ('fa272025-0000-4000-8000-000000000006'::uuid, 'ed170000-0000-4000-8000-000000002025'::uuid, 'a17e0000-0000-4000-8000-000000000006'::uuid, null)
) as pt(participant_id, edition_id, user_id, apple_url)
join auth.users u on u.id = pt.user_id
on conflict (id) do nothing;

-- Les liens Apple sont désormais portés par (cérémonie, personne) et non par
-- le compte : un nommé sans compte doit pouvoir en recevoir un.
insert into public.edition_invites (edition_id, person_id, apple_invite_url)
select v.edition_id, pe.id, v.url
from (values
  ('ed170000-0000-4000-8000-000000002027'::uuid, 'a17e0000-0000-4000-8000-000000000001'::uuid,
   'https://invites.apple.com/brunos-2027/jeremy'),
  ('ed170000-0000-4000-8000-000000002026'::uuid, 'a17e0000-0000-4000-8000-000000000001'::uuid,
   'https://invites.apple.com/brunos-2026/jeremy')
) as v(edition_id, auth_user_id, url)
join public.people pe on pe.auth_user_id = v.auth_user_id
on conflict (edition_id, person_id) do nothing;

-- 3b) Family / entourage members as jury participants (linked to a player).
--     2027: 1 family voter. 2026 + 2025: several. linked_player_id points at
--     the matching player row of the SAME edition (FK + jury check).
insert into public.participants (id, edition_id, user_id, kind, linked_player_id, relation_label)
select
  pt.participant_id, pt.edition_id, u.id, 'jury'::public.participant_kind, pt.linked_player_id, pt.relation_label
from (values
  -- 2027 (vote open) — one family member already joined.
  ('fa272027-0000-4000-8000-0000000000f1'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'a17e0000-0000-4000-8000-0000000000f1'::uuid, 'b1a52027-0000-4000-8000-000000000001'::uuid, 'Mère de Raphaël'),
  -- 2026 (compilation) — full entourage.
  ('fa272026-0000-4000-8000-0000000000f1'::uuid, 'ed170000-0000-4000-8000-000000002026'::uuid, 'a17e0000-0000-4000-8000-0000000000f1'::uuid, 'b1a52026-0000-4000-8000-000000000001'::uuid, 'Mère de Raphaël'),
  ('fa272026-0000-4000-8000-0000000000f2'::uuid, 'ed170000-0000-4000-8000-000000002026'::uuid, 'a17e0000-0000-4000-8000-0000000000f2'::uuid, 'b1a52026-0000-4000-8000-000000000002'::uuid, 'Conjointe de Félix'),
  ('fa272026-0000-4000-8000-0000000000f3'::uuid, 'ed170000-0000-4000-8000-000000002026'::uuid, 'a17e0000-0000-4000-8000-0000000000f3'::uuid, 'b1a52026-0000-4000-8000-000000000003'::uuid, 'Sœur de Samuel'),
  -- 2025 (archived) — full entourage.
  ('fa272025-0000-4000-8000-0000000000f1'::uuid, 'ed170000-0000-4000-8000-000000002025'::uuid, 'a17e0000-0000-4000-8000-0000000000f1'::uuid, 'b1a52025-0000-4000-8000-000000000001'::uuid, 'Mère de Raphaël'),
  ('fa272025-0000-4000-8000-0000000000f2'::uuid, 'ed170000-0000-4000-8000-000000002025'::uuid, 'a17e0000-0000-4000-8000-0000000000f2'::uuid, 'b1a52025-0000-4000-8000-000000000002'::uuid, 'Conjointe de Félix'),
  ('fa272025-0000-4000-8000-0000000000f4'::uuid, 'ed170000-0000-4000-8000-000000002025'::uuid, 'a17e0000-0000-4000-8000-0000000000f4'::uuid, 'b1a52025-0000-4000-8000-000000000004'::uuid, 'Père de Vincent')
) as pt(participant_id, edition_id, user_id, linked_player_id, relation_label)
join auth.users u on u.id = pt.user_id
on conflict (id) do nothing;


-- =====================================================================
-- 4) QUESTIONS  ("qui est le plus susceptible de…", style soirée).
--    Inserted while each edition is still CONSTRUCTION (state flipped in §9),
--    so the questions_edit_lock trigger permits these INSERTs.
--
--    Rules enforced by the schema:
--      • position UNIQUE per edition (contiguous from 0 here).
--      • show_order UNIQUE per edition, NULL until selected.
--      • is_selected_for_show=true  IFF  show_order IS NOT NULL.
--      • format ∈ {ranking, single_choice}; drink_rule_override ∈ {NULL,
--        TOP_UNIQUE, ESCALATION}; reveal_enabled defaults true.
--
--    Question UUID scheme: b00eYYYY-…-0000000000NN  (NN = position+1, hex).
--    A shared pool of 40 French prompts feeds 2026 and 2025; smaller slices
--    feed 2027 and 2028.
-- =====================================================================

-- 4a) The 40-prompt pool. Index 1..40 -> question position 0..39.
--     (format/drink_rule_override chosen per index in the INSERTs below.)
--     NOTE: the Supabase seed runner cannot see a table the seed creates and
--     later references, so there is no shared pool table. Instead the exact
--     same 40-row (n, prompt) VALUES list is folded inline into each question
--     INSERT below (each statement keeps its own where/limit slice). Repeating
--     the list across statements is intentional and required.

-- 4b) 2028 (CONSTRUCTION draft) — only the first 5 prompts, none selected.
insert into public.questions
  (id, edition_id, prompt, format, position, drink_rule_override, is_selected_for_show, show_order, reveal_enabled)
select
  ('b00e2028-0000-4000-8000-' || lpad(to_hex(q.n), 12, '0'))::uuid,
  'ed170000-0000-4000-8000-000000002028'::uuid,
  q.prompt,
  case when q.n = 3 then 'single_choice'::public.question_format else 'ranking'::public.question_format end,
  (q.n - 1),
  case when q.n = 3 then 'TOP_UNIQUE'::public.drink_rule else null end,
  false, null, true
from (values
  (1,  'Qui est le plus susceptible de se marier en premier ?'),
  (2,  'Qui est le plus susceptible de devenir riche avant 40 ans ?'),
  (3,  'Qui est le plus susceptible de finir en prison pour une raison absurde ?'),
  (4,  'Qui est le plus susceptible d''oublier l''anniversaire de sa blonde ?'),
  (5,  'Qui est le plus susceptible de pleurer devant un film de Noël ?'),
  (6,  'Qui est le plus susceptible de partir vivre à l''étranger sur un coup de tête ?'),
  (7,  'Qui est le plus susceptible de devenir politicien ?'),
  (8,  'Qui est le plus susceptible de gagner à la loterie et de tout dépenser ?'),
  (9,  'Qui est le plus susceptible de se perdre dans sa propre ville ?'),
  (10, 'Qui est le plus susceptible de manquer son propre mariage ?'),
  (11, 'Qui est le plus susceptible de devenir influenceur ?'),
  (12, 'Qui est le plus susceptible d''adopter dix chats ?'),
  (13, 'Qui est le plus susceptible de texter son ex à 3 h du matin ?'),
  (14, 'Qui est le plus susceptible de tomber endormi dans un party ?'),
  (15, 'Qui est le plus susceptible de chanter du karaoké sans qu''on lui demande ?'),
  (16, 'Qui est le plus susceptible de se faire arrêter pour excès de vitesse ?'),
  (17, 'Qui est le plus susceptible de devenir végane du jour au lendemain ?'),
  (18, 'Qui est le plus susceptible de monter une entreprise douteuse ?'),
  (19, 'Qui est le plus susceptible de se casser un membre en vacances ?'),
  (20, 'Qui est le plus susceptible de devenir une légende des Brunos ?'),
  (21, 'Qui est le plus susceptible de raconter la même histoire trois fois dans la soirée ?'),
  (22, 'Qui est le plus susceptible de commander la facture la plus salée au resto ?'),
  (23, 'Qui est le plus susceptible de perdre son téléphone ce soir ?'),
  (24, 'Qui est le plus susceptible de devenir coach de vie sur Internet ?'),
  (25, 'Qui est le plus susceptible de se mettre à pleurer de joie pour un rien ?'),
  (26, 'Qui est le plus susceptible de faire un discours trop long aux Brunos ?'),
  (27, 'Qui est le plus susceptible de disparaître sans dire au revoir ?'),
  (28, 'Qui est le plus susceptible d''acheter quelque chose d''inutile ce mois-ci ?'),
  (29, 'Qui est le plus susceptible de devenir le prochain organisateur des Brunos ?'),
  (30, 'Qui est le plus susceptible de se mettre au CrossFit puis de tout abandonner ?'),
  (31, 'Qui est le plus susceptible de gagner un concours de mangeurs ?'),
  (32, 'Qui est le plus susceptible de se faire un tatouage qu''il regrettera ?'),
  (33, 'Qui est le plus susceptible de répondre à ses courriels en réunion ?'),
  (34, 'Qui est le plus susceptible de devenir riche grâce aux cryptomonnaies ?'),
  (35, 'Qui est le plus susceptible de finir la soirée le dernier debout ?'),
  (36, 'Qui est le plus susceptible de relancer un vieux débat à table ?'),
  (37, 'Qui est le plus susceptible de partir en road trip sans plan ?'),
  (38, 'Qui est le plus susceptible de devenir le parrain le plus gâteux ?'),
  (39, 'Qui est le plus susceptible d''arriver en retard à sa propre fête ?'),
  (40, 'Qui est le plus susceptible de proposer un dernier verre « pour la route » ?')
) as q(n, prompt)
where q.n <= 5
on conflict (id) do nothing;

-- 4c) 2027 (vote OPEN) — a fuller set of 15 prompts, none selected yet.
insert into public.questions
  (id, edition_id, prompt, format, position, drink_rule_override, is_selected_for_show, show_order, reveal_enabled)
select
  ('b00e2027-0000-4000-8000-' || lpad(to_hex(q.n), 12, '0'))::uuid,
  'ed170000-0000-4000-8000-000000002027'::uuid,
  q.prompt,
  case when q.n in (3, 10) then 'single_choice'::public.question_format else 'ranking'::public.question_format end,
  (q.n - 1),
  -- Une désignation fait toujours un seul buveur : la personne la plus votée.
  case when q.n in (3, 10) then 'TOP_UNIQUE'::public.drink_rule else null end,
  false, null, true
from (values
  (1,  'Qui est le plus susceptible de se marier en premier ?'),
  (2,  'Qui est le plus susceptible de devenir riche avant 40 ans ?'),
  (3,  'Qui est le plus susceptible de finir en prison pour une raison absurde ?'),
  (4,  'Qui est le plus susceptible d''oublier l''anniversaire de sa blonde ?'),
  (5,  'Qui est le plus susceptible de pleurer devant un film de Noël ?'),
  (6,  'Qui est le plus susceptible de partir vivre à l''étranger sur un coup de tête ?'),
  (7,  'Qui est le plus susceptible de devenir politicien ?'),
  (8,  'Qui est le plus susceptible de gagner à la loterie et de tout dépenser ?'),
  (9,  'Qui est le plus susceptible de se perdre dans sa propre ville ?'),
  (10, 'Qui est le plus susceptible de manquer son propre mariage ?'),
  (11, 'Qui est le plus susceptible de devenir influenceur ?'),
  (12, 'Qui est le plus susceptible d''adopter dix chats ?'),
  (13, 'Qui est le plus susceptible de texter son ex à 3 h du matin ?'),
  (14, 'Qui est le plus susceptible de tomber endormi dans un party ?'),
  (15, 'Qui est le plus susceptible de chanter du karaoké sans qu''on lui demande ?'),
  (16, 'Qui est le plus susceptible de se faire arrêter pour excès de vitesse ?'),
  (17, 'Qui est le plus susceptible de devenir végane du jour au lendemain ?'),
  (18, 'Qui est le plus susceptible de monter une entreprise douteuse ?'),
  (19, 'Qui est le plus susceptible de se casser un membre en vacances ?'),
  (20, 'Qui est le plus susceptible de devenir une légende des Brunos ?'),
  (21, 'Qui est le plus susceptible de raconter la même histoire trois fois dans la soirée ?'),
  (22, 'Qui est le plus susceptible de commander la facture la plus salée au resto ?'),
  (23, 'Qui est le plus susceptible de perdre son téléphone ce soir ?'),
  (24, 'Qui est le plus susceptible de devenir coach de vie sur Internet ?'),
  (25, 'Qui est le plus susceptible de se mettre à pleurer de joie pour un rien ?'),
  (26, 'Qui est le plus susceptible de faire un discours trop long aux Brunos ?'),
  (27, 'Qui est le plus susceptible de disparaître sans dire au revoir ?'),
  (28, 'Qui est le plus susceptible d''acheter quelque chose d''inutile ce mois-ci ?'),
  (29, 'Qui est le plus susceptible de devenir le prochain organisateur des Brunos ?'),
  (30, 'Qui est le plus susceptible de se mettre au CrossFit puis de tout abandonner ?'),
  (31, 'Qui est le plus susceptible de gagner un concours de mangeurs ?'),
  (32, 'Qui est le plus susceptible de se faire un tatouage qu''il regrettera ?'),
  (33, 'Qui est le plus susceptible de répondre à ses courriels en réunion ?'),
  (34, 'Qui est le plus susceptible de devenir riche grâce aux cryptomonnaies ?'),
  (35, 'Qui est le plus susceptible de finir la soirée le dernier debout ?'),
  (36, 'Qui est le plus susceptible de relancer un vieux débat à table ?'),
  (37, 'Qui est le plus susceptible de partir en road trip sans plan ?'),
  (38, 'Qui est le plus susceptible de devenir le parrain le plus gâteux ?'),
  (39, 'Qui est le plus susceptible d''arriver en retard à sa propre fête ?'),
  (40, 'Qui est le plus susceptible de proposer un dernier verre « pour la route » ?')
) as q(n, prompt)
where q.n <= 15
on conflict (id) do nothing;

-- 4d) 2026 (COMPILATION) — full 40 questions, none selected for the show yet
--     (the admin curates the selection during compilation in the app).
insert into public.questions
  (id, edition_id, prompt, format, position, drink_rule_override, is_selected_for_show, show_order, reveal_enabled)
select
  ('b00e2026-0000-4000-8000-' || lpad(to_hex(q.n), 12, '0'))::uuid,
  'ed170000-0000-4000-8000-000000002026'::uuid,
  q.prompt,
  -- ~1/5 are single_choice; the rest ranking.
  case when q.n % 5 = 0 then 'single_choice'::public.question_format else 'ranking'::public.question_format end,
  (q.n - 1),
  -- Toute désignation est en « gagnant boit » : c'est la seule règle qui ait
  -- un sens quand on ne choisit qu'une personne. La question 3 est un
  -- classement en « gagnant boit », pour exercer le cas mixte.
  case when q.n % 5 = 0 or q.n = 3 then 'TOP_UNIQUE'::public.drink_rule else null end,
  false, null, true
from (values
  (1,  'Qui est le plus susceptible de se marier en premier ?'),
  (2,  'Qui est le plus susceptible de devenir riche avant 40 ans ?'),
  (3,  'Qui est le plus susceptible de finir en prison pour une raison absurde ?'),
  (4,  'Qui est le plus susceptible d''oublier l''anniversaire de sa blonde ?'),
  (5,  'Qui est le plus susceptible de pleurer devant un film de Noël ?'),
  (6,  'Qui est le plus susceptible de partir vivre à l''étranger sur un coup de tête ?'),
  (7,  'Qui est le plus susceptible de devenir politicien ?'),
  (8,  'Qui est le plus susceptible de gagner à la loterie et de tout dépenser ?'),
  (9,  'Qui est le plus susceptible de se perdre dans sa propre ville ?'),
  (10, 'Qui est le plus susceptible de manquer son propre mariage ?'),
  (11, 'Qui est le plus susceptible de devenir influenceur ?'),
  (12, 'Qui est le plus susceptible d''adopter dix chats ?'),
  (13, 'Qui est le plus susceptible de texter son ex à 3 h du matin ?'),
  (14, 'Qui est le plus susceptible de tomber endormi dans un party ?'),
  (15, 'Qui est le plus susceptible de chanter du karaoké sans qu''on lui demande ?'),
  (16, 'Qui est le plus susceptible de se faire arrêter pour excès de vitesse ?'),
  (17, 'Qui est le plus susceptible de devenir végane du jour au lendemain ?'),
  (18, 'Qui est le plus susceptible de monter une entreprise douteuse ?'),
  (19, 'Qui est le plus susceptible de se casser un membre en vacances ?'),
  (20, 'Qui est le plus susceptible de devenir une légende des Brunos ?'),
  (21, 'Qui est le plus susceptible de raconter la même histoire trois fois dans la soirée ?'),
  (22, 'Qui est le plus susceptible de commander la facture la plus salée au resto ?'),
  (23, 'Qui est le plus susceptible de perdre son téléphone ce soir ?'),
  (24, 'Qui est le plus susceptible de devenir coach de vie sur Internet ?'),
  (25, 'Qui est le plus susceptible de se mettre à pleurer de joie pour un rien ?'),
  (26, 'Qui est le plus susceptible de faire un discours trop long aux Brunos ?'),
  (27, 'Qui est le plus susceptible de disparaître sans dire au revoir ?'),
  (28, 'Qui est le plus susceptible d''acheter quelque chose d''inutile ce mois-ci ?'),
  (29, 'Qui est le plus susceptible de devenir le prochain organisateur des Brunos ?'),
  (30, 'Qui est le plus susceptible de se mettre au CrossFit puis de tout abandonner ?'),
  (31, 'Qui est le plus susceptible de gagner un concours de mangeurs ?'),
  (32, 'Qui est le plus susceptible de se faire un tatouage qu''il regrettera ?'),
  (33, 'Qui est le plus susceptible de répondre à ses courriels en réunion ?'),
  (34, 'Qui est le plus susceptible de devenir riche grâce aux cryptomonnaies ?'),
  (35, 'Qui est le plus susceptible de finir la soirée le dernier debout ?'),
  (36, 'Qui est le plus susceptible de relancer un vieux débat à table ?'),
  (37, 'Qui est le plus susceptible de partir en road trip sans plan ?'),
  (38, 'Qui est le plus susceptible de devenir le parrain le plus gâteux ?'),
  (39, 'Qui est le plus susceptible d''arriver en retard à sa propre fête ?'),
  (40, 'Qui est le plus susceptible de proposer un dernier verre « pour la route » ?')
) as q(n, prompt)
on conflict (id) do nothing;

-- 4e) 2025 (ARCHIVED) — full 40 questions, of which the FIRST 20 (positions
--     0..19) were retained for the show (show_order 0..19). The other 20 stay
--     unselected. Consistency check: selected IFF show_order not null.
insert into public.questions
  (id, edition_id, prompt, format, position, drink_rule_override, is_selected_for_show, show_order, reveal_enabled)
select
  ('b00e2025-0000-4000-8000-' || lpad(to_hex(q.n), 12, '0'))::uuid,
  'ed170000-0000-4000-8000-000000002025'::uuid,
  q.prompt,
  case when q.n % 5 = 0 then 'single_choice'::public.question_format else 'ranking'::public.question_format end,
  (q.n - 1),
  case when q.n % 5 = 0 or q.n = 3 then 'TOP_UNIQUE'::public.drink_rule else null end,
  (q.n <= 20),                                   -- selected for the show?
  case when q.n <= 20 then (q.n - 1) else null end,  -- show_order 0..19
  -- one selected question has its reveal toggled OFF, to exercise that flag.
  case when q.n = 7 then false else true end
from (values
  (1,  'Qui est le plus susceptible de se marier en premier ?'),
  (2,  'Qui est le plus susceptible de devenir riche avant 40 ans ?'),
  (3,  'Qui est le plus susceptible de finir en prison pour une raison absurde ?'),
  (4,  'Qui est le plus susceptible d''oublier l''anniversaire de sa blonde ?'),
  (5,  'Qui est le plus susceptible de pleurer devant un film de Noël ?'),
  (6,  'Qui est le plus susceptible de partir vivre à l''étranger sur un coup de tête ?'),
  (7,  'Qui est le plus susceptible de devenir politicien ?'),
  (8,  'Qui est le plus susceptible de gagner à la loterie et de tout dépenser ?'),
  (9,  'Qui est le plus susceptible de se perdre dans sa propre ville ?'),
  (10, 'Qui est le plus susceptible de manquer son propre mariage ?'),
  (11, 'Qui est le plus susceptible de devenir influenceur ?'),
  (12, 'Qui est le plus susceptible d''adopter dix chats ?'),
  (13, 'Qui est le plus susceptible de texter son ex à 3 h du matin ?'),
  (14, 'Qui est le plus susceptible de tomber endormi dans un party ?'),
  (15, 'Qui est le plus susceptible de chanter du karaoké sans qu''on lui demande ?'),
  (16, 'Qui est le plus susceptible de se faire arrêter pour excès de vitesse ?'),
  (17, 'Qui est le plus susceptible de devenir végane du jour au lendemain ?'),
  (18, 'Qui est le plus susceptible de monter une entreprise douteuse ?'),
  (19, 'Qui est le plus susceptible de se casser un membre en vacances ?'),
  (20, 'Qui est le plus susceptible de devenir une légende des Brunos ?'),
  (21, 'Qui est le plus susceptible de raconter la même histoire trois fois dans la soirée ?'),
  (22, 'Qui est le plus susceptible de commander la facture la plus salée au resto ?'),
  (23, 'Qui est le plus susceptible de perdre son téléphone ce soir ?'),
  (24, 'Qui est le plus susceptible de devenir coach de vie sur Internet ?'),
  (25, 'Qui est le plus susceptible de se mettre à pleurer de joie pour un rien ?'),
  (26, 'Qui est le plus susceptible de faire un discours trop long aux Brunos ?'),
  (27, 'Qui est le plus susceptible de disparaître sans dire au revoir ?'),
  (28, 'Qui est le plus susceptible d''acheter quelque chose d''inutile ce mois-ci ?'),
  (29, 'Qui est le plus susceptible de devenir le prochain organisateur des Brunos ?'),
  (30, 'Qui est le plus susceptible de se mettre au CrossFit puis de tout abandonner ?'),
  (31, 'Qui est le plus susceptible de gagner un concours de mangeurs ?'),
  (32, 'Qui est le plus susceptible de se faire un tatouage qu''il regrettera ?'),
  (33, 'Qui est le plus susceptible de répondre à ses courriels en réunion ?'),
  (34, 'Qui est le plus susceptible de devenir riche grâce aux cryptomonnaies ?'),
  (35, 'Qui est le plus susceptible de finir la soirée le dernier debout ?'),
  (36, 'Qui est le plus susceptible de relancer un vieux débat à table ?'),
  (37, 'Qui est le plus susceptible de partir en road trip sans plan ?'),
  (38, 'Qui est le plus susceptible de devenir le parrain le plus gâteux ?'),
  (39, 'Qui est le plus susceptible d''arriver en retard à sa propre fête ?'),
  (40, 'Qui est le plus susceptible de proposer un dernier verre « pour la route » ?')
) as q(n, prompt)
on conflict (id) do nothing;


-- =====================================================================
-- 5) VOTES (one ballot per participant per edition).
--    submitted_at NULL = draft/in-progress; non-NULL = finalized.
--    UNIQUE (edition_id, participant_id). votes.edition_id is tied to the
--    participant's edition by the composite FK.
--    vote UUID = participant UUID with the leading 'fa27' rewritten to '70e7'
--    (kept parallel for readability; still globally unique).
-- =====================================================================

-- 5a) 2027 (vote OPEN) — partial progress:
--     • Raphaël + Félix + the family voter have FINALIZED (submitted_at set).
--     • Samuel has a DRAFT (submitted_at NULL, partial answers below).
--     • Vincent / Nicolas / Gabriel haven't started (no votes row).
insert into public.votes (id, edition_id, participant_id, submitted_at)
values
  ('70e72027-0000-4000-8000-000000000001'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'fa272027-0000-4000-8000-000000000001'::uuid, now() - interval '5 days'),
  ('70e72027-0000-4000-8000-000000000002'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'fa272027-0000-4000-8000-000000000002'::uuid, now() - interval '3 days'),
  ('70e72027-0000-4000-8000-0000000000f1'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'fa272027-0000-4000-8000-0000000000f1'::uuid, now() - interval '2 days'),
  ('70e72027-0000-4000-8000-000000000003'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'fa272027-0000-4000-8000-000000000003'::uuid, null)
on conflict (id) do nothing;

-- 5b) 2026 (COMPILATION) — every participant FINALIZED (vote closed).
insert into public.votes (id, edition_id, participant_id, submitted_at)
select
  v.vote_id, 'ed170000-0000-4000-8000-000000002026'::uuid, v.participant_id, v.submitted_at
from (values
  ('70e72026-0000-4000-8000-000000000001'::uuid, 'fa272026-0000-4000-8000-000000000001'::uuid, (now() - interval '9 days')),
  ('70e72026-0000-4000-8000-000000000002'::uuid, 'fa272026-0000-4000-8000-000000000002'::uuid, (now() - interval '8 days')),
  ('70e72026-0000-4000-8000-000000000003'::uuid, 'fa272026-0000-4000-8000-000000000003'::uuid, (now() - interval '8 days')),
  ('70e72026-0000-4000-8000-000000000004'::uuid, 'fa272026-0000-4000-8000-000000000004'::uuid, (now() - interval '7 days')),
  ('70e72026-0000-4000-8000-000000000005'::uuid, 'fa272026-0000-4000-8000-000000000005'::uuid, (now() - interval '7 days')),
  ('70e72026-0000-4000-8000-000000000006'::uuid, 'fa272026-0000-4000-8000-000000000006'::uuid, (now() - interval '6 days')),
  ('70e72026-0000-4000-8000-0000000000f1'::uuid, 'fa272026-0000-4000-8000-0000000000f1'::uuid, (now() - interval '6 days')),
  ('70e72026-0000-4000-8000-0000000000f2'::uuid, 'fa272026-0000-4000-8000-0000000000f2'::uuid, (now() - interval '6 days')),
  ('70e72026-0000-4000-8000-0000000000f3'::uuid, 'fa272026-0000-4000-8000-0000000000f3'::uuid, (now() - interval '5 days'))
) as v(vote_id, participant_id, submitted_at)
on conflict (id) do nothing;

-- 5c) 2025 (ARCHIVED) — every participant FINALIZED (long ago).
insert into public.votes (id, edition_id, participant_id, submitted_at)
select
  v.vote_id, 'ed170000-0000-4000-8000-000000002025'::uuid, v.participant_id, v.submitted_at
from (values
  ('70e72025-0000-4000-8000-000000000001'::uuid, 'fa272025-0000-4000-8000-000000000001'::uuid, (timestamptz '2025-08-21 20:00:00-04')),
  ('70e72025-0000-4000-8000-000000000002'::uuid, 'fa272025-0000-4000-8000-000000000002'::uuid, (timestamptz '2025-08-21 21:00:00-04')),
  ('70e72025-0000-4000-8000-000000000003'::uuid, 'fa272025-0000-4000-8000-000000000003'::uuid, (timestamptz '2025-08-20 19:30:00-04')),
  ('70e72025-0000-4000-8000-000000000004'::uuid, 'fa272025-0000-4000-8000-000000000004'::uuid, (timestamptz '2025-08-20 18:00:00-04')),
  ('70e72025-0000-4000-8000-000000000005'::uuid, 'fa272025-0000-4000-8000-000000000005'::uuid, (timestamptz '2025-08-19 22:15:00-04')),
  ('70e72025-0000-4000-8000-000000000006'::uuid, 'fa272025-0000-4000-8000-000000000006'::uuid, (timestamptz '2025-08-19 20:45:00-04')),
  ('70e72025-0000-4000-8000-0000000000f1'::uuid, 'fa272025-0000-4000-8000-0000000000f1'::uuid, (timestamptz '2025-08-18 17:00:00-04')),
  ('70e72025-0000-4000-8000-0000000000f2'::uuid, 'fa272025-0000-4000-8000-0000000000f2'::uuid, (timestamptz '2025-08-18 16:30:00-04')),
  ('70e72025-0000-4000-8000-0000000000f4'::uuid, 'fa272025-0000-4000-8000-0000000000f4'::uuid, (timestamptz '2025-08-17 14:00:00-04'))
) as v(vote_id, participant_id, submitted_at)
on conflict (id) do nothing;


-- =====================================================================
-- 6) VOTE_ANSWERS — the ballot payload.
--    For RANKING questions: each ballot assigns ranks 1..6 to the 6 players
--      as a PERMUTATION, so the unique(vote,question,rank) constraint holds.
--      rank = ((player.display_order + offset) mod 6) + 1, where `offset` is
--      a deterministic per-(vote,question) rotation -> varied but valid.
--    For SINGLE_CHOICE questions: ONE row, rank=1, for the chosen player
--      (chosen = the player at a deterministic rotated slot).
--    edition_id is supplied explicitly (the BEFORE trigger also derives it
--      from the vote; both agree).
--
--    A reusable helper builds the rows for a whole edition from its votes,
--    its players, and its questions. We materialize per-edition with the
--    SAME deterministic recipe.
-- =====================================================================

-- 6a) Ballots are fanned out per edition with one self-contained INSERT each:
--     for every vote × (selected-or-all) question × player, honoring the
--     question format. No helper function/view is used.
-- 6) Bulletins complets (vote_answers) — inliné par édition (pas de fonction :
--    l'exécuteur de seed gère mal le dollar-quoting). Rang déterministe (md5).

-- 6b) 2026 (COMPILATION) — bulletins complets, 40 questions, tous les votants.
insert into public.vote_answers (id, vote_id, question_id, player_id, edition_id, rank)
select
  md5(vt.id::text || qu.id::text || pl.id::text)::uuid,
  vt.id, qu.id, pl.id,
  'ed170000-0000-4000-8000-000000002026'::uuid,
  case
    when qu.format = 'ranking'::public.question_format then
      ((pl.display_order
        + (('x' || substr(md5(vt.id::text || qu.id::text), 1, 4))::bit(16)::int % 6)
       ) % 6) + 1
    else 1
  end as rank
from public.votes vt
join public.questions qu on qu.edition_id = 'ed170000-0000-4000-8000-000000002026'::uuid
join public.players  pl on pl.edition_id = 'ed170000-0000-4000-8000-000000002026'::uuid
where vt.edition_id = 'ed170000-0000-4000-8000-000000002026'::uuid
  and (
    qu.format = 'ranking'::public.question_format
    or pl.display_order = (('x' || substr(md5(vt.id::text || qu.id::text), 5, 4))::bit(16)::int % 6)
  )
on conflict (vote_id, question_id, player_id) do nothing;

-- 6c) 2025 (ARCHIVED) — bulletins complets, 40 questions, tous les votants
--     (les résultats plus bas ne comptent que les 20 sélectionnées).
insert into public.vote_answers (id, vote_id, question_id, player_id, edition_id, rank)
select
  md5(vt.id::text || qu.id::text || pl.id::text)::uuid,
  vt.id, qu.id, pl.id,
  'ed170000-0000-4000-8000-000000002025'::uuid,
  case
    when qu.format = 'ranking'::public.question_format then
      ((pl.display_order
        + (('x' || substr(md5(vt.id::text || qu.id::text), 1, 4))::bit(16)::int % 6)
       ) % 6) + 1
    else 1
  end as rank
from public.votes vt
join public.questions qu on qu.edition_id = 'ed170000-0000-4000-8000-000000002025'::uuid
join public.players  pl on pl.edition_id = 'ed170000-0000-4000-8000-000000002025'::uuid
where vt.edition_id = 'ed170000-0000-4000-8000-000000002025'::uuid
  and (
    qu.format = 'ranking'::public.question_format
    or pl.display_order = (('x' || substr(md5(vt.id::text || qu.id::text), 5, 4))::bit(16)::int % 6)
  )
on conflict (vote_id, question_id, player_id) do nothing;

-- 6d) 2027 (vote OPEN) — PARTIAL ballots:
--     • Finalized voters (Raphaël, Félix, family) answered the first 8
--       questions only (a realistic "did most of it" ballot).
--     • Samuel's DRAFT answered only the first 3 questions.
insert into public.vote_answers (id, vote_id, question_id, player_id, edition_id, rank)
select
  md5(vt.id::text || qu.id::text || pl.id::text)::uuid,
  vt.id, qu.id, pl.id,
  'ed170000-0000-4000-8000-000000002027'::uuid,
  case
    when qu.format = 'ranking'::public.question_format then
      ((pl.display_order
        + (('x' || substr(md5(vt.id::text || qu.id::text), 1, 4))::bit(16)::int % 6)) % 6) + 1
    else 1
  end
from public.votes vt
join public.questions qu
  on qu.edition_id = 'ed170000-0000-4000-8000-000000002027'::uuid
join public.players pl
  on pl.edition_id = 'ed170000-0000-4000-8000-000000002027'::uuid
where vt.edition_id = 'ed170000-0000-4000-8000-000000002027'::uuid
  and (
        -- finalized voters answered first 8 questions; the draft, first 3.
        (vt.submitted_at is not null and qu.position < 8)
     or (vt.submitted_at is null     and qu.position < 3)
      )
  and (
        qu.format = 'ranking'::public.question_format
        or pl.display_order = (('x' || substr(md5(vt.id::text || qu.id::text), 5, 4))::bit(16)::int % 6)
      )
on conflict (vote_id, question_id, player_id) do nothing;


-- =====================================================================
-- 7) RESULTS — frozen Borda/vote snapshot for the ARCHIVED 2025 edition.
--    Computed DIRECTLY from the seeded vote_answers so the cache is exactly
--    consistent with the ballots (mirrors src/lib/scoring: Borda = sum of
--    ranks, lower wins; single_choice = vote count; ESCALATION/TOP_UNIQUE
--    drinks on the players audience only). Only the 20 SELECTED questions are
--    snapshotted (matches snapshotEditionResults, which reads selected ones).
--    An audience with zero ballots is omitted (resultRowsFor behavior).
--
--    final_rank tie-break here: primary score, then #1st-place finishes, then
--    player display_order (deterministic + distinct). The FNV hash tie-break
--    used by the live recompute is unnecessary for a valid cached snapshot.
--    UNIQUE (question_id, player_id, audience).
-- =====================================================================
insert into public.results
  (id, question_id, player_id, borda_score, vote_count, final_rank, drinks, audience)
with
ed as (
  select 'ed170000-0000-4000-8000-000000002025'::uuid as edition_id, shooter_value, drink_rule
  from public.editions where id = 'ed170000-0000-4000-8000-000000002025'::uuid
),
-- one row per (question, audience, player) with raw aggregates
agg as (
  select
    qu.id              as question_id,
    qu.format          as format,
    coalesce(qu.drink_rule_override, ed.drink_rule) as drink_rule,
    pa.kind            as audience_kind,           -- 'player' | 'jury'
    pl.id              as player_id,
    pl.display_order   as display_order,
    -- Borda: sum of ranks for ranking questions (lower = better).
    sum(case when qu.format = 'ranking'::public.question_format then va.rank else 0 end) as borda_sum,
    -- vote_count: times chosen for single_choice questions.
    sum(case when qu.format = 'single_choice'::public.question_format and va.rank = 1 then 1 else 0 end) as choice_count,
    -- #first-place finishes (rank 1) — tie-break + (for single_choice) the metric.
    sum(case when va.rank = 1 then 1 else 0 end) as first_count,
    count(va.id) as answer_rows
  from ed
  join public.questions qu
    on qu.edition_id = ed.edition_id and qu.is_selected_for_show = true
  join public.players pl
    on pl.edition_id = ed.edition_id
  join public.votes vt
    on vt.edition_id = ed.edition_id
  join public.participants pa
    on pa.id = vt.participant_id
  left join public.vote_answers va
    on va.vote_id = vt.id and va.question_id = qu.id and va.player_id = pl.id
  group by qu.id, qu.format, coalesce(qu.drink_rule_override, ed.drink_rule),
           pa.kind, pl.id, pl.display_order, ed.drink_rule
),
-- did this (question,audience) receive ANY ballot? (else omit the audience)
audience_has_ballots as (
  select question_id, audience_kind, sum(answer_rows) as total_rows
  from agg group by question_id, audience_kind
),
ranked as (
  select
    a.*,
    row_number() over (
      partition by a.question_id, a.audience_kind
      order by
        case when a.format = 'ranking'::public.question_format then a.borda_sum end asc,
        case when a.format = 'single_choice'::public.question_format then a.choice_count end desc,
        a.first_count desc,
        a.display_order asc
    ) as final_rank,
    count(*) over (partition by a.question_id, a.audience_kind) as n_players,
    -- is this player tied for 1st? (shares the best primary metric in the group)
    case
      when a.format = 'ranking'::public.question_format
        then a.borda_sum = min(a.borda_sum) over (partition by a.question_id, a.audience_kind)
      else a.choice_count = max(a.choice_count) over (partition by a.question_id, a.audience_kind)
    end as tied_for_win
  from agg a
  join audience_has_ballots h
    on h.question_id = a.question_id and h.audience_kind = a.audience_kind
  where h.total_rows > 0
)
select
  md5(r.question_id::text || r.player_id::text ||
      (case when r.audience_kind = 'player' then 'players' else 'jury' end))::uuid as id,
  r.question_id,
  r.player_id,
  case when r.format = 'ranking'::public.question_format then r.borda_sum::int else null end as borda_score,
  case when r.format = 'single_choice'::public.question_format then r.choice_count::int else null end as vote_count,
  r.final_rank::int,
  -- drinks: ONLY the players audience drinks; jury audience always 0.
  case
    when r.audience_kind = 'jury' then 0
    when r.drink_rule = 'TOP_UNIQUE'::public.drink_rule then
      case when r.tied_for_win then (select shooter_value from ed) else 0 end
    else  -- ESCALATION: rank r gorgées, last place drinks a shooter instead.
      case when r.final_rank = r.n_players then (select shooter_value from ed) else r.final_rank end
  end::numeric(6,2) as drinks,
  (case when r.audience_kind = 'player' then 'players' else 'jury' end)::public.result_audience as audience
from ranked r
on conflict (question_id, player_id, audience) do nothing;


-- =====================================================================
-- 8) NOTIFICATIONS — admin in-app feed.
--    kind is free text (schema default 'vote_submitted'); the app renders
--    message + kind generically. participant_id may be NULL (edition-level
--    events). We mix vote_submitted (per finalized ballot) with edition
--    lifecycle events (vote_closed, results_compiled, edition_archived,
--    participant_joined). A few stay UNREAD (read_at NULL) so the bell shows
--    a badge; older ones are marked read.
--    notification UUID scheme: 0071000e-…  (Y = year tag in last block).
-- =====================================================================

-- 8a) 2027 (vote OPEN) — recent submissions; the latest two are UNREAD.
insert into public.notifications (id, edition_id, participant_id, kind, message, created_at, read_at)
values
  ('00710000-0000-4000-8000-000000270001'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'fa272027-0000-4000-8000-000000000001'::uuid, 'vote_submitted', 'Raphaël Tremblay a envoyé son vote.',     now() - interval '5 days', now() - interval '4 days'),
  ('00710000-0000-4000-8000-000000270002'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'fa272027-0000-4000-8000-000000000002'::uuid, 'vote_submitted', 'Félix Lachance a envoyé son vote.',      now() - interval '3 days', null),
  ('00710000-0000-4000-8000-000000270003'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'fa272027-0000-4000-8000-0000000000f1'::uuid, 'vote_submitted', 'Danielle Tremblay a envoyé son vote.',      now() - interval '2 days', null),
  ('00710000-0000-4000-8000-000000270004'::uuid, 'ed170000-0000-4000-8000-000000002027'::uuid, 'fa272027-0000-4000-8000-0000000000f1'::uuid, 'participant_joined', 'Danielle Tremblay a rejoint l''édition 2027 (entourage).', now() - interval '6 days', now() - interval '5 days')
on conflict (id) do nothing;

-- 8b) 2026 (COMPILATION) — all ballots in, then vote closed + compiled.
insert into public.notifications (id, edition_id, participant_id, kind, message, created_at, read_at)
values
  ('00710000-0000-4000-8000-000000260001'::uuid, 'ed170000-0000-4000-8000-000000002026'::uuid, 'fa272026-0000-4000-8000-000000000002'::uuid, 'vote_submitted', 'Félix Lachance a envoyé son vote.',      now() - interval '8 days', now() - interval '8 days'),
  ('00710000-0000-4000-8000-000000260002'::uuid, 'ed170000-0000-4000-8000-000000002026'::uuid, 'fa272026-0000-4000-8000-000000000003'::uuid, 'vote_submitted', 'Samuel Painchaud a envoyé son vote.',    now() - interval '8 days', now() - interval '8 days'),
  ('00710000-0000-4000-8000-000000260003'::uuid, 'ed170000-0000-4000-8000-000000002026'::uuid, 'fa272026-0000-4000-8000-0000000000f3'::uuid, 'vote_submitted', 'Rosalie Painchaud a envoyé son vote.',       now() - interval '5 days', now() - interval '5 days'),
  ('00710000-0000-4000-8000-000000260004'::uuid, 'ed170000-0000-4000-8000-000000002026'::uuid, null,                                          'vote_closed',    'Le vote de l''édition 2026 est fermé. La compilation peut commencer.', now() - interval '4 days', null)
on conflict (id) do nothing;

-- 8c) 2025 (ARCHIVED) — historical: compiled, then archived. All read.
insert into public.notifications (id, edition_id, participant_id, kind, message, created_at, read_at)
values
  ('00710000-0000-4000-8000-000000250001'::uuid, 'ed170000-0000-4000-8000-000000002025'::uuid, 'fa272025-0000-4000-8000-000000000005'::uuid, 'vote_submitted',   'Nicolas Ouellet a envoyé son vote.',           timestamptz '2025-08-19 22:15:00-04', timestamptz '2025-08-20 09:00:00-04'),
  ('00710000-0000-4000-8000-000000250002'::uuid, 'ed170000-0000-4000-8000-000000002025'::uuid, 'fa272025-0000-4000-8000-0000000000f4'::uuid, 'vote_submitted',   'Gilles Beaulieu a envoyé son vote.',          timestamptz '2025-08-17 14:00:00-04', timestamptz '2025-08-17 18:00:00-04'),
  ('00710000-0000-4000-8000-000000250003'::uuid, 'ed170000-0000-4000-8000-000000002025'::uuid, null,                                          'results_compiled', 'Les classements de l''édition 2025 ont été compilés.', timestamptz '2025-08-23 12:00:00-04', timestamptz '2025-08-23 12:30:00-04'),
  ('00710000-0000-4000-8000-000000250004'::uuid, 'ed170000-0000-4000-8000-000000002025'::uuid, null,                                          'edition_archived', 'L''édition 2025 a été archivée. Les résultats sont publics.',          timestamptz '2025-08-30 02:00:00-04', timestamptz '2025-08-30 10:00:00-04')
on conflict (id) do nothing;


-- =====================================================================
-- 9) APPLY THE REAL LIFECYCLE STATES.
--    Done LAST so all questions/votes/answers/results were inserted while the
--    editions were still CONSTRUCTION (the questions_edit_lock trigger only
--    permits question INSERT/DELETE in CONSTRUCTION). Flipping editions.state
--    touches no question rows, so the trigger does not fire here.
--      2028 -> stays CONSTRUCTION   2027 -> SENT_FOR_VOTE
--      2026 -> COMPILATION          2025 -> ARCHIVED
-- =====================================================================
update public.editions set state = 'SENT_FOR_VOTE'::public.edition_state
  where id = 'ed170000-0000-4000-8000-000000002027'::uuid;
update public.editions set state = 'COMPILATION'::public.edition_state
  where id = 'ed170000-0000-4000-8000-000000002026'::uuid;
update public.editions set state = 'ARCHIVED'::public.edition_state
  where id = 'ed170000-0000-4000-8000-000000002025'::uuid;
-- 2028 intentionally remains CONSTRUCTION (the draft edition).

-- (No tidy step needed: the seed no longer creates any helper table or
--  function. Every statement is fully self-contained, so nothing the seed
--  makes is referenced later — which is what the Supabase seed runner
--  requires when it executes the file in separate batches.)

-- (commit implicite : autocommit, voir note en haut)

-- =====================================================================
-- DEV LOGIN  (created above, password is the same for every seeded account)
--   Admin / owner :  raphael@brunos.local     / Password123!
--   Players       :  felix@brunos.local, samuel@brunos.local,
--                    vincent@brunos.local, nicolas@brunos.local,
--                    gabriel@brunos.local                  (/ Password123!)
--   Entourage     :  danielle@brunos.local, camille@brunos.local,
--                    rosalie@brunos.local, gilles@brunos.local   (/ Password123!)
--
-- WHAT YOU CAN TEST
--   • 2028 — CONSTRUCTION : log in as admin, edit/reorder the 5 draft
--            questions, open the vote.
--   • 2027 — SENT_FOR_VOTE: vote is OPEN (deadline 2026-08-28). Log in as
--            Samuel to resume a draft ballot; as Vincent/Nicolas/Gabriel
--            to start fresh; submit_ballot finalizes + notifies the admin.
--   • 2026 — COMPILATION  : vote closed, 40 questions, every ballot in.
--            As admin, curate the show selection + run the equalizer/compile.
--   • 2025 — ARCHIVED     : presentation done. 40 questions / 20 selected,
--            frozen Borda + drink results, family ballots, post-archive vote
--            transparency ("qui a voté pour qui") visible to participants.
-- =====================================================================

-- =====================================================================
-- 10) FILET — RATTACHEMENT AU CERCLE
--     Les fiches `people` naissent de déclencheurs (création de compte,
--     auto-inscription) qui ignorent tout des cercles. On ramasse ici
--     celles qui seraient apparues après la section 0b-bis.
-- =====================================================================
update public.people set circle_id = 'c1c1e000-0000-4000-8000-000000000001' where circle_id is null;
