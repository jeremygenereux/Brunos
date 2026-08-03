-- =====================================================================
-- Les Brunos — Correctif : supprimer une édition était impossible.
--
-- SYMPTÔME
--   « Questions are locked: edition … is in state <NULL> (not CONSTRUCTION) »
--   au moment de supprimer une édition, quel que soit son état.
--
-- CAUSE
--   `DELETE FROM editions` fait cascader la suppression vers `questions`, ce
--   qui déclenche `questions_edit_lock`. Le trigger relit l'état de l'édition
--   parente… mais elle vient d'être supprimée dans la même commande : le
--   SELECT ne ramène rien, v_state vaut NULL, aucune branche autorisante ne
--   correspond, et l'exception finale bloque la cascade.
--
-- CORRECTIF
--   Si l'édition parente n'existe plus, il n'y a plus rien à protéger : on
--   laisse passer. Le verrou reste intact pour toutes les éditions vivantes —
--   c'est bien l'absence de parent, et non un état permissif, qui autorise.
-- =====================================================================

create or replace function public.tg_questions_edit_lock()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_state         public.edition_state;
  v_edition       uuid;
  v_override      boolean;
  v_only_curation boolean;
begin
  v_edition := coalesce(new.edition_id, old.edition_id);

  select e.state into v_state
  from public.editions e
  where e.id = v_edition;

  -- L'édition parente a disparu : nous sommes dans la cascade d'un DELETE
  -- d'édition. Plus rien à verrouiller.
  if v_state is null then
    return coalesce(new, old);
  end if;

  -- In CONSTRUCTION everything is permitted.
  if v_state = 'CONSTRUCTION'::public.edition_state then
    return coalesce(new, old);
  end if;

  -- Transaction-local override (set by trusted admin server code only).
  v_override := coalesce(
    nullif(current_setting('app.allow_question_edit', true), ''),
    'off'
  ) = 'on';

  if v_override then
    return coalesce(new, old);
  end if;

  -- Outside CONSTRUCTION and without override: permit ONLY curation-column
  -- UPDATEs. INSERT and DELETE of questions are structural -> blocked.
  if tg_op = 'UPDATE' then
    v_only_curation :=
          new.edition_id          is not distinct from old.edition_id
      and new.prompt              is not distinct from old.prompt
      and new.format              is not distinct from old.format
      and new.position            is not distinct from old.position
      and new.drink_rule_override is not distinct from old.drink_rule_override;
    if v_only_curation then
      return new;   -- is_selected_for_show / show_order may change freely
    end if;
  end if;

  raise exception
    'Questions are locked: edition % is in state % (not CONSTRUCTION). '
    'Structural edits require the two-step admin override that wipes '
    'associated answers (set_config(''app.allow_question_edit'',''on'',true)).',
    v_edition, v_state
    using errcode = 'check_violation';
end;
$$;
