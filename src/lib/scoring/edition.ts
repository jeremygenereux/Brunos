import { computeEntourageRanking, computeQuestionRanking } from "./rankings";
import { questionDrinks } from "./drinks";
import type {
  DrinkRule,
  EntourageRating,
  PlayerScore,
  QuestionBallot,
  QuestionFormat,
} from "./types";

/**
 * `results.audience` garde ses deux valeurs en base pour ne pas casser les
 * lignes déjà gelées, mais on n'en écrit plus qu'une. L'entourage ne répond
 * plus aux catégories des joueurs : il a ses propres questions, et son verdict
 * y est OFFICIEL. Un second classement « pour information » sur les catégories
 * normales n'a plus d'objet.
 */
export type ResultAudience = "players";

export type QuestionComputeInput = {
  questionId: string;
  format: QuestionFormat;
  /** Resolved rule for this question (drink_rule_override ?? edition.drink_rule). */
  drinkRule: DrinkRule;
  playerBallots: QuestionBallot[];
  /** Notes des proches — questions `entourage` uniquement. */
  entourageRatings?: EntourageRating[];
};

export type QuestionComputed = {
  questionId: string;
  /** Official ranking. Drives the drinks. */
  players: PlayerScore[];
  /** Per-player gorgées, derived from the OFFICIAL ranking + rule. */
  drinks: Map<string, number>;
  /** How many ballots fed the ranking (0 ⇒ no real result). */
  playerBallotCount: number;
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
 *
 * LES QUESTIONS ENTOURAGE SUIVENT LE MÊME CHEMIN, avec deux différences.
 * D'abord ce sont les notes des proches, et non les bulletins des joueurs, qui
 * produisent le classement OFFICIEL : c'est le renversement voulu cette
 * année, l'entourage fait boire pour de vrai. Ensuite le classement ne couvre
 * que les joueurs notés ; on part donc d'une carte de gorgées à zéro pour tout
 * le monde et on ne surcharge que ceux qui y figurent, sans quoi un joueur
 * sans proche disparaîtrait des totaux au lieu d'y compter pour rien.
 */
export function computeQuestionResult(
  input: QuestionComputeInput,
  playerIds: string[],
  shooterValue: number,
): QuestionComputed {
  if (input.format === "entourage") {
    const ratings = input.entourageRatings ?? [];
    const players = computeEntourageRanking(ratings, playerIds);
    const drinks = new Map<string, number>(playerIds.map((id) => [id, 0]));
    if (players.length > 0) {
      for (const [id, v] of questionDrinks(players, input.drinkRule, shooterValue)) {
        drinks.set(id, v);
      }
    }
    return {
      questionId: input.questionId,
      players,
      drinks,
      playerBallotCount: ratings.length,
    };
  }

  const players = computeQuestionRanking(input.format, input.playerBallots, playerIds);
  const hasPlayerBallots = input.playerBallots.length > 0;
  const drinks = hasPlayerBallots
    ? questionDrinks(players, input.drinkRule, shooterValue)
    : new Map(playerIds.map((id) => [id, 0]));
  return {
    questionId: input.questionId,
    players,
    drinks,
    playerBallotCount: input.playerBallots.length,
  };
}

/** A row destined for `public.results` (snake_case to match the insert payload). */
export type ResultRow = {
  question_id: string;
  player_id: string;
  borda_score: number | null;
  vote_count: number | null;
  avg_rating: number | null;
  final_rank: number;
  drinks: number;
  audience: ResultAudience;
};

/**
 * Flatten one computed question into `results` rows. An audience that received
 * NO ballots is omitted entirely — there is no real ranking to freeze, so we
 * never crown a hash-ordered winner or charge phantom gorgées for it.
 *
 * Sur une question entourage, seuls les joueurs notés produisent une ligne :
 * l'absence de ligne EST l'information « personne ne s'est prononcé sur lui ».
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
        avg_rating: s.avgRating === null ? null : Math.round(s.avgRating * 100) / 100,
        final_rank: s.finalRank,
        drinks: q.drinks.get(s.playerId) ?? 0,
        audience: "players",
      });
    }
  }
  return rows;
}
