import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadPresentation } from "@/lib/editions/presentation";
import { PresentationDeck } from "@/app/admin/editions/[id]/present/presentation-deck";

export const metadata: Metadata = { title: "Présentation" };

export default async function ArchivePresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const data = await loadPresentation(supabase, id);
  if (!data.edition || data.edition.state !== "ARCHIVED") notFound();
  if (!data.categories.some((c) => c.players.length > 0)) notFound();

  return (
    <PresentationDeck
      edition={data.edition}
      categories={data.categories}
      recap={data.recap}
      backHref={`/archive/${id}`}
    />
  );
}
