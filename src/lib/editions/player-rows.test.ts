import { describe, expect, it } from "vitest";
import { rangeesDe } from "./player-rows";

describe("rangeesDe", () => {
  it("garde tout le monde sur une rangée jusqu'à quatre", () => {
    expect(rangeesDe(1)).toEqual([1]);
    expect(rangeesDe(4)).toEqual([4]);
  });

  it("équilibre le cas qui posait problème : sept joueurs", () => {
    // Le retour à la ligne automatique donnait 6 + 1.
    expect(rangeesDe(7)).toEqual([4, 3]);
  });

  it("n'abandonne jamais un seul visage en fin de galerie", () => {
    for (let n = 2; n <= 40; n++) {
      const rangees = rangeesDe(n);
      expect(rangees.at(-1)).toBeGreaterThan(1);
    }
  });

  it("ne dépasse jamais quatre par rangée", () => {
    for (let n = 1; n <= 40; n++) {
      for (const taille of rangeesDe(n)) expect(taille).toBeLessThanOrEqual(4);
    }
  });

  it("n'oublie ni ne duplique personne", () => {
    for (let n = 0; n <= 40; n++) {
      expect(rangeesDe(n).reduce((a, b) => a + b, 0)).toBe(n);
    }
  });

  it("ne laisse jamais plus d'un écart entre deux rangées", () => {
    for (let n = 1; n <= 40; n++) {
      const rangees = rangeesDe(n);
      expect(Math.max(...rangees) - Math.min(...rangees)).toBeLessThanOrEqual(1);
    }
  });
});
