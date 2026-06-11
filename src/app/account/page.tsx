import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, type Role } from "@/lib/auth/user";
import { signOut } from "@/app/(auth)/actions";
import { StateBadge } from "@/components/state-badge";
import { createClient } from "@/lib/supabase/server";
import { loadArchiveStats } from "@/lib/editions/stats";
import { RsvpControl } from "./rsvp-control";
import { ArchiveRolodex } from "./archive-rolodex";
import type { Database } from "@/lib/types/database.types";

export const metadata: Metadata = { title: "Accueil" };

type EditionState = Database["public"]["Enums"]["edition_state"];
type RsvpStatus = Database["public"]["Enums"]["rsvp_status"];

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrateur",
  player: "Joueur",
  jury: "Entourage",
};

function fmtDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("fr-CA", { dateStyle: "long" });
}
function fmtDateTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("fr-CA", { dateStyle: "long", timeStyle: "short" });
}

type Edition = {
  id: string;
  name: string;
  year: number;
  state: EditionState;
  event_at: string | null;
  venue_name: string | null;
  venue_address: string | null;
  description: string | null;
  vote_deadline: string | null;
};

function ctaFor(e: Edition): { label: string; href?: string; primary?: boolean } {
  const deadlinePassed = e.vote_deadline ? new Date(e.vote_deadline) < new Date() : false;
  switch (e.state) {
    case "SENT_FOR_VOTE":
      return deadlinePassed
        ? { label: "Le vote est fermé" }
        : { label: "Voter maintenant", href: `/vote/${e.id}`, primary: true };
    case "CONSTRUCTION":
      return { label: "L'édition se prépare" };
    case "COMPILATION":
    case "LOCKED":
      return { label: "Les résultats se préparent" };
    case "LIVE":
      return { label: "C'est ce soir 🎉" };
    default:
      return { label: "Voir les résultats", href: `/archive/${e.id}`, primary: true };
  }
}

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border-or-400/15 bg-noir-700/40 flex flex-col rounded-3xl border p-6 backdrop-blur-md ${className}`}
    >
      <h2 className="text-or-400/70 mb-4 font-sans text-xs tracking-[0.3em] uppercase">{title}</h2>
      {children}
    </section>
  );
}

export default async function AccountPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  const supabase = await createClient();

  const { data: parts } = await supabase
    .from("participants")
    .select("edition_id, rsvp, kind")
    .eq("user_id", current.user.id);
  const partByEdition = new Map((parts ?? []).map((p) => [p.edition_id, p]));
  const editionIds = (parts ?? []).map((p) => p.edition_id);

  const { data: editionsData } = editionIds.length
    ? await supabase
        .from("editions")
        .select(
          "id, name, year, state, event_at, venue_name, venue_address, description, vote_deadline",
        )
        .in("id", editionIds)
    : { data: [] as Edition[] };
  const editions = (editionsData ?? []) as Edition[];

  const archived = editions.filter((e) => e.state === "ARCHIVED").sort((a, b) => b.year - a.year);

  const upcoming =
    editions
      .filter((e) => e.state !== "ARCHIVED")
      .sort((a, b) => {
        const ta = a.event_at ? new Date(a.event_at).getTime() : Infinity;
        const tb = b.event_at ? new Date(b.event_at).getTime() : Infinity;
        return ta - tb || b.year - a.year;
      })[0] ?? null;

  const { drinkers, editionsCount } = await loadArchiveStats(supabase);
  const topDrinker = drinkers[0];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="brunos-enter mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-or-400/80 font-sans text-xs tracking-[0.4em] uppercase">Les Brunos</p>
          <h1 className="text-ivoire font-display text-4xl font-semibold">
            Bonsoir{current.name ? `, ${current.name}` : ""}
            <span className="text-or-300">.</span>
          </h1>
          <p className="text-ivoire-faint font-sans text-sm">
            <span className="text-or-300">{ROLE_LABEL[current.role]}</span>
          </p>
        </div>
        <div className="flex items-center gap-4 font-sans text-sm">
          {current.role === "admin" && (
            <Link href="/admin/editions" className="text-or-300 hover:text-or-400 transition">
              Espace admin →
            </Link>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="text-ivoire-muted hover:text-or-300 cursor-pointer transition"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Upcoming edition — right 2/3, full height */}
        <div
          className="brunos-enter lg:col-span-2 lg:col-start-2 lg:row-span-2 lg:row-start-1"
          style={{ animationDelay: "150ms" }}
        >
          {upcoming ? (
            <UpcomingCard
              edition={upcoming}
              rsvp={(partByEdition.get(upcoming.id)?.rsvp ?? null) as RsvpStatus | null}
              kind={partByEdition.get(upcoming.id)?.kind ?? "player"}
            />
          ) : (
            <section className="border-or-400/15 bg-noir-700/40 relative flex min-h-[22rem] flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border p-10 text-center backdrop-blur-md">
              <span className="text-or-400/60 font-display text-3xl">
                À l&apos;année prochaine.
              </span>
              <p className="text-ivoire-muted max-w-sm font-sans text-sm">
                Aucune édition des Brunos à l&apos;horizon pour l&apos;instant. Tu recevras un lien
                d&apos;invitation quand la prochaine se prépare.
              </p>
              {archived.length > 0 && (
                <Link
                  href={`/archive/${archived[0].id}`}
                  className="text-or-300 hover:text-or-400 mt-2 font-sans text-sm transition"
                >
                  Revoir la dernière soirée →
                </Link>
              )}
            </section>
          )}
        </div>

        {/* Stats — top-left */}
        <div
          className="brunos-enter lg:col-start-1 lg:row-start-1"
          style={{ animationDelay: "300ms" }}
        >
          <Panel title="Palmarès">
            {drinkers.length === 0 ? (
              <p className="text-ivoire-faint font-sans text-sm">
                Les statistiques arriveront après la première soirée.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {topDrinker && (
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-ivoire-faint font-sans text-xs tracking-wide uppercase">
                        🥃 A le plus bu
                      </span>
                      <span className="text-ivoire font-display text-2xl font-semibold">
                        {topDrinker.name}
                      </span>
                    </div>
                    <span className="text-or-300 font-display text-3xl tabular-nums">
                      {topDrinker.totalDrinks}
                    </span>
                  </div>
                )}
                <p className="text-ivoire-faint font-sans text-xs">
                  Sur {editionsCount} édition{editionsCount > 1 ? "s" : ""} archivée
                  {editionsCount > 1 ? "s" : ""}.
                </p>
                <Link
                  href="/archive/stats"
                  className="text-or-300 hover:text-or-400 font-sans text-sm transition"
                >
                  Tout le palmarès →
                </Link>
              </div>
            )}
          </Panel>
        </div>

        {/* Archive — bottom-left */}
        <div
          className="brunos-enter lg:col-start-1 lg:row-start-2"
          style={{ animationDelay: "450ms" }}
        >
          <Panel title="Archives">
            <ArchiveRolodex
              editions={archived.map((e) => ({ id: e.id, name: e.name, year: e.year }))}
            />
          </Panel>
        </div>
      </div>
    </main>
  );
}

function UpcomingCard({
  edition,
  rsvp,
  kind,
}: {
  edition: Edition;
  rsvp: RsvpStatus | null;
  kind: string;
}) {
  const cta = ctaFor(edition);
  const showDeadline = edition.state === "SENT_FOR_VOTE";
  return (
    <section className="border-or-400/20 bg-noir-700/50 relative flex h-full min-h-[22rem] flex-col gap-6 overflow-hidden rounded-3xl border p-8 backdrop-blur-md">
      <div className="from-or-500/10 pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br to-transparent blur-2xl" />

      <div className="relative flex flex-wrap items-center gap-3">
        <p className="text-or-400/80 font-sans text-xs tracking-[0.4em] uppercase">
          Prochaine soirée
        </p>
        <StateBadge state={edition.state} />
      </div>

      <div className="relative flex flex-col gap-1">
        <h2 className="text-ivoire font-display text-5xl leading-none font-semibold sm:text-6xl">
          {edition.name}
        </h2>
        <span className="text-or-400/60 font-display text-2xl tabular-nums">{edition.year}</span>
      </div>

      <dl className="relative grid grid-cols-1 gap-x-8 gap-y-3 font-sans text-sm sm:grid-cols-2">
        <Fact label="Quand" value={fmtDate(edition.event_at) ?? "À confirmer"} />
        <Fact label="Où" value={edition.venue_name ?? "À confirmer"} />
        {edition.venue_address && <Fact label="Adresse" value={edition.venue_address} />}
        <Fact label="Tu participes comme" value={kind === "jury" ? "Entourage" : "Joueur"} />
      </dl>

      {edition.description && (
        <p className="text-ivoire-muted relative max-w-prose font-sans text-sm">
          {edition.description}
        </p>
      )}

      <div className="relative mt-auto flex flex-col gap-5">
        <RsvpControl editionId={edition.id} initial={rsvp} />

        <div className="flex flex-wrap items-center gap-4">
          {cta.href ? (
            <Link
              href={cta.href}
              className={
                cta.primary
                  ? "from-or-300 to-or-600 text-noir-900 hover:from-or-400 hover:to-or-500 rounded-full bg-gradient-to-b px-7 py-3 font-sans text-sm font-semibold shadow-lg transition"
                  : "border-or-400/40 text-or-300 hover:bg-noir-900 rounded-full border px-7 py-3 font-sans text-sm transition"
              }
            >
              {cta.label}
            </Link>
          ) : (
            <span className="border-or-400/15 text-ivoire-muted rounded-full border px-7 py-3 font-sans text-sm">
              {cta.label}
            </span>
          )}
          {showDeadline && edition.vote_deadline && (
            <span className="text-ivoire-faint font-sans text-xs">
              Date limite : {fmtDateTime(edition.vote_deadline)}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-ivoire-faint text-xs tracking-wide uppercase">{label}</dt>
      <dd className="text-ivoire">{value}</dd>
    </div>
  );
}
