-- =====================================================================
-- Les Brunos — reorder_questions(): atomic drag-and-drop reordering.
--
-- Sets questions.position = index-in-array for the given edition, in ONE
-- statement so the DEFERRABLE unique(edition_id, position) constraint is
-- only checked at commit (transient duplicates during the update are fine).
-- Admin-gated; the question-edit-lock trigger still applies, so reordering
-- is only possible while the edition is in CONSTRUCTION.
-- =====================================================================

create or replace function public.reorder_questions(p_edition uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin may reorder questions'
      using errcode = 'insufficient_privilege';
  end if;

  update public.questions q
  set position = (t.ord - 1)::int
  from unnest(p_ids) with ordinality as t(id, ord)
  where q.id = t.id
    and q.edition_id = p_edition;
end;
$$;

revoke execute on function public.reorder_questions(uuid, uuid[]) from public;
grant execute on function public.reorder_questions(uuid, uuid[]) to authenticated;
