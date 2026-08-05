import { describe, expect, it } from "vitest";
import { cascadeOf } from "./reveal-order";
import type { RankRow } from "./presentation-types";

function row(rank: number, drinks: number, isShooter = false): RankRow {
  return {
    playerId: `p${rank}`,
    personId: null,
    name: `J${rank}`,
    headshot: null,
    finalRank: rank,
    drinks,
    isShooter,
  };
}

describe("cascadeOf", () => {
  it("gagnant boit : un seul visage, le classement ne raconte rien", () => {
    const c = cascadeOf([row(1, 8, true), row(2, 0), row(3, 0), row(4, 0)]);
    expect(c.rankingMatters).toBe(false);
    expect(c.shooters.map((s) => s.finalRank)).toEqual([1]);
    expect(c.buildUp).toEqual([]);
    expect(c.penultimate).toBeNull();
  });

  it("gagnant boit avec ex æquo : tous les gagnants calent", () => {
    const c = cascadeOf([row(1, 8, true), row(2, 8, true), row(3, 0)]);
    expect(c.rankingMatters).toBe(false);
    expect(c.shooters).toHaveLength(2);
  });

  it("perdant boit : on déroule les rangs et on garde l'avant-dernier pour la fin", () => {
    const c = cascadeOf([row(1, 1), row(2, 2), row(3, 3), row(4, 8, true)]);
    expect(c.rankingMatters).toBe(true);
    expect(c.shooters.map((s) => s.finalRank)).toEqual([4]);
    expect(c.buildUp.map((p) => p.finalRank)).toEqual([1, 2]);
    expect(c.penultimate?.finalRank).toBe(3);
  });

  it("escalade inversée : le caleur est PREMIER et le classement compte quand même", () => {
    // C'est le cas que l'ancienne déduction « le shooter est dernier » ratait :
    // elle concluait à un gagnant boit et taisait les gorgées des autres.
    const c = cascadeOf([row(1, 8, true), row(2, 3), row(3, 2), row(4, 1)]);
    expect(c.rankingMatters).toBe(true);
    expect(c.shooters.map((s) => s.finalRank)).toEqual([1]);
    // On remonte du moins chargé vers le plus chargé, et on s'arrête juste
    // sous le caleur : 4 (1 gorgée), 3 (2 gorgées), puis climax sur 2.
    expect(c.buildUp.map((p) => p.finalRank)).toEqual([4, 3]);
    expect(c.penultimate?.finalRank).toBe(2);
  });

  it("question entourage partielle : les joueurs hors classement n'y sont pas", () => {
    // Trois joueurs notés sur six ; les trois autres n'ont aucune ligne.
    const c = cascadeOf([row(1, 8, true), row(2, 2), row(3, 1)]);
    expect(c.rankingMatters).toBe(true);
    expect(c.buildUp.map((p) => p.finalRank)).toEqual([3]);
    expect(c.penultimate?.finalRank).toBe(2);
  });

  it("aucun verdict : rien à dérouler", () => {
    expect(cascadeOf([]).shooters).toEqual([]);
    expect(cascadeOf([row(1, 0), row(2, 0)]).rankingMatters).toBe(false);
  });

  it("ne réordonne pas le tableau reçu", () => {
    const players = [row(1, 8, true), row(2, 3), row(3, 1)];
    const avant = players.map((p) => p.finalRank);
    cascadeOf(players);
    expect(players.map((p) => p.finalRank)).toEqual(avant);
  });
});
