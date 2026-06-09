-- =====================================================================
-- Les Brunos — set_question_selection(): persist the COMPILATION curation.
--
-- Clears the current show-selection, then marks the given ordered questions
-- as is_selected_for_show with show_order 0..K-1, in ONE transaction so the
-- DEFERRABLE unique(edition_id, show_order) constraint only checks at commit.
-- Admin-gated. is_selected_for_show / show_order are "curation" columns, so the
-- question-edit-lock trigger permits this in COMPILATION (and later states).
-- =====================================================================

create or replace function public.set_question_selection(p_edition uuid, p_ordered_ids uuid[])
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin may set the question selection'
      using errcode = 'insufficient_privilege';
  end if;

  update public.questions
  set is_selected_for_show = false, show_order = null
  where edition_id = p_edition
    and (is_selected_for_show = true or show_order is not null);

  update public.questions q
  set is_selected_for_show = true, show_order = (t.ord - 1)::int
  from unnest(p_ordered_ids) with ordinality as t(id, ord)
  where q.id = t.id
    and q.edition_id = p_edition;
end;
$$;

revoke execute on function public.set_question_selection(uuid, uuid[]) from public;
grant execute on function public.set_question_selection(uuid, uuid[]) to authenticated;
