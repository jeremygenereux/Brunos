-- Per-participant Apple Invitation URL (set by the admin in the edition). When
-- present, the participant sees a "view invitation" button on their home.
-- Replaces the internal RSVP UI (the rsvp column is left in place, unused).
alter table public.participants add column if not exists apple_invite_url text;

-- Keep apple_invite_url admin-only: add it to the non-admin self-update guard's
-- immutable list (the guard whitelists columns that a self-update may NOT
-- change; only rsvp stays mutable for non-admins).
create or replace function public.tg_participants_self_update_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if    new.id               is distinct from old.id
     or new.edition_id       is distinct from old.edition_id
     or new.user_id          is distinct from old.user_id
     or new.kind             is distinct from old.kind
     or new.linked_player_id is distinct from old.linked_player_id
     or new.relation_label   is distinct from old.relation_label
     or new.apple_invite_url  is distinct from old.apple_invite_url
  then
    raise exception
      'Self-service updates may only change rsvp; other columns are admin-only.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;
