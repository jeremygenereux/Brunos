import { describe, it, expect } from "vitest";
import { questionDrinks, shooterIdsOf, sumDrinks } from "./drinks";
import type { PlayerScore } from "./types";

function mkRanking(order: string[], tiedTop: string[] = [order[0]]): PlayerScore[] {
  return order.map((id, i) => ({
    playerId: id,
    bordaScore: i + 1,
    voteCount: null,
    firstPlaceCount: 0,
    finalRank: i + 1,
    // Un vrai ex æquo en tête PARTAGE le rang de compétition : 1, 1, 3, 4.
    tiedRank: tiedTop.includes(id) ? 1 : i + 1,
    tiedForWin: tiedTop.includes(id),
  }));
}

describe("questionDrinks", () => {
  it("ESCALATION: 1..N-1 gorgées then a shooter for the last", () => {
    const d = questionDrinks(mkRanking(["a", "b", "c", "d"]), "ESCALATION", 4);
    expect(d.get("a")).toBe(1);
    expect(d.get("b")).toBe(2);
    expect(d.get("c")).toBe(3);
    expect(d.get("d")).toBe(4); // last → shooter
  });

  it("TOP_UNIQUE: only the winner drinks a shooter", () => {
    const d = questionDrinks(mkRanking(["a", "b", "c"]), "TOP_UNIQUE", 5);
    expect(d.get("a")).toBe(5);
    expect(d.get("b")).toBe(0);
    expect(d.get("c")).toBe(0);
  });

  it("TOP_UNIQUE: tied winners all drink", () => {
    const d = questionDrinks(mkRanking(["a", "b", "c"], ["a", "b"]), "TOP_UNIQUE", 4);
    expect(d.get("a")).toBe(4);
    expect(d.get("b")).toBe(4);
    expect(d.get("c")).toBe(0);
  });
});

describe("sumDrinks", () => {
  it("totals across questions", () => {
    const t = sumDrinks(
      [
        new Map([
          ["a", 1],
          ["b", 4],
        ]),
        new Map([
          ["a", 4],
          ["b", 1],
        ]),
      ],
      ["a", "b"],
    );
    expect(t.get("a")).toBe(5);
    expect(t.get("b")).toBe(5);
  });
});

describe("shooterIdsOf", () => {
  const rangs = (paires: [string, number][]) =>
    paires.map(([playerId, tiedRank]) => ({ playerId, tiedRank }));

  it("« perdant boit » : le dernier rang, ex æquo compris", () => {
    const r = rangs([
      ["a", 1],
      ["b", 2],
      ["c", 3],
      ["d", 3],
    ]);
    const d = questionDrinks(
      r.map((x) => ({
        ...x,
        bordaScore: 0,
        voteCount: null,
        firstPlaceCount: 0,
        finalRank: 1,
        tiedForWin: false,
      })),
      "ESCALATION",
      8,
    );
    expect([...shooterIdsOf(r, "ESCALATION", d)].sort()).toEqual(["c", "d"]);
  });

  it("« gagnant boit » : c'est la tête qui trinque", () => {
    const r = rangs([
      ["a", 1],
      ["b", 1],
      ["c", 3],
    ]);
    const d = questionDrinks(
      r.map((x) => ({
        ...x,
        bordaScore: 0,
        voteCount: null,
        firstPlaceCount: 0,
        finalRank: 1,
        tiedForWin: false,
      })),
      "ESCALATION_INVERSE",
      8,
    );
    expect([...shooterIdsOf(r, "ESCALATION_INVERSE", d)].sort()).toEqual(["a", "b"]);
  });

  it("désignation : seuls les plus votés, jamais le reste du classement", () => {
    const r = rangs([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
    const d = questionDrinks(
      r.map((x) => ({
        ...x,
        bordaScore: 0,
        voteCount: null,
        firstPlaceCount: 0,
        finalRank: 1,
        tiedForWin: false,
      })),
      "TOP_UNIQUE",
      8,
    );
    expect([...shooterIdsOf(r, "TOP_UNIQUE", d)]).toEqual(["a"]);
  });

  it("sans bulletin, personne ne cale", () => {
    const r = rangs([
      ["a", 1],
      ["b", 2],
    ]);
    const vide = new Map([
      ["a", 0],
      ["b", 0],
    ]);
    expect(shooterIdsOf(r, "ESCALATION", vide).size).toBe(0);
  });
});
