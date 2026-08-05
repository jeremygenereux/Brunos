// Ordre de révélation d'une catégorie — partagé par le mode présentation
// (client) et l'archive (serveur). Pas de "server-only" ici : c'est justement
// pour que les deux vues racontent EXACTEMENT la même histoire.

import type { RankRow } from "./presentation-types";

export type Cascade = {
  /** La ou les personnes qui calent (ex æquo possible). */
  shooters: RankRow[];
  /** Les positions dévoilées en liste, hors les deux dernières. */
  buildUp: RankRow[];
  /** L'avant-dernière position, gardée pour le duo final. */
  penultimate: RankRow | null;
  /**
   * Le classement porte-t-il un enjeu ?
   *
   * Oui dès que quelqu'un d'autre que le caleur boit : l'ordre décide alors de
   * ce que chacun avale, et il mérite d'être déroulé.
   * Non en « gagnant boit », où seule la première place trinque. Les places 2 à
   * N ne sont qu'un artefact du décompte ; les afficher donnerait à voir un
   * classement qui n'a jamais existé.
   */
  rankingMatters: boolean;
};

/**
 * `players` doit arriver trié par `finalRank` croissant.
 *
 * ON NE DÉDUIT RIEN DE LA POSITION DU CALEUR. C'était le cas avant : « le
 * shooter est au dernier rang, donc c'est une escalade ». Cette inférence
 * tenait tant qu'il n'existait que deux règles. L'escalade INVERSE la casse,
 * puisque le caleur y est PREMIER : la scène aurait conclu à un « gagnant
 * boit », n'aurait montré qu'un visage, et n'aurait jamais annoncé les gorgées
 * que les autres doivent pourtant prendre.
 *
 * On lit donc les gorgées elles-mêmes, ce qui vaut pour les trois règles et
 * vaudra pour celles d'après.
 *
 * L'ordre de révélation va du moins au plus chargé, et RÉSERVE l'avant-dernier
 * dévoilement pour le climax, sinon le caleur serait devinable par élimination.
 * En escalade normale cela redonne exactement l'ordre des rangs ; en escalade
 * inversée cela remonte du bas vers le haut, pour finir juste sous le caleur.
 */
export function cascadeOf(players: RankRow[]): Cascade {
  const shooters = players.filter((p) => p.isShooter);
  if (shooters.length === 0) {
    return { shooters: [], buildUp: [], penultimate: null, rankingMatters: false };
  }

  const rest = players.filter((p) => !p.isShooter);
  if (!rest.some((p) => p.drinks > 0)) {
    // Gagnant boit : on ne montre QUE le ou les visages qui remportent.
    return { shooters, buildUp: [], penultimate: null, rankingMatters: false };
  }

  const montant = [...rest].sort((a, b) => a.drinks - b.drinks || a.finalRank - b.finalRank);
  return {
    shooters,
    buildUp: montant.slice(0, -1),
    penultimate: montant.length > 0 ? montant[montant.length - 1] : null,
    rankingMatters: true,
  };
}
