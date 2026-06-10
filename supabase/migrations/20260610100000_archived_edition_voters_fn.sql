-- =====================================================================
-- Les Brunos — archived_edition_voters(): resolve voter display names for
-- the post-archive "qui a voté pour qui" reveal (spec §10).
--
-- The people SELECT RLS only exposes nominees + self, so a participant viewing
-- an archived edition can't always name every voter (e.g. a non-nominee voter).
-- This SECURITY DEFINER function resolves each participant's display name via
-- their auth user → people, gated to admins OR participants of an ARCHIVED
-- edition (the same transparency predicate as the votes/results policies).
-- =====================================================================

create or replace function public.archived_edition_voters(p_edition uuid)
returns table (participant_id uuid, person_id uuid, display_name text, kind text)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select
    pa.id as participant_id,
    pe.id as person_id,
    coalesce(
      pe.display_name,
      pa.relation_label,
      case when pa.kind = 'jury'::public.participant_kind then 'Entourage' else 'Joueur' end
    ) as display_name,
    pa.kind::text as kind
  from public.participants pa
  left join public.people pe on pe.auth_user_id = pa.user_id
  where pa.edition_id = p_edition
    and (
      public.is_admin()
      or (public.is_edition_participant(p_edition) and public.edition_is_archived(p_edition))
    );
$$;

revoke execute on function public.archived_edition_voters(uuid) from public;
grant execute on function public.archived_edition_voters(uuid) to authenticated;
