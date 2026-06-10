-- =====================================================================
-- Les Brunos — post-archive vote transparency (spec §10).
--
-- Product decision: once an edition is ARCHIVED, the gala's ballots become
-- public to its PARTICIPANTS — "qui a voté pour qui" + drama cards. This
-- extends the SELECT policies on votes / vote_answers / participants with the
-- SAME archived-participant predicate already used by `results`
-- (is_edition_participant(edition) AND edition_is_archived(edition)).
--
-- Vote secrecy is UNCHANGED for every non-archived state (CONSTRUCTION …
-- LIVE): a voter still sees only their own ballot until the edition is
-- archived. Admins always see everything. Only SELECT is touched — the
-- insert/update/delete (owner + open-window) policies are left intact.
-- =====================================================================

-- 1) vote_answers — the raw ballots (vote → question → player + rank).
drop policy if exists vote_answers_select_owner_or_admin on public.vote_answers;
create policy vote_answers_select_owner_or_admin on public.vote_answers
  for select to authenticated
  using (
    public.is_admin()
    or public.vote_belongs_to_caller(vote_id)
    or (
      public.is_edition_participant(edition_id)
      and public.edition_is_archived(edition_id)
    )
  );

-- 2) votes — maps a ballot to its participant (the voter).
drop policy if exists votes_select_owner_or_admin on public.votes;
create policy votes_select_owner_or_admin on public.votes
  for select to authenticated
  using (
    public.is_admin()
    or (participant_id = public.current_participant_id(edition_id))
    or (
      public.is_edition_participant(edition_id)
      and public.edition_is_archived(edition_id)
    )
  );

-- 3) participants — needed to NAME the voters (kind, linked_player_id, …).
drop policy if exists participants_select_self_or_admin on public.participants;
create policy participants_select_self_or_admin on public.participants
  for select to authenticated
  using (
    public.is_admin()
    or (user_id = auth.uid())
    or (
      public.is_edition_participant(edition_id)
      and public.edition_is_archived(edition_id)
    )
  );
