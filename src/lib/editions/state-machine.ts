import type { Database } from "@/lib/types/database.types";

export type EditionState = Database["public"]["Enums"]["edition_state"];

/** The linear lifecycle of an edition (spec §4). */
export const STATE_ORDER: EditionState[] = [
  "CONSTRUCTION",
  "SENT_FOR_VOTE",
  "COMPILATION",
  "LOCKED",
  "LIVE",
  "ARCHIVED",
];

export const STATE_LABEL: Record<EditionState, string> = {
  CONSTRUCTION: "Construction",
  SENT_FOR_VOTE: "Vote ouvert",
  COMPILATION: "Compilation",
  LOCKED: "Verrouillée",
  LIVE: "En direct",
  ARCHIVED: "Archivée",
};

/** Label of the action that advances FROM the given state to the next one. */
export const TRANSITION_LABEL: Record<EditionState, string | null> = {
  CONSTRUCTION: "Ouvrir le vote",
  SENT_FOR_VOTE: "Fermer le vote et compiler",
  COMPILATION: "Verrouiller l'édition",
  LOCKED: "Passer en direct",
  LIVE: "Envoyer à l'archive",
  ARCHIVED: null,
};

/** Consequence shown before confirming a transition. */
export const TRANSITION_NOTE: Record<EditionState, string | null> = {
  CONSTRUCTION: "Les questions seront gelées et le vote s'ouvre aux participants.",
  SENT_FOR_VOTE: "Le vote se ferme ; les classements pourront être compilés.",
  COMPILATION: "L'édition passe en lecture seule avant le jour J.",
  LOCKED: "Active le mode présentation pour la soirée.",
  LIVE: "Rend les résultats publics et clôt l'édition.",
  ARCHIVED: null,
};

/** The state immediately after `state`, or null if already terminal. */
export function nextState(state: EditionState): EditionState | null {
  const i = STATE_ORDER.indexOf(state);
  return i >= 0 && i < STATE_ORDER.length - 1 ? STATE_ORDER[i + 1] : null;
}
