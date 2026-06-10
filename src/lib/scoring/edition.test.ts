import { describe, it, expect } from "vitest";
import { computeQuestionResult, resultRowsFor } from "./edition";
import type { QuestionBallot } from "./types";

const PLAYERS = ["a", "b", "c"];

// Three voters unanimously rank a > b > c (1 = most likely).
const unanimousRanking: QuestionBallot[] = [
  [
    { playerId: "a", rank: 1 },
    { playerId: "b", rank: 2 },
    { playerId: "c", rank: 3 },
  ],
  [
    { playerId: "a", rank: 1 },
    { playerId: "b", rank: 2 },
    { playerId: "c", rank: 3 },
  ],
];

describe("computeQuestionResult", () => {
  it("ranks the official (player) audience and assigns 1..N", () => {
    const r = computeQuestionResult(
      {
        questionId: "q1",
        format: "ranking",
        drinkRule: "ESCALATION",
        playerBallots: unanimousRanking,
        juryBallots: [],
      },
      PLAYERS,
      4,
    );
    expect(r.players.map((p) => p.playerId)).toEqual(["a", "b", "c"]);
    expect(r.players.map((p) => p.finalRank)).toEqual([1, 2, 3]);
  });

  it("ESCALATION: last place drinks the shooter, others drink their rank", () => {
    const r = computeQuestionResult(
      {
        questionId: "q1",
        format: "ranking",
        drinkRule: "ESCALATION",
        playerBallots: unanimousRanking,
        juryBallots: [],
      },
      PLAYERS,
      4,
    );
    expect(r.drinks.get("a")).toBe(1); // rank 1 → 1 gorgée
    expect(r.drinks.get("b")).toBe(2); // rank 2 → 2 gorgées
    expect(r.drinks.get("c")).toBe(4); // last → shooter (4)
  });

  it("TOP_UNIQUE: only the winner drinks the shooter", () => {
    const r = computeQuestionResult(
      {
        questionId: "q1",
        format: "ranking",
        drinkRule: "TOP_UNIQUE",
        playerBallots: unanimousRanking,
        juryBallots: [],
      },
      PLAYERS,
      5,
    );
    expect(r.drinks.get("a")).toBe(5);
    expect(r.drinks.get("b")).toBe(0);
    expect(r.drinks.get("c")).toBe(0);
  });

  it("computes the jury audience independently from the player audience", () => {
    // Jury ranks the exact opposite order.
    const juryBallots: QuestionBallot[] = [
      [
        { playerId: "c", rank: 1 },
        { playerId: "b", rank: 2 },
        { playerId: "a", rank: 3 },
      ],
    ];
    const r = computeQuestionResult(
      {
        questionId: "q1",
        format: "ranking",
        drinkRule: "ESCALATION",
        playerBallots: unanimousRanking,
        juryBallots,
      },
      PLAYERS,
      4,
    );
    expect(r.players.map((p) => p.playerId)).toEqual(["a", "b", "c"]);
    expect(r.jury.map((p) => p.playerId)).toEqual(["c", "b", "a"]);
  });
});

describe("resultRowsFor", () => {
  it("emits both audiences; jury rows always have drinks = 0", () => {
    const r = computeQuestionResult(
      {
        questionId: "q1",
        format: "ranking",
        drinkRule: "ESCALATION",
        playerBallots: unanimousRanking,
        juryBallots: unanimousRanking,
      },
      PLAYERS,
      4,
    );
    const rows = resultRowsFor(r);
    expect(rows.filter((x) => x.audience === "players")).toHaveLength(3);
    expect(rows.filter((x) => x.audience === "jury")).toHaveLength(3);
    expect(rows.filter((x) => x.audience === "jury").every((x) => x.drinks === 0)).toBe(true);
    // players audience carries the real charges
    const loser = rows.find((x) => x.audience === "players" && x.player_id === "c");
    expect(loser?.drinks).toBe(4);
  });

  it("maps borda_score for ranking and leaves vote_count null", () => {
    const r = computeQuestionResult(
      {
        questionId: "q1",
        format: "ranking",
        drinkRule: "ESCALATION",
        playerBallots: unanimousRanking,
        juryBallots: [],
      },
      PLAYERS,
      4,
    );
    const rows = resultRowsFor(r).filter((x) => x.audience === "players");
    expect(rows.every((x) => x.vote_count === null)).toBe(true);
    expect(rows.every((x) => typeof x.borda_score === "number")).toBe(true);
  });

  it("omits an audience that received zero ballots (no phantom result)", () => {
    const r = computeQuestionResult(
      {
        questionId: "q1",
        format: "ranking",
        drinkRule: "ESCALATION",
        playerBallots: unanimousRanking,
        juryBallots: [], // entourage never answered this one
      },
      PLAYERS,
      4,
    );
    const rows = resultRowsFor(r);
    expect(rows.some((x) => x.audience === "jury")).toBe(false);
    expect(rows.filter((x) => x.audience === "players")).toHaveLength(3);
  });

  it("a question nobody answered charges nobody and emits no rows", () => {
    const r = computeQuestionResult(
      {
        questionId: "q1",
        format: "ranking",
        drinkRule: "TOP_UNIQUE", // would otherwise crown every hash-tied player
        playerBallots: [],
        juryBallots: [],
      },
      PLAYERS,
      4,
    );
    // No phantom shooters: every drink is 0.
    expect([...r.drinks.values()].every((d) => d === 0)).toBe(true);
    expect(resultRowsFor(r)).toHaveLength(0);
  });

  it("maps vote_count for single_choice and leaves borda_score null", () => {
    const sc: QuestionBallot[] = [
      [{ playerId: "a", rank: 1 }],
      [{ playerId: "a", rank: 1 }],
      [{ playerId: "b", rank: 1 }],
    ];
    const r = computeQuestionResult(
      {
        questionId: "q1",
        format: "single_choice",
        drinkRule: "TOP_UNIQUE",
        playerBallots: sc,
        juryBallots: [],
      },
      PLAYERS,
      4,
    );
    const rows = resultRowsFor(r).filter((x) => x.audience === "players");
    expect(rows.every((x) => x.borda_score === null)).toBe(true);
    const a = rows.find((x) => x.player_id === "a");
    expect(a?.vote_count).toBe(2);
    expect(a?.final_rank).toBe(1);
  });
});
