// Ordre de révélation d'une catégorie — partagé par le mode présentation
// (client) et l'archive (serveur). Pas de "server-only" ici : c'est justement
// pour que les deux vues racontent EXACTEMENT la même histoire.

import type { RankRow } from "./presentation-types";
import { groupByRank, type RankGroup } from "./rank-groups";

export type Cascade = {
  /** La ou les POSITIONS qui calent (une position, plusieurs visages). */
  shooters: RankGroup[];
  /** Les positions dévoilées en liste, hors la dernière avant le climax. */
  buildUp: RankGroup[];
  /** L'avant-dernière position, gardée pour le duo final. */
  penultimate: RankGroup | null;
  /**
   * Le classement porte-t-il un enjeu ?
   *
   * Oui dès que quelqu'un d'autre que le caleur boit : l'ordre décide alors de
   * ce que chacun avale, et il mérite d'être déroulé.
   * Non en choix unique, où seule la tête trinque. Les places 2 à N n'y sont
   * qu'un artefact du décompte des voix ; les afficher donnerait à voir un
   * classement que personne n'a établi.
   */
  rankingMatters: boolean;
};

/**
 * `players` doit arriver trié par `finalRank` croissant.
 *
 * ON RAISONNE EN POSITIONS, PAS EN PERSONNES. Deux ex æquo occupent UNE
 * position : ils se dévoilent ensemble, sous un seul numéro et une seule
 * ardoise. Découper la cascade par personne laissait la moitié d'une égalité
 * dans le déroulé et l'autre au climax, ce qui vendait la mèche.
 *
 * ON NE DÉDUIT RIEN DE LA POSITION DU CALEUR. « Le shooter est au dernier
 * rang, donc c'est une escalade » tenait tant qu'il n'existait que deux
 * règles. « Gagnant boit » la casse, puisque le caleur y est PREMIER. On lit
 * donc les gorgées elles-mêmes.
 *
 * L'ordre va du moins au plus chargé et RÉSERVE l'avant-dernier dévoilement
 * pour le climax, sinon le caleur serait devinable par élimination.
 */
export function cascadeOf(players: RankRow[]): Cascade {
  const groups = groupByRank(players);
  const shooters = groups.filter((g) => g.isShooter);
  if (shooters.length === 0) {
    return { shooters: [], buildUp: [], penultimate: null, rankingMatters: false };
  }

  const rest = groups.filter((g) => !g.isShooter);
  if (!rest.some((g) => g.drinks > 0)) {
    // Choix unique : on ne montre QUE le ou les visages qui remportent.
    return { shooters, buildUp: [], penultimate: null, rankingMatters: false };
  }

  const montant = [...rest].sort((a, b) => a.drinks - b.drinks || a.rank - b.rank);
  return {
    shooters,
    buildUp: montant.slice(0, -1),
    penultimate: montant.length > 0 ? montant[montant.length - 1] : null,
    rankingMatters: true,
  };
}
