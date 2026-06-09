-- =====================================================================
-- Les Brunos — Harden function EXECUTE grants
-- Reduces the PostgREST RPC surface flagged by Supabase advisors 0028/0029.
-- Supabase's default privileges grant EXECUTE on new public functions to
-- anon + authenticated; this migration tightens that.
--
-- Safety:
--   * Trigger-only functions never need RPC access. A trigger fires the
--     function regardless of the triggering role's EXECUTE privilege, so
--     revoking from anon + authenticated is safe (triggers keep working).
--   * RLS helper functions stay EXECUTE-able by `authenticated` (their grants
--     are required when policies evaluate them), but anon never reaches them
--     (anon has no policies on app tables), so anon's grant is dropped.
--   * admin_unlock_questions is internally guarded by is_admin(); keep it
--     callable by authenticated (the admin), drop anon.
-- =====================================================================

-- Trigger-only functions: revoke from both app roles.
revoke execute on function public.set_updated_at()                    from anon, authenticated;
revoke execute on function public.handle_new_user()                   from anon, authenticated;
revoke execute on function public.tg_questions_edit_lock()            from anon, authenticated;
revoke execute on function public.tg_vote_answers_set_edition()       from anon, authenticated;
revoke execute on function public.tg_participants_self_update_guard() from anon, authenticated;

-- RLS helpers + admin RPC: drop anon, keep authenticated.
revoke execute on function public.user_role()                          from anon;
revoke execute on function public.is_admin()                           from anon;
revoke execute on function public.is_edition_participant(uuid)         from anon;
revoke execute on function public.current_participant_id(uuid)         from anon;
revoke execute on function public.edition_accepts_votes(uuid)          from anon;
revoke execute on function public.edition_is_archived(uuid)            from anon;
revoke execute on function public.edition_of_question(uuid)            from anon;
revoke execute on function public.vote_belongs_to_caller(uuid)         from anon;
revoke execute on function public.vote_is_in_open_window(uuid)         from anon;
revoke execute on function public.vote_answer_is_consistent(uuid, uuid, uuid) from anon;
revoke execute on function public.current_person_id()                 from anon;
revoke execute on function public.person_is_edition_nominee_for_caller(uuid) from anon;
revoke execute on function public.admin_unlock_questions(uuid, boolean) from anon;
