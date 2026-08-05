import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { EntourageRating, QuestionBallot } from "@/lib/scoring/types";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Toutes les réponses d'une édition, rangées par question et par public.
 *
 * POURQUOI CE MODULE EXISTE. `snapshot.ts` et l'écran de compilation faisaient
 * chacun leur propre lecture, avec le même regroupement recopié à l'identique.
 * Or `computeQuestionResult` se présente comme la source unique de vérité
 * partagée par l'aperçu de l'égaliseur et l'écriture du gel, ce qui n'est vrai
 * que si les DEUX reçoivent exactement les mêmes entrées. Deux copies d'un
 * regroupement, c'est deux occasions de diverger en silence — et une
 * divergence ici veut dire que la salle voit un classement que l'administration
 * n'a jamais validé. Une seule lecture, donc.
 */
export type EditionBallots = {
  error: string | null;
  /** question_id → bulletins des joueurs. */
  playerBallots: Map<string, QuestionBallot[]>;
  /** question_id → notes des proches (questions entourage). */
  entourageRatings: Map<string, EntourageRating[]>;
};

const FAILED = "Lecture des votes impossible. Réessayez.";

export async function loadEditionBallots(
  supabase: Client,
  editionId: string,
): Promise<EditionBallots> {
  const empty: EditionBallots = {
    error: null,
    playerBallots: new Map(),
    entourageRatings: new Map(),
  };

  const { data: participants, error: partErr } = await supabase
    .from("participants")
    .select("id, kind")
    .eq("edition_id", editionId);
  if (partErr) return { ...empty, error: FAILED };
  const kindByParticipant = new Map((participants ?? []).map((p) => [p.id, p.kind]));

  const { data: votes, error: vErr } = await supabase
    .from("votes")
    .select("id, participant_id")
    .eq("edition_id", editionId);
  if (vErr) return { ...empty, error: FAILED };
  const kindByVote = new Map(
    (votes ?? []).map((v) => [v.id, kindByParticipant.get(v.participant_id)]),
  );

  // Paginé : au-delà de 1000 réponses, une lecture simple serait tronquée en
  // silence et le classement figé serait faux sans que rien ne l'indique.
  const { data: answers, error: aErr } = await fetchAllRows<{
    vote_id: string;
    question_id: string;
    player_id: string;
    rank: number;
  }>((from, to) =>
    supabase
      .from("vote_answers")
      .select("vote_id, question_id, player_id, rank")
      .eq("edition_id", editionId)
      .order("id")
      .range(from, to),
  );
  if (aErr) return { ...empty, error: FAILED };

  // question_id → vote_id → bulletin, puis éclaté par public.
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

  // Seuls les bulletins des JOUEURS comptent sur les catégories normales.
  // L'entourage n'y répond plus : il a ses propres questions, où son verdict
  // est officiel. Un bulletin « jury » resté d'une ancienne édition est ignoré
  // plutôt que rangé à part, puisque plus rien ne l'affiche.
  const playerBallots = new Map<string, QuestionBallot[]>();
  for (const [questionId, qv] of byQuestionVote) {
    const players: QuestionBallot[] = [];
    for (const [voteId, ballot] of qv) {
      if (kindByVote.get(voteId) === "player") players.push(ballot);
    }
    playerBallots.set(questionId, players);
  }

  // Les notes des proches. On ne retient que les bulletins ENVOYÉS : un
  // brouillon à moitié rempli ferait bouger une moyenne, donc un classement,
  // donc les gorgées de quelqu'un, sans que son auteur l'ait jamais validé.
  const { data: ratings, error: rErr } = await fetchAllRows<{
    question_id: string;
    player_id: string;
    rating: number;
    entourage_ballots: { submitted_at: string | null } | null;
  }>((from, to) =>
    supabase
      .from("entourage_ratings")
      .select("question_id, player_id, rating, entourage_ballots!inner(submitted_at)")
      .eq("edition_id", editionId)
      .not("entourage_ballots.submitted_at", "is", null)
      .order("id")
      .range(from, to),
  );
  if (rErr) return { ...empty, error: FAILED };

  const entourageRatings = new Map<string, EntourageRating[]>();
  for (const r of ratings ?? []) {
    const list = entourageRatings.get(r.question_id) ?? [];
    list.push({ playerId: r.player_id, rating: r.rating });
    entourageRatings.set(r.question_id, list);
  }

  return { error: null, playerBallots, entourageRatings };
}
