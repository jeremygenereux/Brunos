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
 * - ranking → Borda: sum of positions; smallest total = 1st. Ties broken by
 *   (a) #times ranked 1st, then (b) stable hash of the player id.
 * - single_choice → vote count; most votes = 1st. Ties broken by stable hash.
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
