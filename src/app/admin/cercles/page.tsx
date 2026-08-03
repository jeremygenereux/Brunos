import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Avatar } from "@/components/avatar";
import { CreateCircleForm } from "./create-form";
import { AdminToggle } from "./admin-toggle";
import { renameCircle } from "./actions";

export const metadata: Metadata = { title: "Cercles" };

export default async function CirclesPage() {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { data: circles } = await supabase.from("circles").select("id, name").order("name");
  const { data: people } = await supabase
    .from("people")
    .select("id, display_name, headshot_url, auth_user_id, circle_id");
  const { data: admins } = await supabase.from("circle_admins").select("circle_id, user_id");
  const { data: editions } = await supabase.from("editions").select("id, circle_id");

  // Le courriel n'est qu'un repère visuel : il aide à distinguer deux
  // homonymes de cercles différents.
  const emailByUser = new Map<string, string | undefined>();
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient();
      const { data } = await admin.auth.admin.listUsers();
      for (const u of data?.users ?? []) emailByUser.set(u.id, u.email);
    } catch {
      // Sans la clé service-role, on se passe des courriels.
    }
  }

  const adminUserIds = new Set((admins ?? []).map((a) => `${a.circle_id}:${a.user_id}`));

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <p className="text-or-400/80 font-sans text-xs tracking-[0.4em] uppercase">
        Intendance générale
      </p>
      <h1 className="text-ivoire font-display mt-2 text-4xl font-semibold">Les cercles</h1>
      <p className="text-ivoire-muted mt-1 max-w-2xl font-sans text-sm">
        Chaque cercle mène ses cérémonies, son répertoire et son palmarès en toute indépendance.
        Rien ne circule de l&apos;un à l&apos;autre. Vous seul les traversez.
      </p>

      <section className="mt-8">
        <CreateCircleForm />
      </section>

      <section className="mt-12 flex flex-col gap-4">
        {(circles ?? []).map((c) => {
          const members = (people ?? []).filter((p) => p.circle_id === c.id);
          const withAccount = members.filter((p) => p.auth_user_id);
          const editionCount = (editions ?? []).filter((e) => e.circle_id === c.id).length;

          return (
            <article
              key={c.id}
              className="border-or-400/15 bg-noir-700/40 flex flex-col gap-4 rounded-2xl border px-6 py-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-ivoire font-display text-2xl font-semibold">{c.name}</h2>
                <span className="text-ivoire-faint font-sans text-xs">
                  {members.length} personne{members.length > 1 ? "s" : ""} · {editionCount}{" "}
                  cérémonie{editionCount > 1 ? "s" : ""}
                </span>
              </div>

              <form action={renameCircle} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="circle_id" value={c.id} />
                <input
                  name="name"
                  defaultValue={c.name}
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

              <div className="flex flex-col gap-2">
                <span className="text-or-400/70 font-sans text-[11px] tracking-[0.2em] uppercase">
                  Administrateurs
                </span>
                {withAccount.length === 0 ? (
                  <p className="text-ivoire-faint font-sans text-xs">
                    Aucun membre ne dispose encore d&apos;un compte. Invitez quelqu&apos;un depuis le
                    répertoire avant de pouvoir le nommer.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {withAccount.map((p) => {
                      const isAdmin = adminUserIds.has(`${c.id}:${p.auth_user_id}`);
                      return (
                        <li
                          key={p.id}
                          className="border-or-400/12 bg-noir-900/40 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5"
                        >
                          <Avatar
                            name={p.display_name ?? "?"}
                            headshot={p.headshot_url}
                            size={32}
                          />
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="text-ivoire font-sans text-sm">
                              {p.display_name ?? "Sans nom"}
                            </span>
                            <span className="text-ivoire-faint font-sans text-[11px]">
                              {emailByUser.get(p.auth_user_id!) ?? "compte actif"}
                              {isAdmin && <span className="text-or-300"> · administrateur</span>}
                            </span>
                          </div>
                          <AdminToggle
                            circleId={c.id}
                            userId={p.auth_user_id!}
                            isAdmin={isAdmin}
                            label="administrateur"
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
