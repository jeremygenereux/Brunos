// La déboule du déni : celui qui cale est celui qui s'était placé à
// l'EXTRÉMITÉ OPPOSÉE de son propre classement.
//
// Deux lectures selon la règle de la catégorie, et c'est la même histoire vue
// des deux bouts :
//   • « Perdant boit » (ESCALATION) : le caleur est DERNIER au verdict. S'il
//     s'était donné la PREMIÈRE place, il était seul à ne pas se voir venir.
//   • « Gagnant boit » (TOP_UNIQUE) : le caleur est PREMIER au verdict. S'il
//     s'était mis DERNIER, il se croyait à l'abri — la table en a décidé
//     autrement.
//
// Pur et sans entrée-sortie : `drama.ts` (server-only) fournit les bulletins
// et le classement officiel, ce module ne fait que juger. C'est ce qui le
// rend testable à froid, comme le reste de `scoring`.

import type { DrinkRule, PlayerScore } from "../scoring/types";
import type { DramaCard } from "./presentation-types";

export type DelusionBallot = {
  voterName: string;
  /** Le joueur QU'EST ce votant dans l'édition ; null pour l'entourage. */
  selfPlayerId: string | null;
  /** Le rang que le votant s'est donné à lui-même. */
  selfRank: number | null;
  /** Le dernier rang de SON bulletin (aujourd'hui : le nombre de nommés). */
  maxRank: number;
};

/**
 * `official` est le classement OFFICIEL de la question, trié — celui qui
 * décide des gorgées. Ne s'applique qu'aux catégories `ranking` : sur une
 * désignation on ne se classe pas soi-même, il n'y a pas d'extrémité opposée.
 */
export function detectDelusions(
  ballots: DelusionBallot[],
  official: PlayerScore[],
  rule: DrinkRule,
): DramaCard[] {
  const n = official.length;
  if (n === 0) return [];

  // Qui cale, selon la règle effective de la question. Les ex æquo en tête
  // d'un « gagnant boit » calent tous, comme dans questionDrinks.
  const shooterIds = new Set(
    (rule === "ESCALATION"
      ? official.filter((s) => s.finalRank === n)
      : official.filter((s) => s.tiedForWin)
    ).map((s) => s.playerId),
  );

  const cards: DramaCard[] = [];
  for (const b of ballots) {
    if (!b.selfPlayerId || b.selfRank == null) continue;
    if (!shooterIds.has(b.selfPlayerId)) continue;

    const delusional =
      rule === "ESCALATION"
        ? b.selfRank === 1 // fini dernier, se voyait premier
        : b.selfRank === b.maxRank; // fini premier, se croyait dernier

    if (delusional) {
      cards.push({
        kind: "self_delusion",
        title: "Dans le déni",
        detail:
          rule === "ESCALATION"
            ? `${b.voterName} s'était donné la première place. Le verdict l'envoie caler.`
            : `${b.voterName} s'était mis·e bon·ne dernier·ère. La table l'a désigné·e quand même : shooter.`,
      });
    }
  }
  return cards;
}
