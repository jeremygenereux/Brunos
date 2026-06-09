import { describe, it, expect } from "vitest";
import { equalize, type QuestionLoad } from "./equalizer";

function q(id: string, drinks: Record<string, number>): QuestionLoad {
  return { questionId: id, drinks: new Map(Object.entries(drinks)) };
}

describe("equalize", () => {
  it("finds a perfectly balanced subset when one exists", () => {
    const players = ["a", "b"];
    const candidates = [
      q("q1", { a: 4, b: 0 }),
      q("q2", { a: 0, b: 4 }),
      q("q3", { a: 4, b: 0 }),
      q("q4", { a: 0, b: 4 }),
    ];
    const r = equalize(candidates, players, 2, { seed: 1 });
    expect(r.selected.length).toBe(2);
    expect(r.spread).toBe(0);
    expect(r.totals.a).toBe(r.totals.b);
  });

  it("is deterministic for a given seed", () => {
    const players = ["a", "b", "c"];
    const candidates = Array.from({ length: 8 }, (_, i) =>
      q(`q${i}`, { a: i, b: 8 - i, c: (i * 3) % 5 }),
    );
    const r1 = equalize(candidates, players, 4, { seed: 42 });
    const r2 = equalize(candidates, players, 4, { seed: 42 });
    expect([...r1.selected].sort()).toEqual([...r2.selected].sort());
    expect(r1.spread).toBe(r2.spread);
  });

  it("respects k and returns a non-negative spread", () => {
    const players = ["a", "b", "c"];
    const candidates = Array.from({ length: 6 }, (_, i) =>
      q(`q${i}`, { a: (i * 2) % 7, b: (i * 5) % 7, c: (i + 3) % 7 }),
    );
    const r = equalize(candidates, players, 3, { seed: 7, iterations: 2000 });
    expect(r.selected.length).toBe(3);
    expect(r.spread).toBeGreaterThanOrEqual(0);
  });

  it("selects all when k >= candidate count", () => {
    const r = equalize([q("q1", { a: 1 }), q("q2", { a: 2 })], ["a"], 5);
    expect(r.selected.sort()).toEqual(["q1", "q2"]);
    expect(r.totals.a).toBe(3);
  });
});
