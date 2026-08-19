import { describe, expect, it } from "vitest";
import { groupByRank } from "./rank-groups";
import type { RankRow } from "./presentation-types";

function row(
  finalRank: number,
  tiedRank: number,
  drinks: number,
  flags: Partial<RankRow> = {},
): RankRow {
  return {
    playerId: `p${finalRank}`,
    personId: null,
    name: `J${finalRank}`,
    headshot: null,
    finalRank,
    tiedRank,
    drinks,
    ...flags,
  };
}

describe("groupByRank", () => {
  it("réunit les ex æquo en UNE position", () => {
    // Deux joueurs premiers ex æquo, 15 gorgées chacun.
    const g = groupByRank([
      row(1, 1, 15, { isWinner: true, isShooter: true }),
      row(2, 1, 15, { isWinner: true, isShooter: true }),
      row(3, 2, 4),
      row(4, 3, 3),
      row(5, 3, 3),
    ]);
    expect(g.map((x) => x.rank)).toEqual([1, 2, 3]);
    expect(g[0].players).toHaveLength(2);
    expect(g[0].drinks).toBe(15);
    expect(g[2].players.map((p) => p.name)).toEqual(["J4", "J5"]);
  });

  it("un groupe cale dès qu'un de ses membres cale", () => {
    const g = groupByRank([row(1, 1, 15, { isShooter: true }), row(2, 1, 15)]);
    expect(g[0].isShooter).toBe(true);
    expect(g[0].isWinner).toBe(false);
  });

  it("sans égalité, un groupe par joueur — l'affichage ne change pas", () => {
    const g = groupByRank([row(1, 1, 15), row(2, 2, 4), row(3, 3, 3)]);
    expect(g).toHaveLength(3);
    expect(g.every((x) => x.players.length === 1)).toBe(true);
  });

  it("retombe sur finalRank pour les lignes d'avant la colonne tied_rank", () => {
    const legacy: RankRow[] = [
      { playerId: "a", personId: null, name: "A", headshot: null, finalRank: 1, drinks: 15 },
      { playerId: "b", personId: null, name: "B", headshot: null, finalRank: 2, drinks: 4 },
    ];
    const g = groupByRank(legacy);
    expect(g).toHaveLength(2);
    expect(g.map((x) => x.rank)).toEqual([1, 2]);
  });

  it("n'oublie ni ne duplique personne", () => {
    const rows = [row(1, 1, 9), row(2, 1, 9), row(3, 3, 3), row(4, 4, 1), row(5, 4, 1)];
    const g = groupByRank(rows);
    expect(g.flatMap((x) => x.players).map((p) => p.playerId)).toEqual(
      rows.map((r) => r.playerId),
    );
  });

  it("ne rend rien pour une catégorie sans verdict", () => {
    expect(groupByRank([])).toEqual([]);
  });
});
