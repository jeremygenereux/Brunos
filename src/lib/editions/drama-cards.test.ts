import { describe, expect, it } from "vitest";
import { buildDramaCards, DRAMA_MAX_ON_STAGE, type DramaBallot } from "./drama-cards";
import { computeQuestionRanking } from "@/lib/scoring/rankings";
import type { DrinkRule } from "@/lib/scoring/types";

const NOMS = new Map([
  ["a", "Amélie"],
  ["b", "Bruno"],
  ["c", "Cléo"],
  ["d", "Daphné"],
]);
const P = [...NOMS.keys()];

/** Un bulletin : l'ordre donné, et qui le dépose. */
function bulletin(votant: string, soi: string | null, ordre: string[]): DramaBallot {
  return {
    voterName: NOMS.get(votant) ?? votant,
    selfPlayerId: soi,
    byPlayer: new Map(ordre.map((id, i) => [id, i + 1])),
    maxRank: ordre.length,
  };
}

function cartes(ballots: DramaBallot[], rule: DrinkRule, format = "ranking") {
  const official = computeQuestionRanking(
    format === "ranking" ? "ranking" : "single_choice",
    ballots.map((b) => [...b.byPlayer.entries()].map(([playerId, rank]) => ({ playerId, rank }))),
    P,
  );
  return buildDramaCards({ format, rule, ballots, official, playerName: NOMS });
}

const kinds = (c: { kind: string }[]) => c.map((x) => x.kind);

describe("Sans appel", () => {
  it("sort quand la première place est unanime ET qu'elle cale", () => {
    const c = cartes(
      [
        bulletin("a", "a", ["c", "a", "b", "d"]),
        bulletin("b", "b", ["c", "b", "a", "d"]),
        bulletin("d", "d", ["c", "d", "a", "b"]),
      ],
      "ESCALATION_INVERSE",
    );
    const carte = c.find((x) => x.kind === "unanimous_first");
    expect(carte?.title).toBe("Sans appel");
    expect(carte?.detail).toContain("Cléo");
  });

  it("sort aussi sur une désignation, où le plus voté cale", () => {
    const votes: DramaBallot[] = ["a", "b", "d"].map((v) => ({
      voterName: NOMS.get(v)!,
      selfPlayerId: v,
      byPlayer: new Map([["c", 1]]),
      maxRank: 1,
    }));
    expect(kinds(cartes(votes, "TOP_UNIQUE", "single_choice"))).toContain("unanimous_first");
  });

  it("ne sort PAS pour la première place quand c'est le dernier qui cale", () => {
    const c = cartes(
      [
        bulletin("a", "a", ["c", "a", "b", "d"]),
        bulletin("b", "b", ["c", "b", "a", "d"]),
      ],
      "ESCALATION",
    );
    expect(kinds(c)).not.toContain("unanimous_first");
  });

  it("sort pour la dernière place en « perdant boit »", () => {
    const c = cartes(
      [
        bulletin("a", "a", ["b", "c", "a", "d"]),
        bulletin("b", "b", ["c", "a", "b", "d"]),
      ],
      "ESCALATION",
    );
    const carte = c.find((x) => x.kind === "unanimous_last");
    expect(carte?.title).toBe("Sans appel");
    expect(carte?.detail).toContain("Daphné");
  });
});

describe("Rancune et Admiration mutuelles", () => {
  const seDetestent = [
    bulletin("a", "a", ["c", "d", "b"]),
    bulletin("b", "b", ["c", "d", "a"]),
    bulletin("c", "c", ["d", "a", "b"]),
  ];

  it("« perdant boit » : se mettre mutuellement dernier est une rancune", () => {
    expect(kinds(cartes(seDetestent, "ESCALATION"))).toContain("mutual_last");
  });

  it("« gagnant boit » : la rancune n'a plus de sens, c'est l'admiration qu'on regarde", () => {
    const k = kinds(cartes(seDetestent, "ESCALATION_INVERSE"));
    expect(k).not.toContain("mutual_last");
  });

  it("« gagnant boit » : se mettre mutuellement premier est une accusation réciproque", () => {
    const c = cartes(
      [
        bulletin("a", "a", ["b", "c", "d"]),
        bulletin("b", "b", ["a", "c", "d"]),
        bulletin("c", "c", ["d", "a", "b"]),
      ],
      "ESCALATION_INVERSE",
    );
    const carte = c.find((x) => x.kind === "mutual_first");
    expect(carte?.title).toBe("Admiration mutuelle");
  });
});

describe("Sans complexe et Aucune illusion", () => {
  it("« perdant boit » : se mettre premier, c'est de l'aplomb", () => {
    const c = cartes(
      [bulletin("a", "a", ["a", "b", "c", "d"]), bulletin("b", "b", ["b", "a", "c", "d"])],
      "ESCALATION",
    );
    expect(c.find((x) => x.kind === "self_top")?.title).toBe("Sans complexe");
  });

  it("« gagnant boit » : se mettre premier, c'est réclamer le shooter", () => {
    const c = cartes(
      [bulletin("a", "a", ["a", "b", "c", "d"]), bulletin("b", "b", ["b", "a", "c", "d"])],
      "ESCALATION_INVERSE",
    );
    expect(c.find((x) => x.kind === "self_top")?.title).toBe("Aucune illusion");
  });

  it("est masquée quand « Dans le déni » vise la même personne", () => {
    // Amélie se met 1re ; en « perdant boit » elle finit dernière et cale.
    const c = cartes(
      [
        bulletin("a", "a", ["a", "b", "c", "d"]),
        bulletin("b", "b", ["b", "c", "d", "a"]),
        bulletin("c", "c", ["c", "b", "d", "a"]),
        bulletin("d", "d", ["d", "b", "c", "a"]),
      ],
      "ESCALATION",
    );
    expect(kinds(c)).toContain("self_delusion");
    const complexes = c.filter((x) => x.kind === "self_top");
    expect(complexes.some((x) => x.detail.includes("Amélie"))).toBe(false);
  });
});

describe("Sacrifice humain et Joueur défensif", () => {
  it("épinglé celui qui envoie au shooter quelqu'un qui l'avait épargné", () => {
    // Daphné cale (dernière). Amélie l'y envoie ; Daphné avait mis Amélie 1re.
    const c = cartes(
      [
        bulletin("a", "a", ["b", "c", "d"]),
        bulletin("b", "b", ["c", "a", "d"]),
        bulletin("d", "d", ["a", "b", "c"]),
      ],
      "ESCALATION",
    );
    const carte = c.find((x) => x.kind === "sacrificed_friend");
    expect(carte?.title).toBe("Sacrifice humain");
    expect(carte?.detail).toContain("Amélie");
  });

  it("désigne le seul défenseur du caleur", () => {
    const c = cartes(
      [
        bulletin("a", "a", ["d", "b", "c"]),
        bulletin("b", "b", ["c", "a", "d"]),
        bulletin("c", "c", ["a", "b", "d"]),
      ],
      "ESCALATION",
    );
    const carte = c.find((x) => x.kind === "lone_defender");
    if (carte) expect(carte.title).toBe("Joueur défensif");
  });
});

describe("À contre-courant", () => {
  it("exige le bulletin EXACTEMENT inverse — on la garde rare volontairement", () => {
    const c = cartes(
      [
        bulletin("a", "a", ["a", "b", "c", "d"]),
        bulletin("b", "b", ["a", "b", "c", "d"]),
        bulletin("c", "c", ["d", "c", "b", "a"]),
      ],
      "ESCALATION",
    );
    const carte = c.find((x) => x.kind === "protest_vote");
    expect(carte?.title).toBe("À contre-courant");
    expect(carte?.detail).toContain("Cléo");
  });

  it("ne sort pas pour un bulletin seulement divergent", () => {
    const c = cartes(
      [
        bulletin("a", "a", ["a", "b", "c", "d"]),
        bulletin("b", "b", ["a", "b", "c", "d"]),
        bulletin("c", "c", ["b", "a", "d", "c"]),
      ],
      "ESCALATION",
    );
    expect(kinds(c)).not.toContain("protest_vote");
  });
});

describe("priorité et plafond", () => {
  it("trie du plus rare au plus courant", () => {
    const c = cartes(
      [
        bulletin("a", "a", ["a", "b", "c", "d"]),
        bulletin("b", "b", ["a", "b", "c", "d"]),
        bulletin("c", "c", ["d", "c", "b", "a"]),
      ],
      "ESCALATION",
    );
    // « À contre-courant » passe devant tout le reste.
    expect(c[0].kind).toBe("protest_vote");
    const rangs = kinds(c).map((k) =>
      ["protest_vote", "unanimous_first", "unanimous_last", "self_delusion"].includes(k) ? 0 : 1,
    );
    expect(rangs).toEqual([...rangs].sort());
  });

  it("la scène en garde quatre, l'archive les garde toutes", () => {
    const toutes = cartes(
      [
        bulletin("a", "a", ["a", "b", "c", "d"]),
        bulletin("b", "b", ["b", "a", "c", "d"]),
        bulletin("c", "c", ["c", "a", "b", "d"]),
        bulletin("d", "d", ["d", "a", "b", "c"]),
      ],
      "ESCALATION",
    );
    expect(toutes.slice(0, DRAMA_MAX_ON_STAGE).length).toBeLessThanOrEqual(4);
    expect(DRAMA_MAX_ON_STAGE).toBe(4);
  });

  it("ne rend rien sans bulletin", () => {
    expect(cartes([], "ESCALATION")).toEqual([]);
  });
});

describe("le catalogue annoncé en début de soirée", () => {
  it("ne promet pas une déboule impossible", async () => {
    const { dramaCatalogueFor } = await import("./drama-cards");
    // Une soirée sans « gagnant boit » ne peut pas produire d'admiration
    // mutuelle : l'annoncer ferait attendre pour rien.
    const kinds = dramaCatalogueFor(["ESCALATION"]).map((c) => c.kind);
    expect(kinds).not.toContain("mutual_first");
    expect(kinds).toContain("mutual_last");
  });

  it("s'ouvre dès qu'une règle la rend possible", async () => {
    const { dramaCatalogueFor } = await import("./drama-cards");
    const kinds = dramaCatalogueFor(["ESCALATION", "ESCALATION_INVERSE"]).map((c) => c.kind);
    expect(kinds).toContain("mutual_first");
    expect(kinds).toContain("mutual_last");
  });

  it("une soirée de désignations seules garde le strict nécessaire", async () => {
    const { dramaCatalogueFor } = await import("./drama-cards");
    const kinds = dramaCatalogueFor(["TOP_UNIQUE"]).map((c) => c.kind);
    expect(kinds).toEqual(["unanimous_first", "self_top"]);
  });
});
