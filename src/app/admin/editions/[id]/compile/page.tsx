import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { computeQuestionResult } from "@/lib/scoring/edition";
import type { QuestionBallot } from "@/lib/scoring/types";
import { loadEditionVoteReveal } from "@/lib/editions/drama";
import { EqualizerPanel } from "./equalizer-panel";
import { RevealCurator } from "./reveal-curator";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

export const metadata: Metadata = { title: "Compilation" };

function personName(people: unknown): string {
  if (!people) return "Sans nom";
  if (Array.isArray(people)) {
    return (people[0] as { display_name?: string } | undefined)?.display_name ?? "Sans nom";
  }
  return (people as { display_name?: string }).display_name ?? "Sans nom";
}

export default async function CompilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id, name, state, drink_rule, shooter_value")
    .eq("id", id)
    .single();
  if (!edition) redirect("/admin/editions");

  if (edition.state !== "COMPILATION") {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <Link
          href={`/admin/editions/${id}`}
          className="text-ivoire-muted hover:text-or-300 font-sans text-sm transition"
        >
          ← {edition.name}
        </Link>
        <p className="border-or-400/15 bg-noir-700/40 text-ivoire-muted mt-6 rounded-2xl border px-6 py-10 text-center font-sans text-sm">
          La compilation n&apos;est disponible que lorsque l&apos;édition est en état COMPILATION
          (fermez le vote depuis le détail).
        </p>
      </main>
    );
  }

  const { data: rawPlayers } = await supabase
    .from("players")
    .select("id, people(display_name)")
    .eq("edition_id", id)
    .order("display_order");
  const players = (rawPlayers ?? []).map((p) => ({ id: p.id, name: personName(p.people) }));
  const playerIds = players.map((p) => p.id);

  const { data: questions } = await supabase
    .from("questions")
    .select("id, prompt, format, drink_rule_override, is_selected_for_show, show_order")
    .eq("edition_id", id)
    .order("position");

  const { data: participants } = await supabase
    .from("participants")
    .select("id, kind")
    .eq("edition_id", id);
  const kindByParticipant = new Map((participants ?? []).map((p) => [p.id, p.kind]));

  const { data: votes } = await supabase
    .from("votes")
    .select("id, participant_id")
    .eq("edition_id", id);
  const kindByVote = new Map(
    (votes ?? []).map((v) => [v.id, kindByParticipant.get(v.participant_id)]),
  );

  const { data: answers } = await fetchAllRows<{
    vote_id: string;
    question_id: string;
    player_id: string;
    rank: number;
  }>((from, to) =>
    supabase
      .from("vote_answers")
      .select("vote_id, question_id, player_id, rank")
      .eq("edition_id", id)
      .order("id")
      .range(from, to),
  );

  // question_id -> vote_id -> ballot
  const byQuestionVote = new Map<string, Map<string, QuestionBallot>>();
  for (const a of answers ?? []) {
    let qv = byQuestionVote.get(a.question_id);
    if (!qv) {
      qv = new Map();
      byQuestionVote.set(a.question_id, qv);
    }
    const ballot = qv.get(a.vote_id) ?? [];
    ballot.push({ playerId: a.player_id, rank: a.rank });
    qv.set(a.vote_id, ballot);
  }

  const shooterValue = Number(edition.shooter_value);
  const computed = (questions ?? []).map((q) => {
    const qv = byQuestionVote.get(q.id) ?? new Map<string, QuestionBallot>();
    const playerBallots: QuestionBallot[] = [];
    const juryBallots: QuestionBallot[] = [];
    for (const [voteId, ballot] of qv) {
      const kind = kindByVote.get(voteId);
      if (kind === "player") playerBallots.push(ballot);
      else if (kind === "jury") juryBallots.push(ballot);
    }
    const computed = computeQuestionResult(
      {
        questionId: q.id,
        format: q.format,
        drinkRule: q.drink_rule_override ?? edition.drink_rule,
        playerBallots,
        juryBallots,
      },
      playerIds,
      shooterValue,
    );
    const drinks = Object.fromEntries(computed.drinks);
    return {
      id: q.id,
      prompt: q.prompt,
      format: q.format,
      drinks,
      selected: q.is_selected_for_show,
      showOrder: q.show_order,
    };
  });

  const initialSelected = computed
    .filter((c) => c.selected)
    .sort((a, b) => (a.showOrder ?? 0) - (b.showOrder ?? 0))
    .map((c) => c.id);

  // Preview ALL reveals (respectToggle:false) so the admin can curate them.
  const reveal = await loadEditionVoteReveal(supabase, id, { respectToggle: false });
  const revealItems = reveal.categories
    .filter((c) => c.ballots.length > 0 || c.drama.length > 0)
    .map((c) => ({
      questionId: c.questionId,
      prompt: c.prompt,
      drama: c.drama,
      ballotCount: c.ballots.length,
      revealEnabled: c.revealEnabled,
    }));

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link
        href={`/admin/editions/${id}`}
        className="text-ivoire-muted hover:text-or-300 font-sans text-sm transition"
      >
        ← {edition.name}
      </Link>
      <h1 className="text-ivoire font-display mt-4 text-4xl font-semibold">Compilation</h1>
      <p className="text-ivoire-muted mt-1 mb-8 font-sans text-sm">
        Fixez le nombre de catégories, laissez l&apos;égaliseur répartir les charges au mieux,
        puis ajustez à la main.
      </p>

      {players.length === 0 || computed.length === 0 ? (
        <p className="border-or-400/15 bg-noir-700/40 text-ivoire-muted rounded-2xl border px-6 py-10 text-center font-sans text-sm">
          Il faut des joueurs et des questions pour compiler.
        </p>
      ) : (
        <>
          <EqualizerPanel
            editionId={id}
            players={players}
            questions={computed.map((c) => ({
              id: c.id,
              prompt: c.prompt,
              format: c.format,
              drinks: c.drinks,
            }))}
            initialSelected={initialSelected}
          />
          {revealItems.length > 0 && <RevealCurator editionId={id} items={revealItems} />}
        </>
      )}
    </main>
  );
}
