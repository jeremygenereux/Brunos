import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getCurrentUser, type Role } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreatePersonForm } from "./create-person-form";
import { RoleSelect } from "./role-select";
import { renamePerson, deletePerson } from "./actions";

export const metadata: Metadata = { title: "Banque de joueurs" };

export default async function PeoplePage() {
  await requireAdmin();
  const supabase = await createClient();
  const current = await getCurrentUser();

  const { data: people } = await supabase
    .from("people")
    .select("id, display_name, auth_user_id")
    .order("display_name");

  const { data: players } = await supabase.from("players").select("person_id");
  const editionCount = new Map<string, number>();
  for (const p of players ?? []) {
    editionCount.set(p.person_id, (editionCount.get(p.person_id) ?? 0) + 1);
  }

  const { data: profiles } = await supabase.from("profiles").select("user_id, role, person_id");
  const accountByPerson = new Map(
    (profiles ?? [])
      .filter((p) => p.person_id)
      .map((p) => [p.person_id as string, { role: p.role as Role, userId: p.user_id }]),
  );

  // Emails are a best-effort enrichment (needs the service-role key).
  const emailByUser = new Map<string, string | undefined>();
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient();
      const { data } = await admin.auth.admin.listUsers();
      for (const u of data?.users ?? []) emailByUser.set(u.id, u.email);
    } catch {
      // no-op — fall back to account badge without email
    }
  }

  const roster = people ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <p className="text-or-400/80 font-sans text-xs tracking-[0.4em] uppercase">Admin</p>
      <h1 className="text-ivoire font-display mt-2 text-4xl font-semibold">Banque de joueurs</h1>
      <p className="text-ivoire-muted mt-1 font-sans text-sm">
        L&apos;annuaire pérenne des personnes. On associe ces joueurs aux éditions — leur identité
        (et leurs stats à vie) traverse les années.
      </p>

      <section className="mt-8">
        <CreatePersonForm />
      </section>

      <section className="mt-10">
        {roster.length === 0 ? (
          <p className="border-or-400/10 text-ivoire-muted rounded-2xl border border-dashed px-6 py-10 text-center font-sans text-sm">
            La banque est vide. Ajoute une première personne ci-dessus.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {roster.map((person) => {
              const account = accountByPerson.get(person.id);
              const editions = editionCount.get(person.id) ?? 0;
              const email = account ? emailByUser.get(account.userId) : undefined;
              const isSelf = account?.userId === current?.user.id;
              return (
                <li
                  key={person.id}
                  className="border-or-400/12 bg-noir-700/40 flex flex-col gap-3 rounded-2xl border px-5 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-ivoire font-sans font-medium">
                        {person.display_name ?? "Sans nom"}
                      </span>
                      <span className="text-ivoire-faint font-sans text-xs">
                        {account ? (
                          <>
                            <span className="text-or-300">Compte actif</span>
                            {email ? ` · ${email}` : ""} ·{" "}
                          </>
                        ) : (
                          "Sans compte · "
                        )}
                        {editions} édition{editions > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {account ? (
                        <RoleSelect personId={person.id} initial={account.role} isSelf={!!isSelf} />
                      ) : (
                        <span className="text-ivoire-faint font-sans text-xs">
                          Nominé (sans compte)
                        </span>
                      )}
                    </div>
                  </div>

                  <details className="group">
                    <summary className="text-ivoire-faint hover:text-or-300 w-fit cursor-pointer font-sans text-xs transition">
                      Modifier
                    </summary>
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <form action={renamePerson} className="flex items-end gap-2">
                        <input type="hidden" name="person_id" value={person.id} />
                        <input
                          name="name"
                          defaultValue={person.display_name ?? ""}
                          required
                          className="border-or-400/20 bg-noir-900/60 text-ivoire focus:border-or-400/60 rounded-lg border px-3 py-1.5 font-sans text-sm outline-none"
                        />
                        <button
                          type="submit"
                          className="border-or-400/30 text-or-300 hover:bg-noir-900 rounded-lg border px-3 py-1.5 font-sans text-sm transition"
                        >
                          Renommer
                        </button>
                      </form>
                      <form action={deletePerson}>
                        <input type="hidden" name="person_id" value={person.id} />
                        <button
                          type="submit"
                          disabled={editions > 0}
                          title={
                            editions > 0
                              ? "Retire la personne de toutes les éditions avant de la supprimer"
                              : undefined
                          }
                          className="rounded-lg border border-red-400/20 px-3 py-1.5 font-sans text-sm text-red-300/80 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Supprimer
                        </button>
                      </form>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!process.env.SUPABASE_SERVICE_ROLE_KEY && (
        <p className="text-ivoire-faint mt-6 font-sans text-xs">
          Astuce : les comptes se créent quand une personne s&apos;inscrit puis rejoint via le lien
          d&apos;invitation d&apos;une édition. Tu ajustes ensuite son rôle ici.
        </p>
      )}
    </main>
  );
}
