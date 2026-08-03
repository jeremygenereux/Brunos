import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getCurrentUser, type Role } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreatePersonForm } from "./create-person-form";
import { PersonCard, type PersonView } from "./person-card";

export const metadata: Metadata = { title: "Banque de joueurs" };

export default async function PeoplePage() {
  await requireAdmin();
  const supabase = await createClient();
  const current = await getCurrentUser();

  const { data: people } = await supabase
    .from("people")
    .select("id, display_name, auth_user_id, headshot_url, kind")
    .order("display_name");

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
    };
  });

  const joueurs = views.filter((p) => p.kind === "player");
  const proches = views.filter((p) => p.kind === "jury");

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
      />

      <Group
        title="Proches"
        count={proches.length}
        hint="Famille et proches. Leur suffrage est consultatif et ils ne sont jamais nommés. Le rattachement s'effectue depuis la fiche de la cérémonie."
        people={proches}
        empty="Aucun proche pour l&apos;instant."
      />
    </main>
  );
}

function Group({
  title,
  count,
  hint,
  people,
  empty,
}: {
  title: string;
  count: number;
  hint: string;
  people: PersonView[];
  empty: string;
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
            <PersonCard key={p.id} person={p} />
          ))}
        </ul>
      )}
    </section>
  );
}
