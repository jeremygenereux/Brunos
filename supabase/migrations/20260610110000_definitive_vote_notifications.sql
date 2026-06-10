-- =====================================================================
-- Les Brunos — definitive vote + admin in-app notifications.
--
-- A ballot becomes FINAL on submit: once votes.submitted_at is set, the voter
-- can no longer change anything. All ballot writes go through the SECURITY
-- DEFINER submit_ballot() RPC, which finalizes atomically and drops an admin
-- notification. The direct-client RLS is also tightened (defense in depth) so
-- a submitted ballot can't be edited even via the API.
-- =====================================================================

-- A ballot is editable only while the window is open AND it isn't finalized.
create or replace function public.vote_is_editable(p_vote uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.vote_is_in_open_window(p_vote)
     and not exists (
       select 1 from public.votes v where v.id = p_vote and v.submitted_at is not null
     );
$$;

-- vote_answers: writes require an EDITABLE (not finalized) ballot.
drop policy if exists vote_answers_insert_owner_open on public.vote_answers;
create policy vote_answers_insert_owner_open on public.vote_answers
  for insert to authenticated
  with check (
    public.vote_belongs_to_caller(vote_id)
    and public.vote_is_editable(vote_id)
    and public.vote_answer_is_consistent(vote_id, question_id, player_id)
  );

drop policy if exists vote_answers_update_owner_open on public.vote_answers;
create policy vote_answers_update_owner_open on public.vote_answers
  for update to authenticated
  using (public.vote_belongs_to_caller(vote_id) and public.vote_is_editable(vote_id))
  with check (
    public.vote_belongs_to_caller(vote_id)
    and public.vote_is_editable(vote_id)
    and public.vote_answer_is_consistent(vote_id, question_id, player_id)
  );

drop policy if exists vote_answers_delete_owner_open on public.vote_answers;
create policy vote_answers_delete_owner_open on public.vote_answers
  for delete to authenticated
  using (public.vote_belongs_to_caller(vote_id) and public.vote_is_editable(vote_id));

-- votes: a finalized ballot can't be touched directly anymore.
drop policy if exists votes_update_owner_open on public.votes;
create policy votes_update_owner_open on public.votes
  for update to authenticated
  using (
    participant_id = public.current_participant_id(edition_id)
    and public.edition_accepts_votes(edition_id)
    and submitted_at is null
  )
  with check (
    participant_id = public.current_participant_id(edition_id)
    and public.edition_accepts_votes(edition_id)
  );

drop policy if exists votes_delete_owner_open on public.votes;
create policy votes_delete_owner_open on public.votes
  for delete to authenticated
  using (
    participant_id = public.current_participant_id(edition_id)
    and public.edition_accepts_votes(edition_id)
    and submitted_at is null
  );

-- ---------------------------------------------------------------------
-- Notifications — admin-facing in-app feed.
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  edition_id     uuid not null references public.editions (id) on delete cascade,
  participant_id uuid references public.participants (id) on delete set null,
  kind           text not null default 'vote_submitted',
  message        text not null,
  created_at     timestamptz not null default now(),
  read_at        timestamptz
);
create index if not exists notifications_unread_idx
  on public.notifications (created_at desc) where read_at is null;

alter table public.notifications enable row level security;
alter table public.notifications force row level security;

drop policy if exists notifications_select_admin on public.notifications;
create policy notifications_select_admin on public.notifications
  for select to authenticated using (public.is_admin());

drop policy if exists notifications_update_admin on public.notifications;
create policy notifications_update_admin on public.notifications
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists notifications_delete_admin on public.notifications;
create policy notifications_delete_admin on public.notifications
  for delete to authenticated using (public.is_admin());

-- No INSERT policy: only the SECURITY DEFINER submit_ballot() (owner) inserts.
grant select, update, delete on public.notifications to authenticated;

-- ---------------------------------------------------------------------
-- submit_ballot(): finalize the caller's ballot atomically + notify admin.
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
    raise exception 'Tu ne participes pas à cette édition.' using errcode = 'check_violation';
  end if;
  if not public.edition_accepts_votes(p_edition) then
    raise exception 'Le vote n''est pas ouvert.' using errcode = 'check_violation';
  end if;

  select id into v_vote
  from public.votes
  where edition_id = p_edition and participant_id = v_participant;

  if v_vote is not null
     and (select submitted_at from public.votes where id = v_vote) is not null then
    raise exception 'Ton vote a déjà été envoyé.' using errcode = 'check_violation';
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

revoke execute on function public.submit_ballot(uuid, jsonb) from public;
grant execute on function public.submit_ballot(uuid, jsonb) to authenticated;
