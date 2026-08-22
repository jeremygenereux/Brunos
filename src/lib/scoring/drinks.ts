import type { DrinkRule, PlayerScore } from "./types";

/**
 * Drinks (in gorgées) each player takes for ONE question, from its OFFICIAL
 * ranking + the applicable rule. A shooter is worth `shooterValue` gorgées.
 *
 *  - TOP_UNIQUE — le ou les premiers calent, PERSONNE d'autre ne boit. Réservé
 *    au CHOIX UNIQUE : là, les places 2 à N ne sont qu'un décompte de voix, pas
 *    un classement, et il n'y a rien à échelonner. Les vraies égalités en tête
 *    calent toutes (ex æquo).
 *  - ESCALATION — « Perdant boit ». Tout le monde boit : 1er = 1 gorgée,
 *    2e = 2, … et le DERNIER cale un shooter au lieu de ses N gorgées.
 *  - ESCALATION_INVERSE — « Gagnant boit ». Le miroir : le PREMIER cale, puis
 *    les gorgées décroissent (2e = N-1, …, dernier = 1 gorgée).
 *
 * POURQUOI LE MIROIR ET NON « le premier cale, seul ». Appliquer TOP_UNIQUE à
 * un classement jetait l'ordre que les votants avaient établi : une seule
 * personne buvait et la cascade n'avait plus rien à dérouler. Les deux règles
 * d'un classement punissent la même personne — celle qui correspond le plus à
 * un énoncé peu flatteur — et ne diffèrent que par la façon de poser la
 * question.
 *
 * LES EX ÆQUO BOIVENT PAREIL. Tout se calcule sur `tiedRank`, le rang de
 * compétition partagé, jamais sur `finalRank` : deux scores identiques ne
 * peuvent pas donner deux ardoises différentes. Si l'égalité tombe sur
 * l'extrémité qui cale, TOUS les ex æquo calent — c'est la règle de la
 * maison, et c'est ce que la salle attend en voyant deux visages s'afficher.
 */
export function questionDrinks(
  ranking: PlayerScore[],
  rule: DrinkRule,
  shooterValue: number,
): Map<string, number> {
  const n = ranking.length;
  const out = new Map<string, number>();

  // Le « dernier » n'est pas forcément le rang N : avec des ex æquo, le
  // classement peut s'arrêter à 1, 2, 3, 3. Le dernier groupe est celui qui
  // porte le rang de compétition le plus élevé.
  const dernierRang = ranking.reduce((max, r) => Math.max(max, r.tiedRank), 0);

  for (const r of ranking) {
    if (rule === "TOP_UNIQUE") {
      out.set(r.playerId, r.tiedRank === 1 ? shooterValue : 0);
    } else if (rule === "ESCALATION_INVERSE") {
      out.set(r.playerId, r.tiedRank === 1 ? shooterValue : n - r.tiedRank + 1);
    } else {
      out.set(r.playerId, r.tiedRank === dernierRang ? shooterValue : r.tiedRank);
    }
  }
  return out;
}

/**
 * Qui prend le shooter sur une question.
 *
 * Même définition que `questionDrinks`, au même endroit : la règle de
 * l'extrémité qui trinque est recopiée dès qu'on en a besoin ailleurs, et deux
 * copies finissent toujours par diverger. La compilation et la présentation
 * doivent désigner exactement les mêmes personnes.
 *
 * Sur une désignation il n'y a pas d'extrémité : boire, c'est caler. Sans
 * bulletin, personne ne cale — un classement vide ne désigne pas un coupable.
 */
export function shooterIdsOf(
  ranking: readonly { playerId: string; tiedRank: number }[],
  rule: DrinkRule,
  drinks: ReadonlyMap<string, number>,
): Set<string> {
  const dernierRang = ranking.reduce((max, r) => Math.max(max, r.tiedRank), 0);
  const out = new Set<string>();
  for (const r of ranking) {
    if ((drinks.get(r.playerId) ?? 0) <= 0) continue;
    const cale =
      rule === "ESCALATION"
        ? r.tiedRank === dernierRang
        : rule === "ESCALATION_INVERSE"
          ? r.tiedRank === 1
          : true; // TOP_UNIQUE : seuls les plus votés ont des gorgées
    if (cale) out.add(r.playerId);
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
