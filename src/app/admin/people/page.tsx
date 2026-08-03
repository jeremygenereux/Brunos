import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getCurrentUser, type Role } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreatePersonForm } from "./create-person-form";
import { PersonCard, type PersonView } from "./person-card";
import { currentCircleId } from "@/lib/editions/circle";

export const metadata: Metadata = { title: "Banque de joueurs" };

export default async function PeoplePage() {
  await requireAdmin();
  const supabase = await createClient();
  const current = await getCurrentUser();

  // Cadré sur le cercle courant. Les fiches SANS cercle (inscription hors
  // invitation) sont récupérées à part : sans cela elles n'apparaîtraient nulle
  // part et resteraient orphelines pour toujours.
  const circleId = await currentCircleId(supabase);
  const { data: people } = circleId
    ? await supabase
        .from("people")
        .select("id, display_name, auth_user_id, headshot_url, kind")
        .eq("circle_id", circleId)
        .order("display_name")
    : { data: [] };

  const { data: unaffiliated } = await supabase
    .from("people")
    .select("id, display_name, auth_user_id, headshot_url, kind")
    .is("circle_id", null)
    .order("display_name");

  const { data: circleAdmins } = circleId
    ? await supabase.from("circle_admins").select("user_id").eq("circle_id", circleId)
    : { data: [] };
  const adminUserIds = new Set((circleAdmins ?? []).map((a) => a.user_id));

  const { data: circleRow } = circleId
    ? await supabase.from("circles").select("name").eq("id", circleId).maybeSingle()
    : { data: null };
  const circleName = circleRow?.name ?? "ce cercle";

  const { data: players } = await supabase.from("players").select("person_id");
  const editionCount = new Map<string, number>();
  for (const p of players ?? []) {
    editionCount.set(p.person_id, (editionCount.get(p.person_id) ?? 0) + 1);
  }

  const { data: invites } = await supabase.from("person_invites").select("person_id, email");
  const inviteByPerson = new Map((invites ?? []).map((i) => [i.person_id, i.email]));

  const { data: profiles } = await supabase.from("profiles").select("user_id, role, person_id");
  const accountByPerson = new Map(
    (profiles ?? [])
      .filter((p) => p.person_id)
      .map((p) => [p.person_id as string, { role: p.role as Role, userId: p.user_id }]),
  );

  // Enrichissement au mieux : nécessite la clé service-role. `usedByUser`
  // sépare un compte réellement utilisé d'un compte créé par invitation mais
  // jamais activé — c'est ce qui décide entre « inviter » et « relancer ».
  const emailByUser = new Map<string, string | undefined>();
  const usedByUser = new Map<string, boolean>();
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient();
      const { data } = await admin.auth.admin.listUsers();
      for (const u of data?.users ?? []) {
        emailByUser.set(u.id, u.email);
        usedByUser.set(u.id, Boolean(u.last_sign_in_at));
      }
    } catch {
      // On se rabat sur l'affichage sans courriel.
    }
  }

  const views: PersonView[] = (people ?? []).map((p) => {
    const account = accountByPerson.get(p.id) ?? null;
    return {
      id: p.id,
      name: p.display_name ?? "Sans nom",
      kind: (p.kind ?? "player") as "player" | "jury",
      headshot: p.headshot_url,
      editions: editionCount.get(p.id) ?? 0,
      invitedEmail: inviteByPerson.get(p.id) ?? "",
      account,
      accountEmail: account ? emailByUser.get(account.userId) : undefined,
      accountUsed: account ? (usedByUser.get(account.userId) ?? true) : false,
      isSelf: account?.userId === current?.user.id,
      isCircleAdmin: account ? adminUserIds.has(account.userId) : false,
      unaffiliated: false,
    };
  });

  const joueurs = views.filter((p) => p.kind === "player");
  const proches = views.filter((p) => p.kind === "jury");
  const orphelins: PersonView[] = (unaffiliated ?? []).map((p) => {
    const account = accountByPerson.get(p.id) ?? null;
    return {
      id: p.id,
      name: p.display_name ?? "Sans nom",
      kind: (p.kind ?? "player") as "player" | "jury",
      headshot: p.headshot_url,
      editions: editionCount.get(p.id) ?? 0,
      invitedEmail: inviteByPerson.get(p.id) ?? "",
      account,
      accountEmail: account ? emailByUser.get(account.userId) : undefined,
      accountUsed: account ? (usedByUser.get(account.userId) ?? true) : false,
      isSelf: account?.userId === current?.user.id,
      isCircleAdmin: false,
      unaffiliated: true,
    };
  });

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <p className="text-or-400/80 font-sans text-xs tracking-[0.4em] uppercase">Admin</p>
      <h1 className="text-ivoire font-display mt-2 text-4xl font-semibold">Le répertoire</h1>
      <p className="text-ivoire-muted mt-1 max-w-2xl font-sans text-sm">
        L&apos;annuaire permanent. Chaque personne conserve la même fiche d&apos;une cérémonie à
        l&apos;autre : portrait, accès et statistiques.
      </p>

      <section className="mt-8">
        <CreatePersonForm />
      </section>

      <Group
        title="Joueurs"
        count={joueurs.length}
        hint="Susceptibles d'être nommés dans une cérémonie et de s'acquitter des charges au classement."
        people={joueurs}
        empty="Aucun joueur pour l&apos;instant."
        circleId={circleId}
        circleName={circleName}
      />

      <Group
        title="Proches"
        count={proches.length}
        hint="Famille et proches. Leur suffrage est consultatif et ils ne sont jamais nommés. Le rattachement s'effectue depuis la fiche de la cérémonie."
        people={proches}
        empty="Aucun proche pour l&apos;instant."
        circleId={circleId}
        circleName={circleName}
      />

      {orphelins.length > 0 && (
        <Group
          title="Sans cercle"
          count={orphelins.length}
          hint="Comptes créés sans invitation, rattachés à aucun cercle. Ils ne voient rien et ne sont visibles d'aucun administrateur de cercle tant qu'ils ne sont pas affiliés."
          people={orphelins}
          empty=""
          circleId={circleId}
          circleName={circleName}
        />
      )}
    </main>
  );
}

function Group({
  title,
  count,
  hint,
  people,
  empty,
  circleId,
  circleName,
}: {
  title: string;
  count: number;
  hint: string;
  people: PersonView[];
  empty: string;
  circleId: string | null;
  circleName: string;
}) {
  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-ivoire font-display text-2xl font-semibold">{title}</h2>
        <span className="text-or-300 font-sans text-sm tabular-nums">{count}</span>
      </div>
      <p className="text-ivoire-muted mt-1 max-w-2xl font-sans text-sm">{hint}</p>

      {people.length === 0 ? (
        <p className="border-or-400/10 text-ivoire-muted mt-4 rounded-2xl border border-dashed px-6 py-8 text-center font-sans text-sm">
          {empty}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {people.map((p) => (
            <PersonCard key={p.id} person={p} circleId={circleId} circleName={circleName} />
          ))}
        </ul>
      )}
    </section>
  );
}
