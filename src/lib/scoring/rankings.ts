import type { PlayerScore, QuestionBallot, QuestionFormat } from "./types";

/** Deterministic FNV-1a hash of an id — stable random for tie-breaks (spec §6.1b). */
export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Aggregate ONE question across the given ballots (each ballot = one voter's
 * answers for this question, from a single audience).
 *
 * - ranking → Borda : somme des positions, plus petit total = 1re place.
 * - single_choice → nombre de voix, le plus voté gagne.
 *
 * MÊME SCORE, MÊME PLACE. Il n'y a aucun départage : deux joueurs au même
 * total sont ex æquo, point. Un critère secondaire existait — le nombre de
 * fois classé premier — hérité de la spécification §6.1. Il a été retiré le
 * 9 août 2026, pour trois raisons :
 *
 *   1. il contredisait la méthode annoncée à la salle (« on additionne les
 *      classements »), en ajoutant un second critère que personne ne voyait ;
 *   2. il était inexplicable en séance : rien ne laissait deviner pourquoi
 *      1,1,5,5,5 passait devant 2,3,3,4,5 à total égal ;
 *   3. il n'existait que pour ÉVITER les égalités, à l'époque où une égalité
 *      obligeait le hachage à désigner un caleur au hasard. Depuis que les ex
 *      æquo boivent la même chose et calent ensemble, il n'a plus rien à
 *      protéger.
 *
 * DEUX RANGS, ET C'EST VOULU. `finalRank` est toujours distinct : il ordonne
 * l'affichage sans jamais deux fois le même numéro, et c'est là — et là
 * seulement — que le hachage sert encore. `tiedRank` est le rang de
 * compétition (1, 2, 2, 4) : les ex æquo le partagent, et c'est lui qui
 * décide des gorgées.
 */
export function computeQuestionRanking(
  format: QuestionFormat,
  ballots: QuestionBallot[],
  playerIds: string[],
): PlayerScore[] {
  const borda = new Map<string, number>();
  const firsts = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const id of playerIds) {
    borda.set(id, 0);
    firsts.set(id, 0);
    counts.set(id, 0);
  }

  for (const ballot of ballots) {
    for (const a of ballot) {
      if (!borda.has(a.playerId)) continue;
      if (format === "ranking") {
        borda.set(a.playerId, (borda.get(a.playerId) ?? 0) + a.rank);
        if (a.rank === 1) firsts.set(a.playerId, (firsts.get(a.playerId) ?? 0) + 1);
      } else if (a.rank === 1) {
        counts.set(a.playerId, (counts.get(a.playerId) ?? 0) + 1);
        firsts.set(a.playerId, (firsts.get(a.playerId) ?? 0) + 1);
      }
    }
  }

  const scored = playerIds.map((id) => ({
    playerId: id,
    bordaScore: format === "ranking" ? (borda.get(id) ?? 0) : null,
    voteCount: format === "single_choice" ? (counts.get(id) ?? 0) : null,
    firstPlaceCount: firsts.get(id) ?? 0,
  }));

  scored.sort((a, b) => {
    const d =
      format === "ranking"
        ? (a.bordaScore ?? 0) - (b.bordaScore ?? 0)
        : (b.voteCount ?? 0) - (a.voteCount ?? 0);
    if (d !== 0) return d;
    // Le hachage n'ordonne plus que l'AFFICHAGE de deux ex æquo. Il ne décide
    // plus jamais d'une gorgée : celles-ci suivent `tiedRank`, qu'ils partagent.
    return hashId(a.playerId) - hashId(b.playerId);
  });

  // Ex æquo = même score, sans autre condition.
  const sameScore = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
    format === "ranking" ? a.bordaScore === b.bordaScore : a.voteCount === b.voteCount;

  const tiedRanks: number[] = [];
  scored.forEach((s, i) => {
    // Rang de compétition : on reprend celui du précédent s'il a le même
    // score, sinon on saute à la position courante (1, 2, 2, 4).
    tiedRanks.push(i > 0 && sameScore(s, scored[i - 1]) ? tiedRanks[i - 1] : i + 1);
  });

  const top = scored[0];
  return scored.map((s, i) => ({
    ...s,
    finalRank: i + 1,
    tiedRank: tiedRanks[i],
    tiedForWin: top ? sameScore(s, top) : false,
  }));
}
