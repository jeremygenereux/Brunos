import { describe, expect, it } from "vitest";
import { computeQuestionRanking } from "./rankings";
import { questionDrinks } from "./drinks";
import { equalize } from "./equalizer";
import { cascadeOf } from "@/lib/editions/reveal-order";
import type { QuestionBallot } from "./types";
import type { RankRow } from "@/lib/editions/presentation-types";

const SHOOTER = 15;
const P = ["a", "b", "c", "d", "e"];

/** Un bulletin = un votant qui classe les joueurs dans l'ordre donné. */
const ballot = (order: string[]): QuestionBallot =>
  order.map((playerId, i) => ({ playerId, rank: i + 1 }));

/** Raccourci : rang partagé et gorgées, par joueur. */
function verdict(ballots: QuestionBallot[], rule: Parameters<typeof questionDrinks>[1]) {
  const ranking = computeQuestionRanking("ranking", ballots, P);
  const drinks = questionDrinks(ranking, rule, SHOOTER);
  return ranking.map((s) => ({
    id: s.playerId,
    rang: s.tiedRank,
    gorgees: drinks.get(s.playerId),
  }));
}

describe("le rang de compétition", () => {
  it("attribue 1, 2, 2, 4 : les ex æquo partagent, le suivant saute", () => {
    // b et c reçoivent exactement le même total Borda.
    const r = computeQuestionRanking(
      "ranking",
      [ballot(["a", "b", "c", "d", "e"]), ballot(["a", "c", "b", "d", "e"])],
      P,
    );
    const parId = new Map(r.map((s) => [s.playerId, s]));
    expect(parId.get("a")!.tiedRank).toBe(1);
    expect(parId.get("b")!.tiedRank).toBe(2);
    expect(parId.get("c")!.tiedRank).toBe(2);
    expect(parId.get("d")!.tiedRank).toBe(4);
    expect(parId.get("e")!.tiedRank).toBe(5);
  });

  it("même Borda = ex æquo, même avec des premières places différentes", () => {
    // Le cas réel du Gala Firme-École : 1,1,5,5,5 contre 2,3,3,4,5. Même
    // total de 17. L'ancien critère « nombre de fois classé premier » les
    // séparait ; il a été retiré le 9 août 2026 car il contredisait la
    // méthode annoncée et n'était plus utile une fois les ex æquo gérés.
    const r = computeQuestionRanking(
      "ranking",
      [
        // d finit 1,1,5,5,5 ; e finit 2,3,3,4,5 — tous deux à 17.
        [
          { playerId: "d", rank: 1 }, { playerId: "e", rank: 2 },
          { playerId: "a", rank: 3 }, { playerId: "b", rank: 4 }, { playerId: "c", rank: 5 },
        ],
        [
          { playerId: "d", rank: 1 }, { playerId: "e", rank: 3 },
          { playerId: "a", rank: 2 }, { playerId: "b", rank: 4 }, { playerId: "c", rank: 5 },
        ],
        [
          { playerId: "d", rank: 5 }, { playerId: "e", rank: 3 },
          { playerId: "a", rank: 1 }, { playerId: "b", rank: 2 }, { playerId: "c", rank: 4 },
        ],
        [
          { playerId: "d", rank: 5 }, { playerId: "e", rank: 4 },
          { playerId: "a", rank: 1 }, { playerId: "b", rank: 2 }, { playerId: "c", rank: 3 },
        ],
        [
          { playerId: "d", rank: 5 }, { playerId: "e", rank: 5 },
          { playerId: "a", rank: 1 }, { playerId: "b", rank: 2 }, { playerId: "c", rank: 3 },
        ],
      ],
      P,
    );
    const parId = new Map(r.map((s) => [s.playerId, s]));
    expect(parId.get("d")!.bordaScore).toBe(17);
    expect(parId.get("e")!.bordaScore).toBe(17);
    expect(parId.get("d")!.firstPlaceCount).toBe(2);
    expect(parId.get("e")!.firstPlaceCount).toBe(0);
    // Le nombre de premières places diffère, le rang de compétition NON.
    expect(parId.get("d")!.tiedRank).toBe(parId.get("e")!.tiedRank);
  });

  it("garde finalRank distinct pour un affichage stable", () => {
    const r = computeQuestionRanking(
      "ranking",
      [ballot(["a", "b", "c", "d", "e"]), ballot(["a", "c", "b", "d", "e"])],
      P,
    );
    expect(new Set(r.map((s) => s.finalRank)).size).toBe(P.length);
  });
});

describe("les ex æquo boivent pareil", () => {
  const exaequoEnTete = [ballot(["a", "b", "c", "d", "e"]), ballot(["b", "a", "c", "d", "e"])];
  const exaequoEnQueue = [ballot(["a", "b", "c", "d", "e"]), ballot(["a", "b", "c", "e", "d"])];

  it("gagnant boit : DEUX premiers ex æquo calent tous les deux", () => {
    // Le cas du Gala Firme-École : l'archive montrait deux gagnants, la scène
    // un seul verre.
    const v = verdict(exaequoEnTete, "ESCALATION_INVERSE");
    const caleurs = v.filter((x) => x.gorgees === SHOOTER);
    expect(caleurs).toHaveLength(2);
    expect(caleurs.map((x) => x.id).sort()).toEqual(["a", "b"]);
  });

  it("perdant boit : DEUX derniers ex æquo calent tous les deux", () => {
    const v = verdict(exaequoEnQueue, "ESCALATION");
    const caleurs = v.filter((x) => x.gorgees === SHOOTER);
    expect(caleurs).toHaveLength(2);
    expect(caleurs.map((x) => x.id).sort()).toEqual(["d", "e"]);
  });

  it("une égalité au MILIEU donne le même nombre de gorgées", () => {
    const v = verdict(
      [ballot(["a", "b", "c", "d", "e"]), ballot(["a", "c", "b", "d", "e"])],
      "ESCALATION",
    );
    const b = v.find((x) => x.id === "b")!;
    const c = v.find((x) => x.id === "c")!;
    expect(b.gorgees).toBe(c.gorgees);
    expect(b.rang).toBe(c.rang);
  });

  it("choix unique : deux personnes à égalité de votes calent toutes les deux", () => {
    const r = computeQuestionRanking(
      "single_choice",
      [
        [{ playerId: "a", rank: 1 }],
        [{ playerId: "b", rank: 1 }],
      ],
      P,
    );
    const d = questionDrinks(r, "TOP_UNIQUE", SHOOTER);
    expect([d.get("a"), d.get("b")]).toEqual([SHOOTER, SHOOTER]);
    expect(d.get("c")).toBe(0);
  });

  it("deux ex æquo n'ont JAMAIS des gorgées différentes, quelle que soit la règle", () => {
    for (const rule of ["ESCALATION", "ESCALATION_INVERSE", "TOP_UNIQUE"] as const) {
      for (const ballots of [exaequoEnTete, exaequoEnQueue]) {
        const v = verdict(ballots, rule);
        const parRang = new Map<number, Set<number>>();
        for (const x of v) {
          const set = parRang.get(x.rang) ?? new Set<number>();
          set.add(x.gorgees ?? 0);
          parRang.set(x.rang, set);
        }
        for (const [rang, gorgees] of parRang) {
          expect(gorgees.size, `règle ${rule}, rang ${rang}`).toBe(1);
        }
      }
    }
  });
});

describe("la scène montre tous les caleurs", () => {
  function rows(specs: { rank: number; tied: number; drinks: number }[]): RankRow[] {
    const dernier = Math.max(...specs.map((s) => s.tied));
    return specs.map((s) => ({
      playerId: `p${s.rank}`,
      personId: null,
      name: `J${s.rank}`,
      headshot: null,
      finalRank: s.rank,
      tiedRank: s.tied,
      drinks: s.drinks,
      isShooter: s.tied === dernier,
    }));
  }

  it("deux derniers ex æquo forment UNE position, pas deux", () => {
    const c = cascadeOf(
      rows([
        { rank: 1, tied: 1, drinks: 1 },
        { rank: 2, tied: 2, drinks: 2 },
        { rank: 3, tied: 3, drinks: SHOOTER },
        { rank: 4, tied: 3, drinks: SHOOTER },
      ]),
    );
    // Une seule position qui cale, mais deux visages dedans : c'est ce qui
    // permet d'afficher un numéro et une ardoise plutôt que de les répéter.
    expect(c.shooters).toHaveLength(1);
    expect(c.shooters[0].players).toHaveLength(2);
    expect(c.shooters[0].rank).toBe(3);
    expect(c.rankingMatters).toBe(true);
    expect(c.penultimate?.rank).toBe(2);
  });

  it("une égalité au milieu ne se coupe pas entre le déroulé et le climax", () => {
    const c = cascadeOf(
      rows([
        { rank: 1, tied: 1, drinks: 1 },
        { rank: 2, tied: 2, drinks: 3 },
        { rank: 3, tied: 2, drinks: 3 },
        { rank: 4, tied: 4, drinks: SHOOTER },
      ]),
    );
    // Les deux ex æquo restent ensemble : soit dans le déroulé, soit au
    // climax, jamais à cheval — sinon la moitié d'une position vendrait
    // l'autre par élimination.
    const positions = [...c.buildUp, ...(c.penultimate ? [c.penultimate] : [])];
    const groupeExAequo = positions.find((g) => g.rank === 2);
    expect(groupeExAequo?.players).toHaveLength(2);
  });
});

describe("l'égaliseur encaisse les égalités", () => {
  it("équilibre correctement quand des joueurs partagent des gorgées", () => {
    // Deux catégories où deux joueurs calent ensemble : les totaux doivent
    // rester cohérents et l'écart minimal atteignable doit être trouvé.
    const candidats = [
      { questionId: "q1", drinks: new Map([["a", SHOOTER], ["b", SHOOTER], ["c", 1]]) },
      { questionId: "q2", drinks: new Map([["a", 1], ["b", 1], ["c", SHOOTER]]) },
      { questionId: "q3", drinks: new Map([["a", 1], ["b", SHOOTER], ["c", SHOOTER]]) },
    ];
    const r = equalize(candidats, ["a", "b", "c"], 2, { seed: 1 });
    expect(r.selected).toHaveLength(2);
    // Les totaux somment bien ce que portent les catégories retenues.
    const attendu = r.selected.reduce((acc, id) => {
      const d = candidats.find((c) => c.questionId === id)!.drinks;
      for (const p of ["a", "b", "c"]) acc[p] = (acc[p] ?? 0) + (d.get(p) ?? 0);
      return acc;
    }, {} as Record<string, number>);
    expect(r.totals).toEqual(attendu);
    expect(r.spread).toBe(Math.max(...Object.values(attendu)) - Math.min(...Object.values(attendu)));
  });
});

describe("le rang partagé arrive jusque dans les résultats gelés", () => {
  it("resultRowsFor écrit tied_rank, pas seulement final_rank", async () => {
    const { computeQuestionResult, resultRowsFor } = await import("./edition");
    const computed = computeQuestionResult(
      {
        questionId: "q",
        format: "ranking",
        drinkRule: "ESCALATION_INVERSE",
        playerBallots: [ballot(["a", "b", "c", "d", "e"]), ballot(["b", "a", "c", "d", "e"])],
        juryBallots: [],
      },
      P,
      SHOOTER,
    );
    const rows = resultRowsFor(computed).filter((r) => r.audience === "players");

    // a et b sont ex æquo en tête : même rang de compétition, même ardoise,
    // mais deux positions d'affichage distinctes.
    const a = rows.find((r) => r.player_id === "a")!;
    const b = rows.find((r) => r.player_id === "b")!;
    expect(a.tied_rank).toBe(1);
    expect(b.tied_rank).toBe(1);
    expect(a.drinks).toBe(SHOOTER);
    expect(b.drinks).toBe(SHOOTER);
    expect(a.final_rank).not.toBe(b.final_rank);

    // Et le suivant saute à 3.
    expect(rows.find((r) => r.player_id === "c")!.tied_rank).toBe(3);
  });
});
