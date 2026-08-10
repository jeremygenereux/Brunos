import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { DramaCard } from "./presentation-types";
import { buildDramaCards } from "./drama-cards";
import { computeQuestionRanking } from "@/lib/scoring/rankings";
import type { DrinkRule } from "@/lib/scoring/types";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

type Client = Awaited<ReturnType<typeof createClient>>;

export type { DramaCard };

export type VoterBallot = {
  voterName: string;
  voterKind: "player" | "jury";
  /** Player names in the order this voter ranked them (1 → most likely). */
  ranking: { playerName: string; rank: number }[];
};

export type CategoryReveal = {
  questionId: string;
  prompt: string;
  format: string;
  revealEnabled: boolean;
  ballots: VoterBallot[];
  drama: DramaCard[];
};

export type EditionReveal = {
  categories: CategoryReveal[];
};

function personName(people: unknown): string {
  if (!people) return "Sans nom";
  if (Array.isArray(people)) {
    return (people[0] as { display_name?: string } | undefined)?.display_name ?? "Sans nom";
  }
  return (people as { display_name?: string }).display_name ?? "Sans nom";
}

/**
 * Reconstruct "qui a voté pour qui" + the drama triggers for an ARCHIVED
 * edition. Relies on the post-archive transparency RLS — the caller must have
 * already confirmed the edition is ARCHIVED (and is a participant / admin).
 *
 * Drama is computed over the PLAYER audience only, so the cards match the
 * standings shown on screen (the entourage/jury ranking is shown separately
 * and never makes anyone drink). The ballot list still shows every voter.
 */
export async function loadEditionVoteReveal(
  supabase: Client,
  editionId: string,
  opts: { respectToggle?: boolean } = {},
): Promise<EditionReveal> {
  // The admin curates which questions' reveals show (reveal_enabled). The
  // compile preview passes respectToggle:false to see everything.
  const respectToggle = opts.respectToggle !== false;

  const { data: rawQuestions } = await supabase
    .from("questions")
    .select("id, prompt, format, show_order, reveal_enabled, drink_rule_override")
    .eq("edition_id", editionId)
    .eq("is_selected_for_show", true)
    .order("show_order");
  const questions = rawQuestions ?? [];
  if (questions.length === 0) return { categories: [] };

  // La règle EFFECTIVE de chaque question décide de qui cale — et donc de qui
  // peut être « dans le déni ».
  const { data: editionRow } = await supabase
    .from("editions")
    .select("drink_rule")
    .eq("id", editionId)
    .single();
  const editionRule = (editionRow?.drink_rule ?? "ESCALATION") as DrinkRule;

  const { data: rawPlayers } = await supabase
    .from("players")
    .select("id, person_id, people(display_name)")
    .eq("edition_id", editionId);
  const playerName = new Map((rawPlayers ?? []).map((p) => [p.id, personName(p.people)]));
  // person → the player row they ARE in THIS edition (for self-detection).
  const playerByPerson = new Map((rawPlayers ?? []).map((p) => [p.person_id, p.id]));

  // Voter display names via a DEFINER RPC (resolves every voter — including
  // non-nominees the people RLS would hide — gated to admin/archived-participant).
  const { data: voterRows } = await supabase.rpc("archived_edition_voters", {
    p_edition: editionId,
  });
  const voterByParticipant = new Map(
    (voterRows ?? []).map((v) => {
      const kind = (v.kind === "player" ? "player" : "jury") as "player" | "jury";
      const selfPlayerId =
        kind === "player" && v.person_id ? (playerByPerson.get(v.person_id) ?? null) : null;
      return [v.participant_id, { name: v.display_name, kind, selfPlayerId }];
    }),
  );

  const { data: votes } = await supabase
    .from("votes")
    .select("id, participant_id")
    .eq("edition_id", editionId);
  const participantByVote = new Map((votes ?? []).map((v) => [v.id, v.participant_id]));

  const { data: answers } = await fetchAllRows<{
    vote_id: string;
    question_id: string;
    player_id: string;
    rank: number;
  }>((from, to) =>
    supabase
      .from("vote_answers")
      .select("vote_id, question_id, player_id, rank")
      .eq("edition_id", editionId)
      .order("id")
      .range(from, to),
  );

  // question_id -> vote_id -> [{playerId, rank}]
  const byQuestionVote = new Map<string, Map<string, { playerId: string; rank: number }[]>>();
  for (const a of answers ?? []) {
    let qv = byQuestionVote.get(a.question_id);
    if (!qv) {
      qv = new Map();
      byQuestionVote.set(a.question_id, qv);
    }
    const list = qv.get(a.vote_id) ?? [];
    list.push({ playerId: a.player_id, rank: a.rank });
    qv.set(a.vote_id, list);
  }

  const categories: CategoryReveal[] = questions.map((q) => {
    const qv = byQuestionVote.get(q.id) ?? new Map<string, { playerId: string; rank: number }[]>();

    type Ballot = {
      voterName: string;
      voterKind: "player" | "jury";
      selfPlayerId: string | null;
      byPlayer: Map<string, number>; // playerId -> rank
      maxRank: number; // this ballot's own last rank (ballots are full permutations today)
    };
    const allBallots: Ballot[] = [];
    for (const [voteId, list] of qv) {
      const voter = voterByParticipant.get(participantByVote.get(voteId) ?? "");
      if (!voter) continue;
      const byPlayer = new Map(list.map((x) => [x.playerId, x.rank]));
      allBallots.push({
        voterName: voter.name,
        voterKind: voter.kind,
        selfPlayerId: voter.selfPlayerId,
        byPlayer,
        maxRank: Math.max(0, ...list.map((x) => x.rank)),
      });
    }

    // Toute la logique des déboules vit dans un module PUR, testable à froid.
    // Elle raconte l'histoire des JOUEURS : c'est leur classement qui est à
    // l'écran, et c'est eux que les gorgées concernent.
    const playerBallots = allBallots.filter((b) => b.voterKind === "player");
    const rule = (q.drink_rule_override ?? editionRule) as DrinkRule;
    const official = computeQuestionRanking(
      q.format === "ranking" ? "ranking" : "single_choice",
      playerBallots.map((b) => [...b.byPlayer.entries()].map(([playerId, rank]) => ({ playerId, rank }))),
      [...playerName.keys()],
    );
    const drama = buildDramaCards({
      format: q.format,
      rule,
      ballots: playerBallots.map((b) => ({
        voterName: b.voterName,
        selfPlayerId: b.selfPlayerId,
        byPlayer: b.byPlayer,
        maxRank: b.maxRank,
      })),
      official,
      playerName,
    });

    // The reveal list shows EVERY voter (players + entourage).
    const voterBallots: VoterBallot[] = allBallots
      .map((b) => ({
        voterName: b.voterName,
        voterKind: b.voterKind,
        ranking: [...b.byPlayer.entries()]
          .map(([pid, rank]) => ({ playerName: playerName.get(pid) ?? "?", rank }))
          .sort((x, y) => x.rank - y.rank),
      }))
      .sort((x, y) => x.voterName.localeCompare(y.voterName));

    const revealEnabled = q.reveal_enabled;
    const gated = respectToggle && !revealEnabled;
    return {
      questionId: q.id,
      prompt: q.prompt,
      format: q.format,
      revealEnabled,
      ballots: gated ? [] : voterBallots,
      drama: gated ? [] : drama,
    };
  });

  return { categories };
}
