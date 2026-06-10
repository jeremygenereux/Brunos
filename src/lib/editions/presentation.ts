import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { computeEditionResultRows } from "./snapshot";
import type { Category, PresentEdition, RankRow, RecapRow } from "./presentation-types";

type Client = Awaited<ReturnType<typeof createClient>>;

export type PresentationData = {
  error: string | null;
  edition: PresentEdition | null;
  categories: Category[];
  recap: RecapRow[];
};

function personName(people: unknown): string {
  if (!people) return "Sans nom";
  if (Array.isArray(people)) {
    return (people[0] as { display_name?: string } | undefined)?.display_name ?? "Sans nom";
  }
  return (people as { display_name?: string }).display_name ?? "Sans nom";
}

/**
 * Load + shape an edition's presentation (categories with explicit
 * winner/shooter flags + the night's recap), reading the frozen `results`
 * cache. Authorization is the CALLER's job — this uses whatever client (and
 * therefore RLS scope) it is handed.
 *
 * `allowLiveFallback` (admin preview only) permits recomputing from raw
 * `vote_answers` when the cache is empty. The public archive must NOT enable
 * it: archived editions always have a frozen snapshot, and this keeps the
 * raw-ballot read off any participant-reachable path.
 */
export async function loadPresentation(
  supabase: Client,
  editionId: string,
  opts: { allowLiveFallback?: boolean } = {},
): Promise<PresentationData> {
  const empty: PresentationData = { error: null, edition: null, categories: [], recap: [] };

  const { data: edition } = await supabase
    .from("editions")
    .select("id, name, year, state, venue_name, event_at, drink_rule")
    .eq("id", editionId)
    .single();
  if (!edition) return empty;

  const editionView: PresentEdition = {
    id: edition.id,
    name: edition.name,
    year: edition.year,
    venueName: edition.venue_name,
    eventAt: edition.event_at,
    state: edition.state,
  };

  const { data: rawQuestions } = await supabase
    .from("questions")
    .select("id, prompt, format, show_order, drink_rule_override")
    .eq("edition_id", editionId)
    .eq("is_selected_for_show", true)
    .order("show_order");
  const questions = rawQuestions ?? [];
  const qids = questions.map((q) => q.id);

  const { data: rawPlayers } = await supabase
    .from("players")
    .select("id, person_id, headshot_url, people(display_name)")
    .eq("edition_id", editionId)
    .order("display_order");
  const playersById = new Map(
    (rawPlayers ?? []).map((p) => [
      p.id,
      { personId: p.person_id, name: personName(p.people), headshot: p.headshot_url },
    ]),
  );

  // Frozen results from cache; live fallback if empty (admin preview path).
  type Row = {
    question_id: string;
    player_id: string;
    borda_score: number | null;
    vote_count: number | null;
    final_rank: number;
    drinks: number;
    audience: string;
  };
  let rows: Row[] = [];
  if (qids.length) {
    const { data } = await supabase
      .from("results")
      .select("question_id, player_id, borda_score, vote_count, final_rank, drinks, audience")
      .in("question_id", qids);
    rows = (data ?? []).map((r) => ({ ...r, drinks: Number(r.drinks) }));
  }
  if (rows.length === 0 && qids.length && opts.allowLiveFallback) {
    const fb = await computeEditionResultRows(supabase, editionId);
    if (fb.error) return { ...empty, edition: editionView, error: fb.error };
    rows = fb.rows.map((r) => ({
      question_id: r.question_id,
      player_id: r.player_id,
      borda_score: r.borda_score,
      vote_count: r.vote_count,
      final_rank: r.final_rank,
      drinks: r.drinks,
      audience: r.audience,
    }));
  }

  const shapeRanking = (
    questionId: string,
    audience: "players" | "jury",
    format: string,
    rule: "ESCALATION" | "TOP_UNIQUE",
  ): RankRow[] => {
    const sorted = rows
      .filter((r) => r.question_id === questionId && r.audience === audience)
      .sort((a, b) => a.final_rank - b.final_rank);
    const n = sorted.length;
    const top = sorted[0];
    return sorted.map((r) => ({
      playerId: r.player_id,
      personId: playersById.get(r.player_id)?.personId ?? null,
      name: playersById.get(r.player_id)?.name ?? "—",
      headshot: playersById.get(r.player_id)?.headshot ?? null,
      finalRank: r.final_rank,
      drinks: r.drinks,
      isWinner:
        audience === "players" && top
          ? format === "ranking"
            ? r.borda_score === top.borda_score
            : r.vote_count === top.vote_count
          : false,
      isShooter:
        audience === "players"
          ? rule === "ESCALATION"
            ? r.final_rank === n
            : r.drinks > 0
          : false,
    }));
  };

  const categories: Category[] = questions.map((q, i) => {
    const rule = (q.drink_rule_override ?? edition.drink_rule) as "ESCALATION" | "TOP_UNIQUE";
    return {
      questionId: q.id,
      index: i,
      prompt: q.prompt,
      format: q.format,
      players: shapeRanking(q.id, "players", q.format, rule),
      jury: shapeRanking(q.id, "jury", q.format, rule),
    };
  });

  const totals = new Map<string, number>();
  for (const c of categories) {
    for (const r of c.players) totals.set(r.playerId, (totals.get(r.playerId) ?? 0) + r.drinks);
  }
  const recap: RecapRow[] = [...playersById.entries()]
    .map(([id, p]) => ({
      playerId: id,
      name: p.name,
      headshot: p.headshot,
      total: totals.get(id) ?? 0,
    }))
    .sort((a, b) => b.total - a.total);

  return { error: null, edition: editionView, categories, recap };
}
