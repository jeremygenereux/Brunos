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
  /**
   * Position d'affichage, 1..N, TOUJOURS distincte : elle sert à ordonner la
   * liste de façon stable, y compris entre ex æquo (départagés par hachage).
   */
  finalRank: number;
  /**
   * Rang de COMPÉTITION, partagé par les ex æquo : 1, 2, 2, 4. C'est LUI qui
   * décide des gorgées — deux personnes à égalité boivent la même chose, où
   * qu'elles se trouvent dans le classement. `finalRank` ne servirait pas :
   * son départage par hachage ferait boire différemment deux scores égaux.
   */
  tiedRank: number;
  /** True when genuinely tied for 1st (same primary+secondary score as the top). */
  tiedForWin: boolean;
};
