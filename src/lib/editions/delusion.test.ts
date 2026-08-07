import { describe, expect, it } from "vitest";
import { detectDelusions, type DelusionBallot } from "./delusion";
import { computeQuestionRanking } from "../scoring/rankings";
import type { QuestionBallot } from "../scoring/types";

// Six joueurs, comme au gala. Les classements officiels sont produits par le
// VRAI calcul (Borda), pas fabriqués à la main : la carte doit rester d'accord
// avec ce que la compilation affiche.
const P = ["a", "b", "c", "d", "e", "f"];

/** Un bulletin complet : permutation des six joueurs, rang 1 → 6. */
function ballot(order: string[]): QuestionBallot {
  return order.map((playerId, i) => ({ playerId, rank: i + 1 }));
}

function delusionBallot(
  voterName: string,
  selfPlayerId: string,
  order: string[],
): DelusionBallot {
  return {
    voterName,
    selfPlayerId,
    selfRank: order.indexOf(selfPlayerId) + 1,
    maxRank: order.length,
  };
}

describe("detectDelusions — perdant boit (ESCALATION)", () => {
  // Tout le monde met « f » dernier… sauf « f », qui se met premier. Son
  // propre bulletin le remonte un peu (c'est le jeu du Borda), mais pas
  // assez : il finit dernier quand même.
  const ballots: QuestionBallot[] = [
    ballot(["a", "b", "c", "d", "e", "f"]),
    ballot(["b", "a", "c", "d", "e", "f"]),
    ballot(["a", "c", "b", "d", "e", "f"]),
    ballot(["f", "e", "a", "b", "c", "d"]), // le bulletin de f
  ];
  const official = computeQuestionRanking("ranking", ballots, P);

  it("attrape le caleur qui s'était donné la première place", () => {
    const cards = detectDelusions(
      [delusionBallot("Félix", "f", ["f", "e", "a", "b", "c", "d"])],
      official,
      "ESCALATION",
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe("self_delusion");
    expect(cards[0].detail).toContain("Félix");
    expect(cards[0].detail).toContain("première place");
  });

  it("ignore un caleur lucide, qui se savait en danger", () => {
    // « f » cale, mais il s'était mis avant-dernier : pas de déni.
    const cards = detectDelusions(
      [delusionBallot("Félix", "f", ["a", "b", "c", "d", "f", "e"])],
      official,
      "ESCALATION",
    );
    expect(cards).toEqual([]);
  });

  it("ignore un votant qui s'était mis premier SANS caler", () => {
    // « a » finit premier officiel : se donner la première place est de
    // l'aplomb (self_top s'en charge), pas du déni.
    const cards = detectDelusions(
      [delusionBallot("Nicolas", "a", ["a", "b", "c", "d", "e", "f"])],
      official,
      "ESCALATION",
    );
    expect(cards).toEqual([]);
  });

  it("ignore l'entourage, qui n'est jamais nommé", () => {
    const cards = detectDelusions(
      [{ voterName: "Danielle", selfPlayerId: null, selfRank: null, maxRank: 6 }],
      official,
      "ESCALATION",
    );
    expect(cards).toEqual([]);
  });
});

describe("detectDelusions — gagnant boit (TOP_UNIQUE)", () => {
  // Tout le monde met « a » premier… sauf « a », qui se met dernier. Son
  // bulletin doit répartir les autres sans loger personne devant lui au
  // total, sinon ce serait un autre gagnant.
  const ballots: QuestionBallot[] = [
    ballot(["a", "b", "c", "d", "e", "f"]),
    ballot(["a", "c", "b", "d", "e", "f"]),
    ballot(["a", "b", "d", "c", "e", "f"]),
    ballot(["e", "f", "c", "d", "b", "a"]), // le bulletin de a
  ];
  const official = computeQuestionRanking("ranking", ballots, P);

  it("attrape le gagnant qui se croyait à l'abri, bon dernier", () => {
    const cards = detectDelusions(
      [delusionBallot("Nicolas", "a", ["e", "f", "c", "d", "b", "a"])],
      official,
      "TOP_UNIQUE",
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe("self_delusion");
    expect(cards[0].detail).toContain("Nicolas");
  });

  it("ignore le gagnant qui se voyait au milieu : surpris, pas dans le déni", () => {
    const cards = detectDelusions(
      [delusionBallot("Nicolas", "a", ["e", "f", "a", "c", "d", "b"])],
      official,
      "TOP_UNIQUE",
    );
    expect(cards).toEqual([]);
  });
});

describe("detectDelusions — garde-fous", () => {
  it("ne rend rien sans classement officiel", () => {
    expect(
      detectDelusions(
        [{ voterName: "X", selfPlayerId: "a", selfRank: 1, maxRank: 6 }],
        [],
        "ESCALATION",
      ),
    ).toEqual([]);
  });
});
