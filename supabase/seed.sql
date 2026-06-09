-- =====================================================================
-- Les Brunos — Local development seed (SAFE: no fake auth.users)
--
-- Loaded by `supabase db reset` AFTER the migration, per
-- supabase/config.toml -> [db.seed] sql_paths = ["./seed.sql"].
--
-- SCOPE / SAFETY
--   This seed inserts ONLY data that does not depend on real authentication:
--     * one sample edition in CONSTRUCTION,
--     * a handful of `people` (pure nominees, auth_user_id = NULL),
--     * the matching `players` (answer choices) with placeholder headshots,
--     * a few sample `questions` of both formats (ranking + single_choice).
--   It deliberately does NOT insert into auth.users, profiles, participants,
--   votes, or vote_answers — those require real Supabase Auth accounts. Sign
--   up through the app to create them (the on_auth_user_created trigger
--   provisions a `people` + `profiles` row automatically), then promote
--   yourself to admin using the snippet at the bottom of this file.
--
-- WHY FIXED UUIDS
--   The schema defaults every id to gen_random_uuid(); to let `players`/
--   `questions` reference a known `people`/`edition` and to keep the seed
--   idempotent (safe to re-run), we pin explicit UUID literals (valid hex,
--   8-4-4-4-12) and guard every insert with ON CONFLICT DO NOTHING.
--
-- RLS NOTE
--   `supabase db reset` runs this file as the `postgres` superuser, which
--   bypasses RLS (including FORCE ROW LEVEL SECURITY), so these inserts are
--   not blocked by the admin-only write policies. Do not run this seed from
--   an end-user (anon/authenticated) connection — it would be denied.
--
-- EDIT-LOCK NOTE
--   The edition stays in CONSTRUCTION, so the questions_edit_lock trigger
--   permits inserting/editing questions freely.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) Sample edition (CONSTRUCTION). Leave vote_deadline NULL for now.
-- ---------------------------------------------------------------------
insert into public.editions (id, name, year, event_at, venue_name, venue_address, description, state, drink_rule)
values (
  'ed171000-0000-4000-8000-000000000001',
  'Les Brunos 2026 (DEV)',
  2026,
  '2026-12-19 19:00:00+00',
  'Le Salon Doré',
  '123 rue du Gala, Montréal, QC',
  'Édition de développement local. Données factices, aucun compte réel requis.',
  'CONSTRUCTION',
  'ESCALATION'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2) People — pure nominees, NO auth account (auth_user_id stays NULL).
--    These exist independently of Supabase Auth; that is the whole point.
-- ---------------------------------------------------------------------
insert into public.people (id, display_name, auth_user_id) values
  ('bea11111-0000-4000-8000-000000000001', 'Jérémy',  null),
  ('bea11111-0000-4000-8000-000000000002', 'Alex',    null),
  ('bea11111-0000-4000-8000-000000000003', 'Sam',     null),
  ('bea11111-0000-4000-8000-000000000004', 'Charlie', null),
  ('bea11111-0000-4000-8000-000000000005', 'Robin',   null),
  ('bea11111-0000-4000-8000-000000000006', 'Maxime',  null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 3) Players — each person's participation in the edition (= answer
--    choices). Placeholder headshot_url (no real upload required).
--    display_order is unique per edition; keep it contiguous from 0.
-- ---------------------------------------------------------------------
insert into public.players (id, edition_id, person_id, headshot_url, display_order) values
  ('b1a50000-0000-4000-8000-000000000001', 'ed171000-0000-4000-8000-000000000001', 'bea11111-0000-4000-8000-000000000001', 'https://placehold.co/512x512/0a0a0b/d4af37.png?text=Jeremy',  0),
  ('b1a50000-0000-4000-8000-000000000002', 'ed171000-0000-4000-8000-000000000001', 'bea11111-0000-4000-8000-000000000002', 'https://placehold.co/512x512/0a0a0b/d4af37.png?text=Alex',    1),
  ('b1a50000-0000-4000-8000-000000000003', 'ed171000-0000-4000-8000-000000000001', 'bea11111-0000-4000-8000-000000000003', 'https://placehold.co/512x512/0a0a0b/d4af37.png?text=Sam',     2),
  ('b1a50000-0000-4000-8000-000000000004', 'ed171000-0000-4000-8000-000000000001', 'bea11111-0000-4000-8000-000000000004', 'https://placehold.co/512x512/0a0a0b/d4af37.png?text=Charlie', 3),
  ('b1a50000-0000-4000-8000-000000000005', 'ed171000-0000-4000-8000-000000000001', 'bea11111-0000-4000-8000-000000000005', 'https://placehold.co/512x512/0a0a0b/d4af37.png?text=Robin',   4),
  ('b1a50000-0000-4000-8000-000000000006', 'ed171000-0000-4000-8000-000000000001', 'bea11111-0000-4000-8000-000000000006', 'https://placehold.co/512x512/0a0a0b/d4af37.png?text=Maxime',  5)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 4) Questions — both formats. Not yet selected for the show, so
--    is_selected_for_show=false and show_order stays NULL (enforced by
--    questions_show_order_consistency_chk). position is unique per edition.
--    One question overrides the edition drink_rule to TOP_UNIQUE as a demo.
-- ---------------------------------------------------------------------
insert into public.questions (id, edition_id, prompt, format, position, drink_rule_override) values
  ('b00e0000-0000-4000-8000-000000000001', 'ed171000-0000-4000-8000-000000000001', 'Qui est le plus susceptible de se marier en premier ?',   'ranking',       0, null),
  ('b00e0000-0000-4000-8000-000000000002', 'ed171000-0000-4000-8000-000000000001', 'Qui est le plus susceptible de devenir célèbre ?',        'ranking',       1, null),
  ('b00e0000-0000-4000-8000-000000000003', 'ed171000-0000-4000-8000-000000000001', 'Qui arriverait en retard à sa propre soirée ?',           'single_choice', 2, null),
  ('b00e0000-0000-4000-8000-000000000004', 'ed171000-0000-4000-8000-000000000001', 'Qui finirait en prison pour la cause la plus absurde ?',  'single_choice', 3, 'TOP_UNIQUE'),
  ('b00e0000-0000-4000-8000-000000000005', 'ed171000-0000-4000-8000-000000000001', 'Qui est le plus susceptible de pleurer devant un film ?', 'ranking',       4, null)
on conflict (id) do nothing;

commit;

-- =====================================================================
-- HOW TO PROMOTE A SIGNED-UP USER TO ADMIN  (run manually, NOT auto-seeded)
--
-- The seed above intentionally creates no accounts. To get an admin:
--   1. Start the stack:           supabase start   (or `supabase db reset`)
--   2. Sign up in the app (or via Studio > Authentication) with email +
--      password. The on_auth_user_created trigger auto-creates the matching
--      public.people + public.profiles rows (default role = 'player').
--   3. Promote that user to admin by running ONE of the snippets below in
--      the SQL editor (Studio) or `supabase db` psql shell, as the
--      postgres/service role (RLS-bypassing) — NOT from the app client.
--
-- By email (most convenient):
--
--   update public.profiles p
--   set role = 'admin'
--   from auth.users u
--   where u.id = p.user_id
--     and u.email = 'you@example.com';
--
-- By auth user id:
--
--   update public.profiles
--   set role = 'admin'
--   where user_id = '<auth-user-uuid>';
--
-- (Optional) Link the new admin's person to one of the seeded nominees so
-- their cross-edition stats line up with a seeded player — only if desired.
-- profiles.person_id is UNIQUE (profiles_person_id_key), so first free the
-- target person from the auto-created profile, then point at the seeded one:
--
--   update public.profiles
--   set person_id = 'bea11111-0000-4000-8000-000000000001'  -- Jérémy
--   where user_id = '<auth-user-uuid>';
-- =====================================================================
