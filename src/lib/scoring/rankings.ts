import type { EntourageRating, PlayerScore, QuestionBallot, QuestionFormat } from "./types";

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
 * - ranking → Borda: sum of positions; smallest total = 1st. Ties broken by
 *   (a) #times ranked 1st, then (b) stable hash of the player id.
 * - single_choice → vote count; most votes = 1st. Ties broken by stable hash.
 */
export function computeQuestionRanking(
  format: Exclude<QuestionFormat, "entourage">,
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
    avgRating: null,
    firstPlaceCount: firsts.get(id) ?? 0,
  }));

  scored.sort((a, b) => {
    if (format === "ranking") {
      const d = (a.bordaScore ?? 0) - (b.bordaScore ?? 0);
      if (d !== 0) return d;
      if (a.firstPlaceCount !== b.firstPlaceCount) return b.firstPlaceCount - a.firstPlaceCount;
    } else {
      const d = (b.voteCount ?? 0) - (a.voteCount ?? 0);
      if (d !== 0) return d;
    }
    return hashId(a.playerId) - hashId(b.playerId);
  });

  const top = scored[0];
  return scored.map((s, i) => ({
    ...s,
    finalRank: i + 1,
    tiedForWin: top
      ? format === "ranking"
        ? s.bordaScore === top.bordaScore && s.firstPlaceCount === top.firstPlaceCount
        : s.voteCount === top.voteCount
      : false,
  }));
}

/**
 * Classement d'une question ENTOURAGE.
 *
 * Chaque proche note SON joueur de 1 à 10. On moyenne les notes reçues par
 * chaque joueur, puis on classe les moyennes par ordre DÉCROISSANT : la plus
 * haute moyenne arrive première, et c'est elle qui paiera le plus cher une
 * fois la règle de consommation appliquée.
 *
 * DEUX PROPRIÉTÉS QUI COMPTENT
 *
 *  1. Un joueur que personne n'a noté n'apparaît PAS dans le résultat. Il n'est
 *     pas dernier, il est hors classement : il ne peut ni gagner la catégorie
 *     ni boire dessus. Lui attribuer une note d'office reviendrait à le faire
 *     juger par un absent.
 *
 *  2. Le nombre de proches ne pondère rien. Une moyenne de 9 issue de deux
 *     personnes et une moyenne de 9 issue d'une seule se valent, exactement
 *     comme l'a demandé le produit. Les égalités se départagent ensuite par le
 *     hachage stable de l'identifiant, comme partout ailleurs ici, pour que le
 *     même jeu de notes rende toujours le même classement.
 */
export function computeEntourageRanking(
  ratings: EntourageRating[],
  playerIds: string[],
): PlayerScore[] {
  const known = new Set(playerIds);
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();

  for (const r of ratings) {
    if (!known.has(r.playerId)) continue;
    sums.set(r.playerId, (sums.get(r.playerId) ?? 0) + r.rating);
    counts.set(r.playerId, (counts.get(r.playerId) ?? 0) + 1);
  }

  const scored = playerIds
    .filter((id) => (counts.get(id) ?? 0) > 0)
    .map((id) => ({
      playerId: id,
      bordaScore: null,
      voteCount: null,
      avgRating: (sums.get(id) ?? 0) / (counts.get(id) ?? 1),
      firstPlaceCount: 0,
    }));

  scored.sort((a, b) => {
    const d = (b.avgRating ?? 0) - (a.avgRating ?? 0);
    if (d !== 0) return d;
    return hashId(a.playerId) - hashId(b.playerId);
  });

  const top = scored[0];
  return scored.map((s, i) => ({
    ...s,
    finalRank: i + 1,
    tiedForWin: top ? s.avgRating === top.avgRating : false,
  }));
}
