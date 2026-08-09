export type DrinkRule = "TOP_UNIQUE" | "ESCALATION" | "ESCALATION_INVERSE";
export type QuestionFormat = "ranking" | "single_choice";

/**
 * One voter's answers for ONE question.
 * - ranking: every player with a rank 1..N (1 = most likely).
 * - single_choice: the chosen player with rank === 1.
 */
export type QuestionBallot = { playerId: string; rank: number }[];

export type PlayerScore = {
  playerId: string;
  /** Borda total (sum of positions) for ranking questions; lower = better. */
  bordaScore: number | null;
  /** Number of votes received for single_choice questions. */
  voteCount: number | null;
  /** Times ranked 1st (ranking) or chosen (single_choice). */
  firstPlaceCount: number;
  /** Final position in the category, 1..N (distinct; ties broken deterministically). */
  finalRank: number;
  /** True when genuinely tied for 1st (same primary+secondary score as the top). */
  tiedForWin: boolean;
};
