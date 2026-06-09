import type { DrinkRule, PlayerScore } from "./types";

/**
 * Drinks (in gorgées) each player takes for ONE question, from its OFFICIAL
 * ranking + the applicable rule. A shooter is worth `shooterValue` gorgées.
 *
 * ASSUMPTION — confirm with product (spec §5.4 / §7 are worth double-checking):
 *  - TOP_UNIQUE: the 1st-place player(s) drink one shooter; everyone else 0.
 *    Genuine ties for 1st all drink (ex æquo).
 *  - ESCALATION: everyone drinks — 1st place = 1 gorgée, 2nd = 2, …, and the
 *    LAST-ranked drinks a shooter (= shooterValue) instead of N gorgées.
 *
 * Both directions are a one-line change here if the intent is reversed.
 */
export function questionDrinks(
  ranking: PlayerScore[],
  rule: DrinkRule,
  shooterValue: number,
): Map<string, number> {
  const n = ranking.length;
  const out = new Map<string, number>();
  for (const r of ranking) {
    if (rule === "TOP_UNIQUE") {
      out.set(r.playerId, r.tiedForWin ? shooterValue : 0);
    } else {
      out.set(r.playerId, r.finalRank === n ? shooterValue : r.finalRank);
    }
  }
  return out;
}

/** Sum drink maps over several questions into per-player totals. */
export function sumDrinks(
  perQuestion: Map<string, number>[],
  playerIds: string[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const id of playerIds) totals.set(id, 0);
  for (const q of perQuestion) {
    for (const id of playerIds) totals.set(id, (totals.get(id) ?? 0) + (q.get(id) ?? 0));
  }
  return totals;
}
