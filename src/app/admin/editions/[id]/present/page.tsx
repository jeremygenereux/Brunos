import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { computeEditionResultRows } from "@/lib/editions/snapshot";
import { STATE_ORDER } from "@/lib/editions/state-machine";
import { PresentationDeck, type Category, type RecapRow } from "./presentation-deck";

export const metadata: Metadata = { title: "Présentation" };

function personName(people: unknown): string {
  if (!people) return "Sans nom";
  if (Array.isArray(people)) {
    return (people[0] as { display_name?: string } | undefined)?.display_name ?? "Sans nom";
  }
  return (people as { display_name?: string }).display_name ?? "Sans nom";
}

export default async function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id, name, year, state, venue_name, event_at, shooter_value, drink_rule")
    .eq("id", id)
    .single();
  if (!edition) notFound();

  const ready = STATE_ORDER.indexOf(edition.state) >= STATE_ORDER.indexOf("LOCKED");
  if (!ready) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <Link
          href={`/admin/editions/${id}`}
          className="text-ivoire-muted hover:text-or-300 font-sans text-sm transition"
        >
          ← {edition.name}
        </Link>
        <p className="border-or-400/15 bg-noir-700/40 text-ivoire-muted mt-6 rounded-2xl border px-6 py-10 text-center font-sans text-sm">
          La présentation devient disponible une fois l&apos;édition verrouillée (les résultats sont
          figés au passage en « Verrouillée »).
        </p>
      </main>
    );
  }

  // Selected questions, in presentation order.
  const { data: rawQuestions } = await supabase
    .from("questions")
    .select("id, prompt, format, show_order, drink_rule_override")
    .eq("edition_id", id)
    .eq("is_selected_for_show", true)
    .order("show_order");
  const questions = rawQuestions ?? [];
  const qids = questions.map((q) => q.id);

  // Players (names + headshots).
  const { data: rawPlayers } = await supabase
    .from("players")
    .select("id, headshot_url, people(display_name)")
    .eq("edition_id", id)
    .order("display_order");
  const players = (rawPlayers ?? []).map((p) => ({
    id: p.id,
    name: personName(p.people),
    headshot: p.headshot_url,
  }));
  const playersById = new Map(players.map((p) => [p.id, p]));

  // Frozen results from cache; fall back to a live compute if empty.
  type Row = {
    question_id: string;
    player_id: string;
    borda_score: number | null;
    vote_count: number | null;
    final_rank: number;
    drinks: number;
    audience: string;
  };
  let rows: Row[] = [];
  if (qids.length) {
    const { data } = await supabase
      .from("results")
      .select("question_id, player_id, borda_score, vote_count, final_rank, drinks, audience")
      .in("question_id", qids);
    rows = (data ?? []).map((r) => ({ ...r, drinks: Number(r.drinks) }));
  }
  if (rows.length === 0 && qids.length) {
    const fb = await computeEditionResultRows(supabase, id);
    if (fb.error) {
      return (
        <main className="mx-auto w-full max-w-2xl px-6 py-10">
          <Link
            href={`/admin/editions/${id}`}
            className="text-ivoire-muted hover:text-or-300 font-sans text-sm transition"
          >
            ← {edition.name}
          </Link>
          <p className="border-or-400/15 bg-noir-700/40 mt-6 rounded-2xl border px-6 py-10 text-center font-sans text-sm text-red-300/90">
            {fb.error}
          </p>
        </main>
      );
    }
    rows = fb.rows.map((r) => ({
      question_id: r.question_id,
      player_id: r.player_id,
      borda_score: r.borda_score,
      vote_count: r.vote_count,
      final_rank: r.final_rank,
      drinks: r.drinks,
      audience: r.audience,
    }));
  }

  // Shape one audience's ranking, attaching explicit winner / shooter flags so
  // the deck never has to infer them from value coincidences. An audience that
  // got no ballots contributes no rows (snapshot already dropped them).
  const shapeRanking = (
    questionId: string,
    audience: "players" | "jury",
    format: string,
    rule: "ESCALATION" | "TOP_UNIQUE",
  ) => {
    const sorted = rows
      .filter((r) => r.question_id === questionId && r.audience === audience)
      .sort((a, b) => a.final_rank - b.final_rank);
    const n = sorted.length;
    const top = sorted[0];
    return sorted.map((r) => ({
      playerId: r.player_id,
      name: playersById.get(r.player_id)?.name ?? "—",
      headshot: playersById.get(r.player_id)?.headshot ?? null,
      finalRank: r.final_rank,
      drinks: r.drinks,
      // Genuine tie for 1st: same primary score as the top row.
      isWinner:
        audience === "players" && top
          ? format === "ranking"
            ? r.borda_score === top.borda_score
            : r.vote_count === top.vote_count
          : false,
      // Who actually took the shooter charge (not a number that merely equals it).
      isShooter:
        audience === "players"
          ? rule === "ESCALATION"
            ? r.final_rank === n
            : r.drinks > 0
          : false,
    }));
  };

  const categories: Category[] = questions.map((q, i) => {
    const rule = (q.drink_rule_override ?? edition.drink_rule) as "ESCALATION" | "TOP_UNIQUE";
    return {
      questionId: q.id,
      index: i,
      prompt: q.prompt,
      format: q.format,
      players: shapeRanking(q.id, "players", q.format, rule),
      jury: shapeRanking(q.id, "jury", q.format, rule),
    };
  });

  // Recap — total gorgées per player across the night (official audience only).
  const totals = new Map<string, number>();
  for (const c of categories) {
    for (const r of c.players) totals.set(r.playerId, (totals.get(r.playerId) ?? 0) + r.drinks);
  }
  const recap: RecapRow[] = players
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      headshot: p.headshot,
      total: totals.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.total - a.total);

  const hasData = categories.some((c) => c.players.length > 0);
  if (!hasData) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <Link
          href={`/admin/editions/${id}`}
          className="text-ivoire-muted hover:text-or-300 font-sans text-sm transition"
        >
          ← {edition.name}
        </Link>
        <p className="border-or-400/15 bg-noir-700/40 text-ivoire-muted mt-6 rounded-2xl border px-6 py-10 text-center font-sans text-sm">
          Aucun résultat à présenter — il faut des joueurs, des questions sélectionnées et des
          votes.
        </p>
      </main>
    );
  }

  return (
    <PresentationDeck
      edition={{
        id: edition.id,
        name: edition.name,
        year: edition.year,
        venueName: edition.venue_name,
        state: edition.state,
      }}
      categories={categories}
      recap={recap}
    />
  );
}
