import type { DrinkRule, PlayerScore } from "./types";

/**
 * Drinks (in gorgées) each player takes for ONE question, from its OFFICIAL
 * ranking + the applicable rule. A shooter is worth `shooterValue` gorgées.
 *
 *  - TOP_UNIQUE : le ou les premiers calent un shooter, personne d'autre ne
 *    boit. Les vraies égalités en tête boivent toutes (ex æquo).
 *  - ESCALATION : tout le monde boit. 1er = 1 gorgée, 2e = 2, … et le DERNIER
 *    cale un shooter au lieu de ses N gorgées.
 *  - ESCALATION_INVERSE : le miroir. Le PREMIER cale le shooter, puis les
 *    gorgées décroissent vers le bas du classement (2e = N-1, …, dernier = 1).
 *    C'est la règle des questions entourage, où la note la plus haute désigne
 *    celui qui correspond le mieux à l'énoncé : il paie le plus, et les autres
 *    trinquent quand même, à proportion inverse de leur rang.
 *
 * `ranking` ne contient QUE les joueurs réellement classés. Sur une question
 * entourage, un joueur que personne n'a noté n'y figure pas : il n'apparaît
 * donc pas non plus dans la carte rendue, et l'appelant lui laisse 0. C'est
 * voulu — `n` vaut le nombre de joueurs notés, pas le nombre de nommés, sans
 * quoi l'échelle des gorgées comporterait des trous.
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
    } else if (rule === "ESCALATION_INVERSE") {
      out.set(r.playerId, r.finalRank === 1 ? shooterValue : n - r.finalRank + 1);
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
