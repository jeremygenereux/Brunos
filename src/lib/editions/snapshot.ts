import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { computeQuestionResult, resultRowsFor, type ResultRow } from "@/lib/scoring/edition";
import type { DrinkRule, QuestionBallot, QuestionFormat } from "@/lib/scoring/types";

type Client = Awaited<ReturnType<typeof createClient>>;

export type EditionResults = {
  error: string | null;
  rows: ResultRow[];
  /** Selected questions, in show order. */
  questions: { id: string; prompt: string; format: QuestionFormat; show_order: number }[];
  /** True if at least one jury (entourage) ballot was cast for this edition. */
  hasJury: boolean;
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
  const empty: EditionResults = { error: null, rows: [], questions: [], hasJury: false };

  const { data: edition, error: eErr } = await supabase
    .from("editions")
    .select("drink_rule, shooter_value")
    .eq("id", editionId)
    .single();
  if (eErr || !edition) return { ...empty, error: "Édition introuvable." };

  // Fail closed: a transient read error must not silently produce a ranking
  // computed from partial ballots. Surface it so the caller shows an error.
  const failed = "Lecture des votes impossible. Réessaie.";

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

  const { data: participants, error: partErr } = await supabase
    .from("participants")
    .select("id, kind")
    .eq("edition_id", editionId);
  if (partErr) return { ...empty, error: failed };
  const kindByParticipant = new Map((participants ?? []).map((p) => [p.id, p.kind]));

  const { data: votes, error: vErr } = await supabase
    .from("votes")
    .select("id, participant_id")
    .eq("edition_id", editionId);
  if (vErr) return { ...empty, error: failed };
  const kindByVote = new Map(
    (votes ?? []).map((v) => [v.id, kindByParticipant.get(v.participant_id)]),
  );
  const hasJury = (votes ?? []).some((v) => kindByVote.get(v.id) === "jury");

  const { data: answers, error: aErr } = await supabase
    .from("vote_answers")
    .select("vote_id, question_id, player_id, rank")
    .eq("edition_id", editionId);
  if (aErr) return { ...empty, error: failed };

  const byQuestionVote = new Map<string, Map<string, QuestionBallot>>();
  for (const a of answers ?? []) {
    let qv = byQuestionVote.get(a.question_id);
    if (!qv) {
      qv = new Map();
      byQuestionVote.set(a.question_id, qv);
    }
    const ballot = qv.get(a.vote_id) ?? [];
    ballot.push({ playerId: a.player_id, rank: a.rank });
    qv.set(a.vote_id, ballot);
  }

  const shooterValue = Number(edition.shooter_value);
  const rows: ResultRow[] = [];
  for (const q of selected) {
    const qv = byQuestionVote.get(q.id) ?? new Map<string, QuestionBallot>();
    const playerBallots: QuestionBallot[] = [];
    const juryBallots: QuestionBallot[] = [];
    for (const [voteId, ballot] of qv) {
      const kind = kindByVote.get(voteId);
      if (kind === "player") playerBallots.push(ballot);
      else if (kind === "jury") juryBallots.push(ballot);
    }
    const computed = computeQuestionResult(
      {
        questionId: q.id,
        format: q.format,
        drinkRule: q.drinkRule,
        playerBallots,
        juryBallots,
      },
      playerIds,
      shooterValue,
    );
    rows.push(...resultRowsFor(computed));
  }

  return { error: null, rows, questions, hasJury };
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
