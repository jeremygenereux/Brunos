import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";
import { AddEntourageForm } from "./add-form";
import { BallotLink } from "./ballot-link";
import { removeEntourage } from "./actions";

export const metadata: Metadata = { title: "Entourage" };

function nameOf(people: unknown): string {
  const p = Array.isArray(people) ? people[0] : people;
  return (p as { display_name?: string } | null)?.display_name ?? "Sans nom";
}

async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

export default async function EntouragePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id, name, year")
    .eq("id", id)
    .single();
  if (!edition) notFound();

  const { data: players } = await supabase
    .from("players")
    .select("id, person_id, people(display_name)")
    .eq("edition_id", id)
    .order("display_order");
  const playerList = (players ?? []).map((p) => ({ id: p.id, name: nameOf(p.people) }));
  const playerNameById = new Map(playerList.map((p) => [p.id, p.name]));

  const { data: rows } = await supabase
    .from("edition_entourage")
    .select(
      "person_id, linked_player_id, relation_label, ballot_token, people(display_name, headshot_url)",
    )
    .eq("edition_id", id);

  // Qui a déjà rendu son bulletin. Un brouillon ne compte pas comme rendu.
  const { data: ballots } = await supabase
    .from("entourage_ballots")
    .select("person_id, submitted_at")
    .eq("edition_id", id);
  const submittedBy = new Map(
    (ballots ?? []).map((b) => [b.person_id, b.submitted_at as string | null]),
  );

  const origin = await siteOrigin();
  const attached = (rows ?? []).map((r) => {
    const person = Array.isArray(r.people) ? r.people[0] : r.people;
    return {
      personId: r.person_id,
      name: (person as { display_name?: string } | null)?.display_name ?? "Sans nom",
      headshot: (person as { headshot_url?: string | null } | null)?.headshot_url ?? null,
      linkedPlayer: playerNameById.get(r.linked_player_id) ?? "—",
      relation: r.relation_label,
      url: `${origin}/bulletin/${r.ballot_token}`,
      submitted: Boolean(submittedBy.get(r.person_id)),
    };
  });
  const attachedIds = new Set(attached.map((a) => a.personId));

  // Seuls les « proches » du répertoire, et pas ceux déjà rattachés.
  const { data: bank } = await supabase
    .from("people")
    .select("id, display_name")
    .eq("kind", "jury")
    .order("display_name");
  const candidates = (bank ?? [])
    .filter((p) => !attachedIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.display_name ?? "Sans nom" }));

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link
        href={`/admin/editions/${id}`}
        className="text-ivoire-muted hover:text-or-300 font-sans text-sm transition"
      >
        ← {edition.name}
      </Link>

      <h1 className="text-ivoire font-display mt-4 text-4xl font-semibold">Entourage</h1>
      <p className="text-ivoire-muted mt-1 max-w-2xl font-sans text-sm">
        Les proches invités à noter leur joueur. Chacun reçoit un lien personnel qui ouvre son
        bulletin sans compte ni mot de passe : copiez-le et envoyez-le par message. Ils ne voient
        que les questions marquées entourage, et uniquement leur joueur. Leurs notes font boire.
      </p>

      {playerList.length === 0 ? (
        <p className="border-or-400/10 text-ivoire-muted mt-8 rounded-2xl border border-dashed px-6 py-8 text-center font-sans text-sm">
          Nommez d&apos;abord des joueurs : un proche doit être rattaché à l&apos;un d&apos;eux.
        </p>
      ) : (
        <>
          <section className="mt-8">
            <AddEntourageForm editionId={id} candidates={candidates} players={playerList} />
          </section>

          <section className="mt-10">
            <h2 className="text-or-400/80 mb-3 font-sans text-xs tracking-[0.3em] uppercase">
              Rattachés à cette cérémonie
            </h2>
            {attached.length === 0 ? (
              <p className="border-or-400/10 text-ivoire-muted rounded-2xl border border-dashed px-6 py-8 text-center font-sans text-sm">
                Personne pour l&apos;instant.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {attached.map((a) => (
                  <li
                    key={a.personId}
                    className="border-or-400/12 bg-noir-700/40 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
                  >
                    <Avatar name={a.name} headshot={a.headshot} size={36} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-ivoire font-sans text-sm">
                        {a.name}
                        {a.submitted && <span className="text-or-300"> · a voté</span>}
                      </span>
                      <span className="text-ivoire-faint font-sans text-xs">
                        {a.relation} · rattaché·e à {a.linkedPlayer}
                      </span>
                    </div>
                    <BallotLink url={a.url} name={a.name} />
                    <form action={removeEntourage}>
                      <input type="hidden" name="edition_id" value={id} />
                      <input type="hidden" name="person_id" value={a.personId} />
                      <button
                        type="submit"
                        className="text-ivoire-faint font-sans text-xs transition hover:text-red-300"
                      >
                        Retirer
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
