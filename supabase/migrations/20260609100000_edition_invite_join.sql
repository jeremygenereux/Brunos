-- =====================================================================
-- Les Brunos — Shared-invite-link participation.
--
-- editions.invite_token: unguessable token for the join link.
-- edition_join_info(token): SECURITY DEFINER lookup powering the join page
--   (a not-yet-participant cannot SELECT the edition under RLS).
-- join_edition(token, kind, ...): SECURITY DEFINER self-join — creates the
--   caller's participants row (participants writes are otherwise admin-only).
-- Neither exposes votes/results; the token is the access control.
-- =====================================================================

alter table public.editions
  add column if not exists invite_token uuid not null default gen_random_uuid();

create unique index if not exists editions_invite_token_key
  on public.editions (invite_token);

-- ---------------------------------------------------------------------
create or replace function public.edition_join_info(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select jsonb_build_object(
    'id', e.id,
    'name', e.name,
    'state', e.state,
    'event_at', e.event_at,
    'venue_name', e.venue_name,
    'already_participant', exists (
      select 1 from public.participants pa
      where pa.edition_id = e.id and pa.user_id = auth.uid()
    ),
    'players', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', pl.id, 'display_name', pe.display_name)
        order by pl.display_order
      )
      from public.players pl
      join public.people pe on pe.id = pl.person_id
      where pl.edition_id = e.id
    ), '[]'::jsonb)
  )
  from public.editions e
  where e.invite_token = p_token;
$$;

-- ---------------------------------------------------------------------
create or replace function public.join_edition(
  p_token uuid,
  p_kind public.participant_kind,
  p_linked_player uuid default null,
  p_relation text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_edition uuid;
  v_state public.edition_state;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  select e.id, e.state into v_edition, v_state
  from public.editions e
  where e.invite_token = p_token;

  if v_edition is null then
    raise exception 'Invitation invalide' using errcode = 'no_data_found';
  end if;
  if v_state = 'ARCHIVED'::public.edition_state then
    raise exception 'Cette édition est archivée' using errcode = 'check_violation';
  end if;

  if p_kind = 'jury'::public.participant_kind then
    if p_linked_player is null
       or p_relation is null
       or length(btrim(p_relation)) = 0 then
      raise exception 'Le jury doit indiquer son lien avec un joueur'
        using errcode = 'check_violation';
    end if;
    if not exists (
      select 1 from public.players
      where id = p_linked_player and edition_id = v_edition
    ) then
      raise exception 'Joueur lié invalide' using errcode = 'check_violation';
    end if;
  end if;

  insert into public.participants (edition_id, user_id, kind, linked_player_id, relation_label)
  values (
    v_edition,
    auth.uid(),
    p_kind,
    case when p_kind = 'jury'::public.participant_kind then p_linked_player else null end,
    case when p_kind = 'jury'::public.participant_kind then btrim(p_relation) else null end
  )
  on conflict (edition_id, user_id) do update
    set kind = excluded.kind,
        linked_player_id = excluded.linked_player_id,
        relation_label = excluded.relation_label;

  return v_edition;
end;
$$;

revoke execute on function public.edition_join_info(uuid) from public;
grant execute on function public.edition_join_info(uuid) to authenticated;
revoke execute on function public.join_edition(uuid, public.participant_kind, uuid, text) from public;
grant execute on function public.join_edition(uuid, public.participant_kind, uuid, text) to authenticated;
