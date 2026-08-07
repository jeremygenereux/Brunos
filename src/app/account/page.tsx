import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, type Role } from "@/lib/auth/user";
import { signOut } from "@/app/(auth)/actions";
import { StateBadge } from "@/components/state-badge";
import { createClient } from "@/lib/supabase/server";
import { loadArchiveStats } from "@/lib/editions/stats";
import { currentCircleId } from "@/lib/editions/circle";
import { ArchiveRolodex } from "./archive-rolodex";
import { Countdown } from "./countdown";
import type { Database } from "@/lib/types/database.types";
import { formatEventDate, formatEventDateTime } from "@/lib/dates/event-time";

export const metadata: Metadata = { title: "Accueil" };

type EditionState = Database["public"]["Enums"]["edition_state"];

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Administrateur général",
  admin: "Administrateur",
  player: "Joueur",
  jury: "Entourage",
};

function fmtDate(value: string | null) {
  if (!value) return null;
  return formatEventDate(value);
}
function fmtDateTime(value: string | null) {
  if (!value) return null;
  return formatEventDateTime(value);
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
        ? { label: "Scrutin clos" }
        : { label: "Accéder au scrutin", href: `/vote/${e.id}`, primary: true };
    case "CONSTRUCTION":
      return { label: "Cérémonie en préparation" };
    case "COMPILATION":
    case "LOCKED":
      return { label: "Dépouillement en cours" };
    case "LIVE":
      return { label: "Ce soir" };
    default:
      return { label: "Consulter le palmarès", href: `/archive/${e.id}`, primary: true };
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
    .select("edition_id, kind")
    .eq("user_id", current.user.id);
  const partByEdition = new Map((parts ?? []).map((p) => [p.edition_id, p]));
  const editionIds = (parts ?? []).map((p) => p.edition_id);

  // Le lien Apple est rattaché à la personne, pas au compte : c'est ce qui
  // permet de le préparer avant même que l'invité·e se soit inscrit·e.
  const { data: invites } = await supabase
    .from("edition_invites")
    .select("edition_id, apple_invite_url");
  const inviteByEdition = new Map(
    (invites ?? []).map((i) => [i.edition_id, i.apple_invite_url]),
  );

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

  // Cadré sur le cercle courant : le palmarès d'un cercle ne déborde jamais
  // sur l'autre, même pour quelqu'un qui appartient aux deux.
  const circleId = await currentCircleId(supabase);
  const { drinkers, editionsCount } = circleId
    ? await loadArchiveStats(supabase, circleId)
    : { drinkers: [], editionsCount: 0 };
  const topDrinker = drinkers[0];
  // Le palmarès personnel se lit dans le même classement — aucune requête de
  // plus : `drinkers` est déjà trié par gorgées cumulées.
  const myIndex = current.personId
    ? drinkers.findIndex((d) => d.personId === current.personId)
    : -1;
  const me = myIndex >= 0 ? drinkers[myIndex] : null;

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
          {current.administers && (
            <Link href="/admin/editions" className="text-or-300 hover:text-or-400 transition">
              Administration →
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
              appleInvite={inviteByEdition.get(upcoming.id) ?? null}
              kind={partByEdition.get(upcoming.id)?.kind ?? "player"}
            />
          ) : (
            <section className="border-or-400/15 bg-noir-700/40 relative flex min-h-[22rem] flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border p-10 text-center backdrop-blur-md">
              <span className="text-or-400/60 font-display text-3xl">
                À l&apos;an prochain.
              </span>
              <p className="text-ivoire-muted max-w-sm font-sans text-sm">
                Aucune cérémonie annoncée. La prochaine apparaîtra ici dès que vous y serez inscrit.
              </p>
              {archived.length > 0 && (
                <Link
                  href={`/archive/${archived[0].id}`}
                  className="text-or-300 hover:text-or-400 mt-2 font-sans text-sm transition"
                >
                  Revoir la dernière cérémonie →
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
                Le palmarès s&apos;établira après la première cérémonie.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {me ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-ivoire-faint font-sans text-xs tracking-wide uppercase">
                      Vos gorgées à ce jour
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-or-300 font-display text-5xl leading-none tabular-nums">
                        {me.totalDrinks}
                      </span>
                      <span className="text-ivoire-faint font-sans text-xs">
                        en {me.editionCount} cérémonie{me.editionCount > 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-ivoire-muted font-sans text-sm">
                      {myIndex === 0 ? (
                        <>
                          Vous êtes en tête du classement.
                        </>
                      ) : (
                        <>
                          <span className="text-or-300">
                            {myIndex + 1}
                            <sup>e</sup>
                          </span>{" "}
                          sur {drinkers.length} · {drinkers[0].totalDrinks - me.totalDrinks} gorgées
                          derrière {drinkers[0].name}
                        </>
                      )}
                    </p>
                    <p className="text-ivoire-faint font-sans text-xs">
                      {me.titleCount} titre{me.titleCount > 1 ? "s" : ""} remporté
                      {me.titleCount > 1 ? "s" : ""}.
                    </p>
                  </div>
                ) : (
                  topDrinker && (
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="text-ivoire-faint font-sans text-xs tracking-wide uppercase">
                          Plus forte consommation
                        </span>
                        <span className="text-ivoire font-display text-2xl font-semibold">
                          {topDrinker.name}
                        </span>
                      </div>
                      <span className="text-or-300 font-display text-3xl tabular-nums">
                        {topDrinker.totalDrinks}
                      </span>
                    </div>
                  )
                )}
                <p className="text-ivoire-faint font-sans text-xs">
                  Sur {editionsCount} soirée{editionsCount > 1 ? "s" : ""} archivée
                  {editionsCount > 1 ? "s" : ""}.
                </p>
                <Link
                  href="/archive"
                  className="text-or-300 hover:text-or-400 font-sans text-sm transition"
                >
                  Le palmarès complet →
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
  appleInvite,
  kind,
}: {
  edition: Edition;
  appleInvite: string | null;
  kind: string;
}) {
  const cta = ctaFor(edition);
  const showDeadline = edition.state === "SENT_FOR_VOTE";
  return (
    <section className="border-or-400/20 bg-noir-700/50 relative flex h-full min-h-[22rem] flex-col gap-6 overflow-hidden rounded-3xl border p-8 backdrop-blur-md">
      <div className="from-or-500/10 pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-br to-transparent blur-2xl" />

      <div className="relative flex flex-wrap items-center gap-3">
        <p className="text-or-400/80 font-sans text-xs tracking-[0.4em] uppercase">
          Prochaine cérémonie
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
        <Fact label="Date" value={fmtDate(edition.event_at) ?? "À confirmer"} />
        <Fact label="Lieu" value={edition.venue_name ?? "À confirmer"} />
        {edition.venue_address && <Fact label="Adresse" value={edition.venue_address} />}
        <Fact label="Vous y participez comme" value={kind === "jury" ? "Entourage" : "Joueur"} />
      </dl>

      {edition.description && (
        <p className="text-ivoire-muted relative max-w-prose font-sans text-sm">
          {edition.description}
        </p>
      )}

      <div className="relative mt-auto flex flex-col gap-5">
        {edition.event_at && <Countdown target={edition.event_at} />}

        {/* Action principale puis invitation, sur une seule ligne. */}
        <div className="flex flex-wrap items-center gap-3">
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

          {appleInvite && (
            <a
              href={appleInvite}
              target="_blank"
              rel="noopener noreferrer"
              className="border-or-400/30 text-or-300 hover:bg-noir-900 inline-flex items-center gap-2 rounded-full border px-6 py-3 font-sans text-sm transition"
            >
              <AppleLogo />
              Consulter l&apos;invitation
            </a>
          )}

          {showDeadline && edition.vote_deadline && (
            <span className="text-ivoire-faint font-sans text-xs">
              Scrutin ouvert jusqu&apos;au {fmtDateTime(edition.vote_deadline)}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

/** Logo Apple (glyphe officiel). Apple Invites n'a pas de marque distincte
 *  distribuable : on utilise donc la pomme, en usage nominatif — le bouton
 *  pointe vers le service Apple lui-même. `currentColor` pour rester dans la
 *  direction artistique dorée. */
function AppleLogo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 814 1000"
      className="h-[1.05em] w-auto shrink-0"
      fill="currentColor"
    >
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zM554 159.4c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
    </svg>
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
