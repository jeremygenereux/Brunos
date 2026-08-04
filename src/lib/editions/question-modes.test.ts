import { describe, expect, it } from "vitest";
import { questionModesFor } from "./question-modes";
import type { Category, RankRow } from "./presentation-types";

function row(rank: number, drinks: number, extra: Partial<RankRow> = {}): RankRow {
  return {
    playerId: `p${rank}`,
    personId: null,
    name: `J${rank}`,
    headshot: null,
    finalRank: rank,
    drinks,
    ...extra,
  };
}

function category(prompt: string, format: string, players: RankRow[]): Category {
  return { questionId: prompt, index: 0, prompt, format, players, jury: [] };
}

/** « Perdant boit » : les gorgées montent, le dernier rang cale. */
const escalade = (prompt: string, format = "ranking") =>
  category(prompt, format, [row(1, 1), row(2, 2), row(3, 8, { isShooter: true })]);

/** « Gagnant boit » : la première place cale, les autres sont à zéro. */
const topUnique = (prompt: string, format = "single_choice") =>
  category(prompt, format, [
    row(1, 8, { isWinner: true, isShooter: true }),
    row(2, 0),
    row(3, 0),
  ]);

describe("questionModesFor", () => {
  it("ne retient que les modes présents, dans l'ordre d'apparition", () => {
    const modes = questionModesFor([topUnique("a"), escalade("b"), topUnique("c")], "ESCALATION");
    expect(modes.map((m) => m.kind)).toEqual(["single_choice", "ranking"]);
    expect(modes.map((m) => m.count)).toEqual([2, 1]);
  });

  it("dit qu'un choix unique ne fait qu'un seul buveur", () => {
    const [mode] = questionModesFor([topUnique("a")], "TOP_UNIQUE");
    expect(mode.title).toBe("Désignation");
    expect(mode.drinkNote).toBe(
      "La personne qui reçoit le plus de votes boit un shooter. Les autres ne boivent pas.",
    );
  });

  it("dit qu'un classement échelonne les gorgées jusqu'au shooter, en queue", () => {
    const [mode] = questionModesFor([escalade("a")], "ESCALATION");
    expect(mode.title).toBe("Classement");
    expect(mode.drinkNote).toContain("Chaque place boit selon son rang");
    expect(mode.drinkNote).toContain("La dernière place boit un shooter");
  });

  it("place le shooter en tête quand la règle est « gagnant boit »", () => {
    // Une catégorie à classer mais en « gagnant boit » (drink_rule_override) :
    // c'est la chorégraphie observée qui commande, pas la règle de l'édition.
    const [mode] = questionModesFor([topUnique("a", "ranking")], "ESCALATION");
    expect(mode.drinkNote).toBe("La première place boit un shooter. Les autres ne boivent pas.");
  });

  it("signale un mode qui porte les deux règles", () => {
    const [mode] = questionModesFor([escalade("a"), topUnique("b", "ranking")], "ESCALATION");
    expect(mode.kind).toBe("ranking");
    expect(mode.drinkNote).toContain("le shooter va à la première ou à la dernière place");
  });

  it("retombe sur la règle de l'édition quand rien n'est encore tranché", () => {
    const sansVote = category("vierge", "ranking", []);
    expect(questionModesFor([sansVote], "ESCALATION")[0].drinkNote).toContain(
      "La dernière place boit un shooter",
    );
    expect(questionModesFor([sansVote], "TOP_UNIQUE")[0].drinkNote).toContain(
      "La première place boit un shooter",
    );
  });
});
