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
   * ESCALATION → oui : chacun boit selon son rang, l'ordre veut dire quelque
   * chose, et le·la dernier·ère cale.
   * TOP_UNIQUE → non : seul·e le·la gagnant·e boit. Les places 2 à N ne sont
   * qu'un artefact du décompte des voix ; les afficher donnerait à voir un
   * classement qui n'a jamais existé.
   */
  rankingMatters: boolean;
};

/**
 * `players` doit arriver trié par `finalRank` croissant.
 *
 * On dérive tout du drapeau `isShooter`, déjà calculé avec la règle EFFECTIVE
 * de la question (`drink_rule_override` compris) : la chorégraphie reste donc
 * juste même quand une édition mélange les deux règles.
 */
export function cascadeOf(players: RankRow[]): Cascade {
  const shooters = players.filter((p) => p.isShooter);
  if (shooters.length === 0) {
    return { shooters: [], buildUp: [], penultimate: null, rankingMatters: false };
  }

  const shooterIsLast = shooters[shooters.length - 1].finalRank === players.length;
  if (!shooterIsLast) {
    // TOP_UNIQUE : on ne montre QUE le ou les visages qui remportent.
    return { shooters, buildUp: [], penultimate: null, rankingMatters: false };
  }

  // ESCALATION : on déroule, en RÉSERVANT l'avant-dernière position pour le
  // climax — sinon la dernière personne serait devinable par élimination.
  const rest = players.filter((p) => !p.isShooter);
  return {
    shooters,
    buildUp: rest.slice(0, -1),
    penultimate: rest.length > 0 ? rest[rest.length - 1] : null,
    rankingMatters: true,
  };
}
