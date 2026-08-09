import { describe, expect, it } from "vitest";
import { questionModesFor } from "./question-modes";
import type { Category, RankRow } from "./presentation-types";

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

function category(prompt: string, format: string, players: RankRow[]): Category {
  return { questionId: prompt, index: 0, prompt, format, players, jury: [] };
}

/** « Perdant boit » : les gorgées montent, le dernier cale. */
const queue = (prompt: string) =>
  category(prompt, "ranking", [row(1, 1), row(2, 2), row(3, 8, true)]);

/** « Gagnant boit » : le premier cale, les gorgées décroissent. */
const tete = (prompt: string) =>
  category(prompt, "ranking", [row(1, 8, true), row(2, 2), row(3, 1)]);

/** Désignation : la tête cale, personne d'autre ne boit. */
const designation = (prompt: string) =>
  category(prompt, "single_choice", [row(1, 8, true), row(2, 0), row(3, 0)]);

describe("questionModesFor", () => {
  it("ne retient que les modes présents, dans l'ordre d'apparition", () => {
    const modes = questionModesFor([designation("a"), queue("b"), designation("c")], "ESCALATION");
    expect(modes.map((m) => m.kind)).toEqual(["single_choice", "ranking"]);
    expect(modes.map((m) => m.count)).toEqual([2, 1]);
  });

  it("une désignation ne fait boire qu'une personne, quoi qu'il arrive", () => {
    const [mode] = questionModesFor([designation("a")], "ESCALATION");
    expect(mode.title).toBe("Désignation");
    expect(mode.drinkNote).toContain("Les autres ne boivent pas");
  });

  it("perdant boit : les gorgées montent jusqu'au shooter de la dernière place", () => {
    const [mode] = questionModesFor([queue("a")], "ESCALATION");
    expect(mode.title).toBe("Classement");
    expect(mode.drinkNote).toContain("La dernière place boit un shooter");
  });

  it("gagnant boit : le shooter est en TÊTE et les autres boivent quand même", () => {
    // C'est la formulation qui manquait : la carte annonçait « le dernier
    // cale » sur une catégorie où c'était le premier.
    const [mode] = questionModesFor([tete("a")], "ESCALATION");
    expect(mode.drinkNote).toContain("La première place boit un shooter");
    expect(mode.drinkNote).toContain("de moins en moins");
  });

  it("signale un classement qui porte les deux sens", () => {
    const [mode] = questionModesFor([queue("a"), tete("b")], "ESCALATION");
    expect(mode.kind).toBe("ranking");
    expect(mode.drinkNote).toContain("Tout le monde boit");
    expect(mode.drinkNote).toContain("la première place ou à la dernière");
  });

  it("retombe sur la valeur de pré-remplissage quand rien n'est dépouillé", () => {
    const vierge = category("vierge", "ranking", []);
    expect(questionModesFor([vierge], "ESCALATION")[0].drinkNote).toContain(
      "La dernière place boit un shooter",
    );
    expect(questionModesFor([vierge], "TOP_UNIQUE")[0].drinkNote).toContain(
      "La première place boit un shooter",
    );
  });

  it("annonce le nombre de catégories par mode", () => {
    const modes = questionModesFor([queue("a"), tete("b"), designation("c")], "ESCALATION");
    expect(modes.find((m) => m.kind === "ranking")?.count).toBe(2);
    expect(modes.find((m) => m.kind === "single_choice")?.count).toBe(1);
  });
});
