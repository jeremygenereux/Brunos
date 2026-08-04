import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AddQuestionForm } from "./add-question-form";
import { QuestionsManager } from "./questions-manager";

export const metadata: Metadata = { title: "Questions" };

export default async function QuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id, name, state, drink_rule")
    .eq("id", id)
    .single();
  if (!edition) notFound();

  const { data: questions } = await supabase
    .from("questions")
    .select("id, prompt, format, position, drink_rule_override")
    .eq("edition_id", id)
    .order("position");

  const editable = edition.state === "CONSTRUCTION";
  const editionRule = edition.drink_rule as "ESCALATION" | "TOP_UNIQUE";

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link
        href={`/admin/editions/${id}`}
        className="text-ivoire-muted hover:text-or-300 font-sans text-sm transition"
      >
        ← {edition.name}
      </Link>

      <h1 className="text-ivoire font-display mt-4 text-4xl font-semibold">Questions</h1>
      <p className="text-ivoire-muted mt-1 font-sans text-sm">
        {editable
          ? "Rédigez les catégories et ordonnez-les par glisser-déposer. Vous pouvez en prévoir plus que ce qui sera présenté."
          : "Les catégories sont figées : la cérémonie n'est plus en préparation."}
      </p>

      {editable && (
        <section className="mt-8">
          <AddQuestionForm editionId={id} editionRule={editionRule} />
        </section>
      )}

      <section className="mt-10">
        {!questions || questions.length === 0 ? (
          <p className="border-or-400/10 text-ivoire-muted rounded-2xl border border-dashed px-6 py-10 text-center font-sans text-sm">
            Aucune question pour l&apos;instant.
          </p>
        ) : (
          <QuestionsManager
            key={[...questions]
              .map((q) => q.id)
              .sort()
              .join(",")}
            editionId={id}
            questions={questions}
            editable={editable}
            editionRule={editionRule}
          />
        )}
      </section>
    </div>
  );
}
