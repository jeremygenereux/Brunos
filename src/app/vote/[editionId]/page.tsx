import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { BallotForm } from "./ballot-form";
import type { DrinkRule } from "@/lib/editions/drink-rule";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

export const metadata: Metadata = { title: "Voter" };

type Question = {
  id: string;
  prompt: string;
  format: string;
  /** Règle EFFECTIVE : la surcharge de la question, sinon celle de l'édition. */
  drinkRule: DrinkRule;
  initialRanking: string[];
  initialChoice: string;
};

export default async function VotePage({ params }: { params: Promise<{ editionId: string }> }) {
  const { editionId } = await params;
  await requireUser();
  const supabase = await createClient();

  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("edition_id", editionId)
    .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .maybeSingle();
  if (!participant) redirect("/account");

  const { data: edition } = await supabase
    .from("editions")
    .select("id, name, state, vote_deadline, drink_rule")
    .eq("id", editionId)
    .single();
  if (!edition) redirect("/account");

  const open =
    edition.state === "SENT_FOR_VOTE" &&
    (!edition.vote_deadline || new Date(edition.vote_deadline) > new Date());

  const { data: players } = await supabase
    .from("players")
    .select("id, headshot_url, people(display_name)")
    .eq("edition_id", editionId)
    .order("display_order");

  const playerList = (players ?? []).map((p) => ({
    id: p.id,
    headshot_url: p.headshot_url,
    display_name:
      (Array.isArray(p.people)
        ? (p.people[0] as { display_name?: string } | undefined)?.display_name
        : (p.people as { display_name?: string } | null)?.display_name) ?? "Sans nom",
  }));

  const { data: rawQuestions } = await supabase
    .from("questions")
    .select("id, prompt, format, drink_rule_override")
    .eq("edition_id", editionId)
    .order("position");

  // Prefill from any existing ballot.
  const { data: vote } = await supabase
    .from("votes")
    .select("id, submitted_at")
    .eq("edition_id", editionId)
    .eq("participant_id", participant.id)
    .maybeSingle();
  // Un seul bulletin tient largement sous le plafond aujourd'hui, mais un
  // cercle de 25 nommés sur 40 catégories le franchirait — et on relirait un
  // brouillon amputé sans s'en apercevoir.
  type Answer = { question_id: string; player_id: string; rank: number };
  const { data: answers } = vote
    ? await fetchAllRows<Answer>((from, to) =>
        supabase
          .from("vote_answers")
          .select("question_id, player_id, rank")
          .eq("vote_id", vote.id)
          .order("id")
          .range(from, to),
      )
    : { data: [] as Answer[] };

  const allPlayerIds = playerList.map((p) => p.id);
  const editionRule = edition.drink_rule as DrinkRule;
  const questions: Question[] = (rawQuestions ?? []).map((q) => {
    const mine = (answers ?? [])
      .filter((a) => a.question_id === q.id)
      .sort((a, b) => a.rank - b.rank);
    // La surcharge par question l'emporte sur la règle de l'édition.
    const drinkRule = (q.drink_rule_override ?? editionRule) as DrinkRule;
    if (q.format === "ranking") {
      const ranked = mine.map((a) => a.player_id).filter((id) => allPlayerIds.includes(id));
      const missing = allPlayerIds.filter((id) => !ranked.includes(id));
      return { ...q, drinkRule, initialRanking: [...ranked, ...missing], initialChoice: "" };
    }
    return { ...q, drinkRule, initialRanking: [], initialChoice: mine[0]?.player_id ?? "" };
  });

  const submitted = Boolean(vote?.submitted_at);
  const nameById = new Map(playerList.map((p) => [p.id, p.display_name]));

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-6">
      {/* Pas de titre d'édition : il n'y a jamais qu'un scrutin ouvert à la
          fois, et cette place gagnée évite de faire défiler le bulletin. */}
      <Link
        href="/account"
        className="text-ivoire-muted hover:text-or-300 font-sans text-sm transition"
      >
        ← Mon espace
      </Link>

      {submitted ? (
        <LockedBallot
          questions={questions}
          nameById={nameById}
          submittedAt={vote?.submitted_at ?? ""}
        />
      ) : !open ? (
        <p className="border-or-400/15 bg-noir-700/40 text-ivoire-muted mt-6 rounded-2xl border px-6 py-10 text-center font-sans text-sm">
          Le scrutin n&apos;est pas ouvert pour cette édition.
        </p>
      ) : playerList.length === 0 || questions.length === 0 ? (
        <p className="border-or-400/15 bg-noir-700/40 text-ivoire-muted mt-6 rounded-2xl border px-6 py-10 text-center font-sans text-sm">
          Le bulletin n&apos;est pas encore constitué.
        </p>
      ) : (
        <div className="mt-6">
          <BallotForm editionId={editionId} players={playerList} questions={questions} />
        </div>
      )}
    </main>
  );
}

function LockedBallot({
  questions,
  nameById,
  submittedAt,
}: {
  questions: Question[];
  nameById: Map<string, string>;
  submittedAt: string;
}) {
  const when = submittedAt
    ? new Date(submittedAt).toLocaleString("fr-CA", { dateStyle: "long", timeStyle: "short" })
    : null;
  return (
    <div className="mt-6 flex flex-col gap-5">
      <p className="brunos-glass border-or-400/30 text-or-300 rounded-2xl border px-5 py-4 font-sans text-sm">
        Bulletin déposé{when ? ` le ${when}` : ""}. Merci.
      </p>
      {questions.map((q, i) => (
        <div key={q.id} className="border-or-400/12 bg-noir-700/40 rounded-2xl border p-5">
          <h3 className="text-ivoire font-display mb-2 text-lg">
            <span className="text-or-400/70">{i + 1}.</span> {q.prompt}
          </h3>
          {q.format === "ranking" ? (
            <ol className="flex flex-col gap-1">
              {q.initialRanking.map((pid, idx) => (
                <li key={pid} className="text-ivoire-muted font-sans text-sm">
                  <span className="text-ivoire-faint tabular-nums">{idx + 1}.</span>{" "}
                  {nameById.get(pid) ?? "—"}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-ivoire font-sans text-sm">{nameById.get(q.initialChoice) ?? "—"}</p>
          )}
        </div>
      ))}
    </div>
  );
}
