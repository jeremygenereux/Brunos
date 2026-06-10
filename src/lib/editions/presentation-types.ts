// Shared presentation/archive view types. No runtime — safe to import from
// both the server loader and the "use client" deck.

import type { Database } from "@/lib/types/database.types";

export type EditionState = Database["public"]["Enums"]["edition_state"];

export type RankRow = {
  playerId: string;
  personId: string | null;
  name: string;
  headshot: string | null;
  finalRank: number;
  drinks: number;
  /** Genuinely tied for 1st (revealed together). */
  isWinner?: boolean;
  /** Actually took the shooter charge (not a coincidental value). */
  isShooter?: boolean;
};

export type Category = {
  questionId: string;
  index: number;
  prompt: string;
  format: string;
  players: RankRow[];
  jury: RankRow[];
};

export type RecapRow = {
  playerId: string;
  name: string;
  headshot: string | null;
  total: number;
};

export type PresentEdition = {
  id: string;
  name: string;
  year: number;
  venueName: string | null;
  eventAt: string | null;
  state: EditionState;
};
