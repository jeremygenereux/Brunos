import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, type Role } from "@/lib/auth/user";
import { signOut } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/ui";
import { StateBadge } from "@/components/state-badge";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database.types";

export const metadata: Metadata = { title: "Mon compte" };

type EditionState = Database["public"]["Enums"]["edition_state"];

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrateur",
  player: "Joueur",
  jury: "Jury / Entourage",
};

function canVote(e: { state: EditionState; vote_deadline: string | null }) {
  return (
    e.state === "SENT_FOR_VOTE" && (!e.vote_deadline || new Date(e.vote_deadline) > new Date())
  );
}

export default async function AccountPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  const supabase = await createClient();

  const { data: parts } = await supabase
    .from("participants")
    .select("edition_id")
    .eq("user_id", current.user.id);
  const editionIds = (parts ?? []).map((p) => p.edition_id);

  const { data: editions } = editionIds.length
    ? await supabase
        .from("editions")
        .select("id, name, year, state, vote_deadline")
        .in("id", editionIds)
        .order("year", { ascending: false })
    : { data: [] };

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="border-or-400/20 bg-noir-700/60 rounded-2xl border p-8 shadow-2xl backdrop-blur-xl">
          <p className="text-or-400/80 font-sans text-xs tracking-[0.3em] uppercase">Mon compte</p>
          <h1 className="text-ivoire font-display mt-2 text-3xl font-semibold">Bienvenue</h1>

          <dl className="mt-6 space-y-4 font-sans text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-ivoire-muted">Courriel</dt>
              <dd className="text-ivoire">{current.user.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-ivoire-muted">Rôle</dt>
              <dd className="text-or-300">{ROLE_LABEL[current.role]}</dd>
            </div>
          </dl>

          {current.role === "admin" && (
            <Link
              href="/admin/editions"
              className="text-or-300 hover:text-or-400 mt-6 inline-block font-sans text-sm transition"
            >
              Espace admin →
            </Link>
          )}

          <form action={signOut} className="mt-8">
            <SubmitButton>Se déconnecter</SubmitButton>
          </form>
        </div>

        <div className="border-or-400/15 bg-noir-700/40 rounded-2xl border p-6">
          <h2 className="text-or-400/80 mb-3 font-sans text-xs tracking-[0.3em] uppercase">
            Mes éditions
          </h2>
          {!editions || editions.length === 0 ? (
            <p className="text-ivoire-muted font-sans text-sm">
              Tu ne participes à aucune édition. Utilise un lien d&apos;invitation pour rejoindre.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {editions.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-ivoire font-sans text-sm">{e.name}</span>
                    <StateBadge state={e.state} />
                  </div>
                  {canVote(e) ? (
                    <Link
                      href={`/vote/${e.id}`}
                      className="from-or-300 to-or-600 text-noir-900 hover:from-or-400 hover:to-or-500 rounded-md bg-gradient-to-b px-3 py-1.5 font-sans text-xs font-semibold transition"
                    >
                      Voter →
                    </Link>
                  ) : (
                    <span className="text-ivoire-faint font-sans text-xs">Vote fermé</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
