import { describe, expect, it } from "vitest";
import { computeEntourageRanking } from "./rankings";
import { questionDrinks } from "./drinks";
import { computeQuestionResult, resultRowsFor } from "./edition";
import type { EntourageRating } from "./types";

const PLAYERS = ["a", "b", "c", "d", "e", "f"];
const SHOOTER = 8;

const rank = (ratings: EntourageRating[]) => computeEntourageRanking(ratings, PLAYERS);

describe("computeEntourageRanking", () => {
  it("classe par moyenne décroissante : la plus haute note en tête", () => {
    const out = rank([
      { playerId: "a", rating: 4 },
      { playerId: "b", rating: 9 },
      { playerId: "c", rating: 7 },
    ]);
    expect(out.map((s) => s.playerId)).toEqual(["b", "c", "a"]);
    expect(out.map((s) => s.finalRank)).toEqual([1, 2, 3]);
  });

  it("moyenne les proches d'un même joueur", () => {
    // Deux proches pour « a » (8 et 10 → 9), un seul pour « b » (9).
    const out = rank([
      { playerId: "a", rating: 8 },
      { playerId: "a", rating: 10 },
      { playerId: "b", rating: 9 },
    ]);
    const a = out.find((s) => s.playerId === "a");
    expect(a?.avgRating).toBe(9);
    // Une moyenne de deux personnes ne pèse pas plus qu'une note unique.
    expect(out.every((s) => s.avgRating === 9)).toBe(true);
  });

  it("laisse hors classement le joueur que personne n'a noté", () => {
    const out = rank([
      { playerId: "a", rating: 5 },
      { playerId: "b", rating: 3 },
    ]);
    expect(out.map((s) => s.playerId)).toEqual(["a", "b"]);
    // « c » n'est pas dernier : il n'est nulle part.
    expect(out.some((s) => s.playerId === "c")).toBe(false);
  });

  it("ignore une note portant sur un joueur d'une autre édition", () => {
    const out = rank([
      { playerId: "a", rating: 6 },
      { playerId: "intrus", rating: 10 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].playerId).toBe("a");
  });

  it("ne rend rien quand aucun proche n'a voté", () => {
    expect(rank([])).toEqual([]);
  });

  it("départage les égalités de façon stable", () => {
    const ratings = [
      { playerId: "a", rating: 7 },
      { playerId: "b", rating: 7 },
      { playerId: "c", rating: 7 },
    ];
    const first = rank(ratings).map((s) => s.playerId);
    const shuffled = rank([...ratings].reverse()).map((s) => s.playerId);
    expect(shuffled).toEqual(first);
    expect(rank(ratings).every((s) => s.tiedForWin)).toBe(true);
  });
});

describe("questionDrinks — escalade inversée", () => {
  it("fait caler le premier et décroître les gorgées vers le bas", () => {
    const ranking = rank([
      { playerId: "a", rating: 10 },
      { playerId: "b", rating: 8 },
      { playerId: "c", rating: 6 },
      { playerId: "d", rating: 4 },
      { playerId: "e", rating: 3 },
      { playerId: "f", rating: 1 },
    ]);
    const drinks = questionDrinks(ranking, "ESCALATION_INVERSE", SHOOTER);
    expect(drinks.get("a")).toBe(SHOOTER); // 1er : shooter
    expect(drinks.get("b")).toBe(5);
    expect(drinks.get("c")).toBe(4);
    expect(drinks.get("d")).toBe(3);
    expect(drinks.get("e")).toBe(2);
    expect(drinks.get("f")).toBe(1); // dernier : une seule gorgée
  });

  it("reste le miroir exact de l'escalade standard", () => {
    const ranking = rank([
      { playerId: "a", rating: 9 },
      { playerId: "b", rating: 7 },
      { playerId: "c", rating: 5 },
    ]);
    const inverse = questionDrinks(ranking, "ESCALATION_INVERSE", SHOOTER);
    const standard = questionDrinks(ranking, "ESCALATION", SHOOTER);
    expect([...ranking].map((s) => inverse.get(s.playerId))).toEqual([SHOOTER, 2, 1]);
    expect([...ranking].map((s) => standard.get(s.playerId))).toEqual([1, 2, SHOOTER]);
  });

  it("échelonne sur les joueurs NOTÉS, pas sur tous les nommés", () => {
    // Trois joueurs notés sur six : l'échelle va de 1 à 3, sans trous.
    const ranking = rank([
      { playerId: "a", rating: 9 },
      { playerId: "b", rating: 6 },
      { playerId: "c", rating: 2 },
    ]);
    const drinks = questionDrinks(ranking, "ESCALATION_INVERSE", SHOOTER);
    expect(drinks.get("a")).toBe(SHOOTER);
    expect(drinks.get("b")).toBe(2);
    expect(drinks.get("c")).toBe(1);
  });

  it("fait caler le seul joueur noté", () => {
    const drinks = questionDrinks(rank([{ playerId: "a", rating: 5 }]), "ESCALATION_INVERSE", SHOOTER);
    expect(drinks.get("a")).toBe(SHOOTER);
  });
});

describe("computeQuestionResult — question entourage", () => {
  const compute = (ratings: EntourageRating[]) =>
    computeQuestionResult(
      {
        questionId: "q1",
        format: "entourage",
        drinkRule: "ESCALATION_INVERSE",
        playerBallots: [],
        entourageRatings: ratings,
      },
      PLAYERS,
      SHOOTER,
    );

  it("laisse à zéro les joueurs hors classement, sans les faire disparaître", () => {
    const out = compute([
      { playerId: "a", rating: 9 },
      { playerId: "b", rating: 4 },
    ]);
    expect(out.drinks.get("a")).toBe(SHOOTER);
    expect(out.drinks.get("b")).toBe(1);
    // Présents dans les totaux, à zéro : l'égaliseur a besoin de les compter.
    for (const id of ["c", "d", "e", "f"]) expect(out.drinks.get(id)).toBe(0);
    expect(out.drinks.size).toBe(PLAYERS.length);
  });

  it("ne fait boire personne quand aucun proche n'a voté", () => {
    const out = compute([]);
    expect(out.players).toEqual([]);
    expect([...out.drinks.values()].every((v) => v === 0)).toBe(true);
    expect(resultRowsFor(out)).toEqual([]);
  });

  it("n'écrit que l'audience officielle : le verdict des proches EST le verdict", () => {
    const out = compute([{ playerId: "a", rating: 7 }]);
    expect(resultRowsFor(out).every((r) => r.audience === "players")).toBe(true);
  });

  it("fige la moyenne arrondie au centième", () => {
    // 8 et 9 sur trois notes → 8.333…
    const out = compute([
      { playerId: "a", rating: 8 },
      { playerId: "a", rating: 8 },
      { playerId: "a", rating: 9 },
    ]);
    const row = resultRowsFor(out).find((r) => r.player_id === "a");
    expect(row?.avg_rating).toBe(8.33);
    expect(row?.borda_score).toBeNull();
    expect(row?.vote_count).toBeNull();
  });

  it("n'écrit une ligne que pour les joueurs notés", () => {
    const rows = resultRowsFor(
      compute([
        { playerId: "a", rating: 9 },
        { playerId: "b", rating: 5 },
      ]),
    );
    expect(rows.map((r) => r.player_id).sort()).toEqual(["a", "b"]);
  });
});
