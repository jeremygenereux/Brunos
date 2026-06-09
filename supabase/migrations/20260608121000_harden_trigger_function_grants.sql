-- =====================================================================
-- Les Brunos — Harden trigger-function EXECUTE grants (follow-up to 0002)
--
-- Supabase grants EXECUTE on new public functions to anon/authenticated BOTH
-- directly AND via PUBLIC. Migration 0002 revoked the DIRECT grants on the
-- trigger-only functions but left the PUBLIC grant, so anon/authenticated
-- could still reach them. The RLS helpers were already revoked from PUBLIC in
-- the initial migration (section 7b), which is why only the trigger functions
-- need this.
--
-- Revoking from PUBLIC removes the remaining path. Triggers fire the function
-- regardless of the invoking role's EXECUTE privilege, so this is safe.
-- =====================================================================

revoke execute on function public.set_updated_at()                    from public;
revoke execute on function public.handle_new_user()                   from public;
revoke execute on function public.tg_questions_edit_lock()            from public;
revoke execute on function public.tg_vote_answers_set_edition()       from public;
revoke execute on function public.tg_participants_self_update_guard() from public;
