// Les positions PARTAGÉES, regroupées une fois pour toutes.
//
// POURQUOI CE MODULE. Un ex æquo n'est pas deux lignes qui se ressemblent :
// c'est UNE position, occupée par plusieurs personnes, qui vaut UNE ardoise.
// Afficher « 1 · Amélie · 15 » puis « 1 · Noé · 15 » répète un chiffre qui
// n'existe qu'une fois et laisse croire à deux verdicts distincts. On regroupe
// donc en amont, et l'archive comme la scène rendent des GROUPES.
//
// Pas de "server-only" : la scène est un composant client, l'archive est
// serveur, et les deux doivent raconter exactement la même histoire.

import type { RankRow } from "./presentation-types";

export type RankGroup = {
  /** Le rang de compétition, affiché une seule fois pour le groupe. */
  rank: number;
  /** Les gorgées de CHACUN des membres — elles sont identiques par
   *  construction, d'où le singulier à l'écran (« 3 gorgées chacun »). */
  drinks: number;
  /** Vrai si ce groupe remporte la catégorie. */
  isWinner: boolean;
  /** Vrai si ce groupe cale le shooter. */
  isShooter: boolean;
  /** Les personnes à cette position, dans l'ordre d'affichage. */
  players: RankRow[];
};

/**
 * `rows` doit arriver trié par `finalRank` croissant — c'est ce que rendent
 * `loadPresentation` et `cascadeOf`.
 *
 * Le repli sur `finalRank` couvre les lignes d'avant la colonne `tied_rank` :
 * chacune forme alors son propre groupe, ce qui redonne exactement l'ancien
 * affichage plutôt qu'un regroupement inventé.
 */
export function groupByRank(rows: RankRow[]): RankGroup[] {
  const groups: RankGroup[] = [];
  for (const row of rows) {
    const rank = row.tiedRank ?? row.finalRank;
    const last = groups[groups.length - 1];
    if (last && last.rank === rank) {
      last.players.push(row);
      // Un groupe cale dès qu'un de ses membres cale : le drapeau est posé
      // par la règle sur le rang, donc il vaut pour toute la position.
      last.isShooter = last.isShooter || Boolean(row.isShooter);
      last.isWinner = last.isWinner || Boolean(row.isWinner);
      continue;
    }
    groups.push({
      rank,
      drinks: row.drinks,
      isWinner: Boolean(row.isWinner),
      isShooter: Boolean(row.isShooter),
      players: [row],
    });
  }
  return groups;
}
