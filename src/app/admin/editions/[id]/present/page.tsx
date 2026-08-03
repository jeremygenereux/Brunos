import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { loadPresentation } from "@/lib/editions/presentation";
import { loadEditionVoteReveal } from "@/lib/editions/drama";
import { STATE_ORDER } from "@/lib/editions/state-machine";
import { PresentationDeck } from "./presentation-deck";

export const metadata: Metadata = { title: "Présentation" };

function Notice({ id, name, children }: { id: string; name: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <Link
        href={`/admin/editions/${id}`}
        className="text-ivoire-muted hover:text-or-300 font-sans text-sm transition"
      >
        ← {name}
      </Link>
      <p className="border-or-400/15 bg-noir-700/40 text-ivoire-muted mt-6 rounded-2xl border px-6 py-10 text-center font-sans text-sm">
        {children}
      </p>
    </main>
  );
}

export default async function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();

  const data = await loadPresentation(supabase, id, { allowLiveFallback: true });
  if (!data.edition) notFound();
  const { edition } = data;

  if (STATE_ORDER.indexOf(edition.state) < STATE_ORDER.indexOf("LOCKED")) {
    return (
      <Notice id={id} name={edition.name}>
        La présentation s&apos;ouvre une fois la soirée verrouillée : c&apos;est à ce moment que
        les résultats sont figés.
      </Notice>
    );
  }
  if (data.error) {
    return (
      <Notice id={id} name={edition.name}>
        {data.error}
      </Notice>
    );
  }
  if (!data.categories.some((c) => c.players.length > 0)) {
    return (
      <Notice id={id} name={edition.name}>
        Rien à présenter pour l&apos;instant : il faut des joueurs, des questions retenues et des
        votes.
      </Notice>
    );
  }

  const reveal = await loadEditionVoteReveal(supabase, id);
  const dramaByQuestion = new Map(reveal.categories.map((c) => [c.questionId, c.drama]));
  const categories = data.categories.map((c) => ({
    ...c,
    drama: dramaByQuestion.get(c.questionId) ?? [],
  }));

  return <PresentationDeck edition={edition} categories={categories} recap={data.recap} />;
}
