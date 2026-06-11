-- Per-question toggle: should this question's drama cards + vote reveal be
-- shown in the presentation / archive? Curated by the admin in COMPILATION.
-- reveal_enabled isn't a structural column, so the question-edit-lock trigger
-- already permits toggling it after CONSTRUCTION (only edition_id/prompt/
-- format/position/drink_rule_override are frozen).
alter table public.questions add column if not exists reveal_enabled boolean not null default true;
