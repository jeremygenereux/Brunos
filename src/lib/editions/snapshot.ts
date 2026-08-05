import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { computeQuestionResult, resultRowsFor, type ResultRow } from "@/lib/scoring/edition";
import type { DrinkRule, QuestionFormat } from "@/lib/scoring/types";
import { loadEditionBallots } from "@/lib/editions/ballots";

type Client = Awaited<ReturnType<typeof createClient>>;

export type EditionResults = {
  error: string | null;
  rows: ResultRow[];
  /** Selected questions, in show order. */
  questions: { id: string; prompt: string; format: QuestionFormat; show_order: number }[];
};

/**
 * Compute the frozen `results` rows for an edition's selected questions —
 * in memory, no DB writes. Used both by the LOCKED snapshot writer and as a
 * live fallback for the presentation when the cache is empty.
 */
export async function computeEditionResultRows(
  supabase: Client,
  editionId: string,
): Promise<EditionResults> {
  const empty: EditionResults = { error: null, rows: [], questions: [] };

  const { data: edition, error: eErr } = await supabase
    .from("editions")
    .select("drink_rule, shooter_value")
    .eq("id", editionId)
    .single();
  if (eErr || !edition) return { ...empty, error: "Édition introuvable." };

  // Fail closed: a transient read error must not silently produce a ranking
  // computed from partial ballots. Surface it so the caller shows an error.
  const failed = "Lecture des votes impossible. Réessayez.";

  const { data: rawPlayers, error: pErr } = await supabase
    .from("players")
    .select("id")
    .eq("edition_id", editionId);
  if (pErr) return { ...empty, error: failed };
  const playerIds = (rawPlayers ?? []).map((p) => p.id);

  const { data: rawQuestions, error: qErr } = await supabase
    .from("questions")
    .select("id, prompt, format, show_order, drink_rule_override")
    .eq("edition_id", editionId)
    .eq("is_selected_for_show", true)
    .order("show_order");
  if (qErr) return { ...empty, error: failed };
  const selected = (rawQuestions ?? []).map((q) => ({
    id: q.id,
    prompt: q.prompt,
    format: q.format as QuestionFormat,
    show_order: q.show_order ?? 0,
    drinkRule: (q.drink_rule_override ?? edition.drink_rule) as DrinkRule,
  }));
  const questions = selected.map(({ id, prompt, format, show_order }) => ({
    id,
    prompt,
    format,
    show_order,
  }));
  if (selected.length === 0) return empty;

  const ballots = await loadEditionBallots(supabase, editionId);
  if (ballots.error) return { ...empty, error: failed };

  const shooterValue = Number(edition.shooter_value);
  const rows: ResultRow[] = [];
  for (const q of selected) {
    const computed = computeQuestionResult(
      {
        questionId: q.id,
        format: q.format,
        drinkRule: q.drinkRule,
        playerBallots: ballots.playerBallots.get(q.id) ?? [],
        entourageRatings: ballots.entourageRatings.get(q.id) ?? [],
      },
      playerIds,
      shooterValue,
    );
    rows.push(...resultRowsFor(computed));
  }

  return { error: null, rows, questions };
}

/**
 * Freeze an edition's results into the `results` cache (called on the
 * COMPILATION → LOCKED transition). Idempotent: clears the WHOLE edition's
 * cached rows (not just the currently-selected subset, so a re-snapshot can
 * never orphan publicly-readable rows for a de-selected question), then
 * inserts the freshly computed ones. Admin-only via RLS (results_*_admin).
 */
export async function snapshotEditionResults(
  supabase: Client,
  editionId: string,
): Promise<{ error: string | null }> {
  const computed = await computeEditionResultRows(supabase, editionId);
  if (computed.error) return { error: computed.error };
  if (computed.questions.length === 0) {
    return { error: "Aucune question n'est sélectionnée pour la présentation." };
  }

  // `results` has no edition_id column — clear via every question of the
  // edition, not only the ones currently selected for the show.
  const { data: allQuestions, error: aqErr } = await supabase
    .from("questions")
    .select("id")
    .eq("edition_id", editionId);
  if (aqErr) return { error: aqErr.message };
  const allQids = (allQuestions ?? []).map((q) => q.id);

  if (allQids.length) {
    const { error: delErr } = await supabase.from("results").delete().in("question_id", allQids);
    if (delErr) return { error: delErr.message };
  }

  const { error: insErr } = await supabase.from("results").insert(computed.rows);
  if (insErr) return { error: insErr.message };

  return { error: null };
}
