import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AddPlayerForm } from "./add-player-form";
import { DeletePlayerButton } from "./delete-player-button";

export const metadata: Metadata = { title: "Joueurs" };

function personName(people: unknown): string {
  if (!people) return "Sans nom";
  if (Array.isArray(people)) {
    return (people[0] as { display_name?: string } | undefined)?.display_name ?? "Sans nom";
  }
  return (people as { display_name?: string }).display_name ?? "Sans nom";
}

export default async function PlayersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id, name")
    .eq("id", id)
    .single();
  if (!edition) notFound();

  const { data: players } = await supabase
    .from("players")
    .select("id, person_id, headshot_url, display_order, people(display_name)")
    .eq("edition_id", id)
    .order("display_order");

  // Les personnes du répertoire pas encore nommées ici. On n'expose que les
  // JOUEURS : un proche ne peut pas être nommé (garde en base également).
  const { data: bank } = await supabase
    .from("people")
    .select("id, display_name")
    .eq("kind", "player")
    .order("display_name");
  const used = new Set((players ?? []).map((p) => p.person_id));
  const available = (bank ?? [])
    .filter((p) => !used.has(p.id))
    .map((p) => ({ id: p.id, name: p.display_name ?? "Sans nom" }));

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link
        href={`/admin/editions/${id}`}
        className="text-ivoire-muted hover:text-or-300 font-sans text-sm transition"
      >
        ← {edition.name}
      </Link>

      <h1 className="text-ivoire font-display mt-4 text-4xl font-semibold">Joueurs</h1>
      <p className="text-ivoire-muted mt-1 font-sans text-sm">
        Les joueurs de cette cérémonie, choisis dans le{" "}
        <Link href="/admin/people" className="text-or-300 hover:text-or-400 transition">
          répertoire
        </Link>
        , avec leur photo.
      </p>

      <section className="mt-8">
        <AddPlayerForm editionId={id} available={available} />
      </section>

      <section className="mt-10">
        {!players || players.length === 0 ? (
          <p className="border-or-400/10 text-ivoire-muted rounded-2xl border border-dashed px-6 py-10 text-center font-sans text-sm">
            Aucun joueur nommé. Ajoutez le premier ci-dessus.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {players.map((p) => {
              const name = personName(p.people);
              return (
                <li
                  key={p.id}
                  className="border-or-400/15 bg-noir-700/40 flex flex-col gap-3 rounded-xl border p-3"
                >
                  {p.headshot_url ? (
                    <Image
                      src={p.headshot_url}
                      alt={name}
                      width={240}
                      height={240}
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="bg-noir-900/60 text-or-400/60 font-display flex aspect-square w-full items-center justify-center rounded-lg text-4xl">
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-ivoire font-sans text-sm">{name}</span>
                    <DeletePlayerButton playerId={p.id} editionId={id} name={name} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
