import { describe, it, expect } from "vitest";
import { computeQuestionRanking } from "./rankings";
import type { QuestionBallot } from "./types";

describe("computeQuestionRanking — ranking (Borda)", () => {
  it("unanimous #1 wins with the lowest total", () => {
    const players = ["a", "b", "c"];
    const ballots: QuestionBallot[] = Array.from({ length: 3 }, () => [
      { playerId: "a", rank: 1 },
      { playerId: "b", rank: 2 },
      { playerId: "c", rank: 3 },
    ]);
    const r = computeQuestionRanking("ranking", ballots, players);
    expect(r.map((x) => x.playerId)).toEqual(["a", "b", "c"]);
    expect(r[0].bordaScore).toBe(3);
    expect(r[0].finalRank).toBe(1);
    expect(r[0].firstPlaceCount).toBe(3);
  });

  it("lower Borda total wins", () => {
    const players = ["a", "b"];
    const ballots: QuestionBallot[] = [
      [
        { playerId: "a", rank: 1 },
        { playerId: "b", rank: 2 },
      ],
      [
        { playerId: "a", rank: 2 },
        { playerId: "b", rank: 1 },
      ],
      [
        { playerId: "a", rank: 1 },
        { playerId: "b", rank: 2 },
      ],
    ];
    const r = computeQuestionRanking("ranking", ballots, players);
    expect(r[0].playerId).toBe("a");
    expect(r.find((x) => x.playerId === "a")?.bordaScore).toBe(4);
    expect(r.find((x) => x.playerId === "b")?.bordaScore).toBe(5);
  });

  it("ties on Borda are broken by first-place count", () => {
    const players = ["a", "b", "c"];
    const ballots: QuestionBallot[] = [
      [
        { playerId: "a", rank: 1 },
        { playerId: "b", rank: 2 },
        { playerId: "c", rank: 3 },
      ],
      [
        { playerId: "a", rank: 3 },
        { playerId: "b", rank: 2 },
        { playerId: "c", rank: 1 },
      ],
    ];
    // All Borda = 4; firsts: a=1, b=0, c=1 → b (fewest firsts) ranks last.
    const r = computeQuestionRanking("ranking", ballots, players);
    expect(r.every((x) => x.bordaScore === 4)).toBe(true);
    expect(r[2].playerId).toBe("b");
  });

  it("is deterministic regardless of player input order (hash tiebreak)", () => {
    const players = ["x", "y", "z"];
    const r1 = computeQuestionRanking("ranking", [], players).map((x) => x.playerId);
    const r2 = computeQuestionRanking("ranking", [], [...players].reverse()).map((x) => x.playerId);
    expect(r1).toEqual(r2);
  });
});

describe("computeQuestionRanking — single_choice", () => {
  it("counts votes and flags tied winners", () => {
    const players = ["a", "b", "c"];
    const ballots: QuestionBallot[] = [
      [{ playerId: "a", rank: 1 }],
      [{ playerId: "a", rank: 1 }],
      [{ playerId: "b", rank: 1 }],
    ];
    const r = computeQuestionRanking("single_choice", ballots, players);
    expect(r[0].playerId).toBe("a");
    expect(r.find((x) => x.playerId === "a")?.voteCount).toBe(2);
    expect(r.find((x) => x.playerId === "b")?.voteCount).toBe(1);
    expect(r.find((x) => x.playerId === "c")?.voteCount).toBe(0);
    expect(r[0].tiedForWin).toBe(true);
    expect(r[1].tiedForWin).toBe(false);
  });
});
