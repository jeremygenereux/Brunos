import { computeQuestionRanking } from "./rankings";
import { questionDrinks } from "./drinks";
import type { DrinkRule, PlayerScore, QuestionBallot, QuestionFormat } from "./types";

export type ResultAudience = "players" | "jury";

export type QuestionComputeInput = {
  questionId: string;
  format: QuestionFormat;
  /** Resolved rule for this question (drink_rule_override ?? edition.drink_rule). */
  drinkRule: DrinkRule;
  playerBallots: QuestionBallot[];
  juryBallots: QuestionBallot[];
};

export type QuestionComputed = {
  questionId: string;
  /** Official ranking — player audience. Drives the drinks. */
  players: PlayerScore[];
  /** Entourage ranking — jury audience. No drink impact (spec §6.3). */
  jury: PlayerScore[];
  /** Per-player gorgées, derived from the OFFICIAL ranking + rule. */
  drinks: Map<string, number>;
  /** How many player / jury ballots fed each ranking (0 ⇒ no real result). */
  playerBallotCount: number;
  juryBallotCount: number;
};

/**
 * Compute both audiences' rankings + the drink vector for ONE question.
 *
 * This is the SINGLE SOURCE OF TRUTH shared by the COMPILATION preview
 * (equalizer panel) and the LOCKED snapshot writer, so the frozen `results`
 * always match exactly what the admin saw while curating.
 *
 * A question with ZERO ballots for an audience has no real ranking — the
 * tie-break would crown a hash-ordered "winner" out of pure noise. So when
 * there are no player ballots we charge nobody (all drinks 0), and
 * `resultRowsFor` drops the audiences that received no ballots entirely.
 */
export function computeQuestionResult(
  input: QuestionComputeInput,
  playerIds: string[],
  shooterValue: number,
): QuestionComputed {
  const players = computeQuestionRanking(input.format, input.playerBallots, playerIds);
  const jury = computeQuestionRanking(input.format, input.juryBallots, playerIds);
  const hasPlayerBallots = input.playerBallots.length > 0;
  const drinks = hasPlayerBallots
    ? questionDrinks(players, input.drinkRule, shooterValue)
    : new Map(playerIds.map((id) => [id, 0]));
  return {
    questionId: input.questionId,
    players,
    jury,
    drinks,
    playerBallotCount: input.playerBallots.length,
    juryBallotCount: input.juryBallots.length,
  };
}

/** A row destined for `public.results` (snake_case to match the insert payload). */
export type ResultRow = {
  question_id: string;
  player_id: string;
  borda_score: number | null;
  vote_count: number | null;
  final_rank: number;
  /** Rang de compétition, partagé par les ex æquo. Décide des gorgées. */
  tied_rank: number;
  drinks: number;
  audience: ResultAudience;
};

/**
 * Flatten one computed question into `results` rows. An audience that received
 * NO ballots is omitted entirely — there is no real ranking to freeze, so we
 * never crown a hash-ordered winner or charge phantom gorgées for it.
 */
export function resultRowsFor(q: QuestionComputed): ResultRow[] {
  const rows: ResultRow[] = [];
  if (q.playerBallotCount > 0) {
    for (const s of q.players) {
      rows.push({
        question_id: q.questionId,
        player_id: s.playerId,
        borda_score: s.bordaScore,
        vote_count: s.voteCount,
        final_rank: s.finalRank,
        tied_rank: s.tiedRank,
        drinks: q.drinks.get(s.playerId) ?? 0,
        audience: "players",
      });
    }
  }
  if (q.juryBallotCount > 0) {
    for (const s of q.jury) {
      rows.push({
        question_id: q.questionId,
        player_id: s.playerId,
        borda_score: s.bordaScore,
        vote_count: s.voteCount,
        final_rank: s.finalRank,
        tied_rank: s.tiedRank,
        drinks: 0, // entourage ranking never makes anyone drink
        audience: "jury",
      });
    }
  }
  return rows;
}
