import { describe, expect, it } from "vitest";
import { questionDrinks } from "./drinks";
import { cascadeOf } from "@/lib/editions/reveal-order";
import type { PlayerScore } from "./types";
import type { RankRow } from "@/lib/editions/presentation-types";

const SHOOTER = 15;

function ranking(n: number, tiedTop: number[] = [1]): PlayerScore[] {
  return Array.from({ length: n }, (_, i) => ({
    playerId: `p${i + 1}`,
    bordaScore: i + 1,
    voteCount: null,
    firstPlaceCount: 0,
    finalRank: i + 1,
    // Un vrai ex æquo en tête PARTAGE le rang de compétition : 1, 1, 3, 4.
    tiedRank: tiedTop.includes(i + 1) ? 1 : i + 1,
    tiedForWin: tiedTop.includes(i + 1),
  }));
}

/** Les gorgées dans l'ordre des rangs, pour se lire d'un coup d'œil. */
const parRang = (rule: Parameters<typeof questionDrinks>[1], n = 5) => {
  const d = questionDrinks(ranking(n), rule, SHOOTER);
  return Array.from({ length: n }, (_, i) => d.get(`p${i + 1}`));
};

describe("questionDrinks — les trois règles", () => {
  it("perdant boit : les gorgées montent, le DERNIER cale", () => {
    expect(parRang("ESCALATION")).toEqual([1, 2, 3, 4, SHOOTER]);
  });

  it("gagnant boit : le PREMIER cale, puis les gorgées décroissent", () => {
    expect(parRang("ESCALATION_INVERSE")).toEqual([SHOOTER, 4, 3, 2, 1]);
  });

  it("choix unique : la tête cale, personne d'autre ne boit", () => {
    expect(parRang("TOP_UNIQUE")).toEqual([SHOOTER, 0, 0, 0, 0]);
  });

  it("LE BUG DU GALA FIRME-ÉCOLE : un classement ne laisse jamais la table à sec", () => {
    // Quatorze questions de classement portaient TOP_UNIQUE : une personne
    // buvait, les quatre autres rien. C'est ce que « gagnant boit » ne doit
    // plus jamais produire.
    const casse = parRang("TOP_UNIQUE");
    expect(casse.slice(1).every((g) => g === 0)).toBe(true);

    const repare = parRang("ESCALATION_INVERSE");
    expect(repare.every((g) => (g ?? 0) > 0)).toBe(true);
  });

  it("les deux sens d'un classement sont le miroir l'un de l'autre", () => {
    expect(parRang("ESCALATION_INVERSE")).toEqual([...parRang("ESCALATION")].reverse());
  });

  it("l'échelle suit le nombre de joueurs, quel qu'il soit", () => {
    expect(parRang("ESCALATION_INVERSE", 3)).toEqual([SHOOTER, 2, 1]);
    expect(parRang("ESCALATION_INVERSE", 8)).toEqual([SHOOTER, 7, 6, 5, 4, 3, 2, 1]);
    expect(parRang("ESCALATION", 8)).toEqual([1, 2, 3, 4, 5, 6, 7, SHOOTER]);
  });

  it("les ex æquo en tête d'un choix unique calent tous", () => {
    const d = questionDrinks(ranking(4, [1, 2]), "TOP_UNIQUE", SHOOTER);
    expect([d.get("p1"), d.get("p2"), d.get("p3")]).toEqual([SHOOTER, SHOOTER, 0]);
  });
});

/* ── La chorégraphie de scène, dérivée des mêmes gorgées ─────────────── */

function rows(drinks: number[], shooterRank: number): RankRow[] {
  return drinks.map((d, i) => ({
    playerId: `p${i + 1}`,
    personId: null,
    name: `J${i + 1}`,
    headshot: null,
    finalRank: i + 1,
    drinks: d,
    isShooter: i + 1 === shooterRank,
  }));
}

describe("cascadeOf — ce que la salle voit", () => {
  it("perdant boit : on déroule, l'avant-dernier garde le climax", () => {
    const c = cascadeOf(rows([1, 2, 3, SHOOTER], 4));
    expect(c.rankingMatters).toBe(true);
    expect(c.buildUp.map((g) => g.rank)).toEqual([1, 2]);
    expect(c.penultimate?.rank).toBe(3);
  });

  it("gagnant boit : le caleur est PREMIER et la cascade se déroule quand même", () => {
    // Le cas que l'ancienne déduction « le shooter est dernier » ratait : elle
    // concluait à un choix unique et n'affichait qu'un visage.
    const c = cascadeOf(rows([SHOOTER, 4, 3, 2, 1], 1));
    expect(c.rankingMatters).toBe(true);
    expect(c.shooters.map((g) => g.rank)).toEqual([1]);
    // On remonte du moins chargé au plus chargé, en s'arrêtant sous le caleur.
    expect(c.buildUp.map((g) => g.rank)).toEqual([5, 4, 3]);
    expect(c.penultimate?.rank).toBe(2);
  });

  it("choix unique : un seul visage, le classement ne raconte rien", () => {
    const c = cascadeOf(rows([SHOOTER, 0, 0, 0], 1));
    expect(c.rankingMatters).toBe(false);
    expect(c.buildUp).toEqual([]);
    expect(c.penultimate).toBeNull();
  });

  it("ne réordonne pas le tableau reçu", () => {
    const r = rows([SHOOTER, 3, 2, 1], 1);
    const avant = r.map((p) => p.finalRank);
    cascadeOf(r);
    expect(r.map((p) => p.finalRank)).toEqual(avant);
  });
});
