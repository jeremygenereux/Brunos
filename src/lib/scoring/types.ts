export type DrinkRule = "TOP_UNIQUE" | "ESCALATION" | "ESCALATION_INVERSE";
export type QuestionFormat = "ranking" | "single_choice" | "entourage";

/**
 * One voter's answers for ONE question.
 * - ranking: every player with a rank 1..N (1 = most likely).
 * - single_choice: the chosen player with rank === 1.
 */
export type QuestionBallot = { playerId: string; rank: number }[];

/**
 * Une note d'un proche sur SON joueur, pour une question entourage.
 * Un joueur en reçoit autant que de proches ayant voté pour lui — parfois
 * deux, parfois une seule, parfois aucune.
 */
export type EntourageRating = { playerId: string; rating: number };

export type PlayerScore = {
  playerId: string;
  /** Borda total (sum of positions) for ranking questions; lower = better. */
  bordaScore: number | null;
  /** Number of votes received for single_choice questions. */
  voteCount: number | null;
  /** Moyenne des notes reçues (entourage); null pour les autres formats. */
  avgRating: number | null;
  /** Times ranked 1st (ranking) or chosen (single_choice). */
  firstPlaceCount: number;
  /** Final position in the category, 1..N (distinct; ties broken deterministically). */
  finalRank: number;
  /** True when genuinely tied for 1st (same primary+secondary score as the top). */
  tiedForWin: boolean;
};
