import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { markAllNotificationsRead } from "./actions";
import { formatEventDateTime } from "@/lib/dates/event-time";

export const metadata: Metadata = { title: "Notifications" };

function editionName(editions: unknown): { name: string; id: string } | null {
  const e = Array.isArray(editions) ? editions[0] : editions;
  if (!e) return null;
  return { name: (e as { name?: string }).name ?? "Édition", id: (e as { id?: string }).id ?? "" };
}

function fmt(value: string) {
  return formatEventDateTime(value, "medium");
}

export default async function NotificationsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, kind, message, created_at, read_at, edition_id, editions(id, name)")
    .order("created_at", { ascending: false })
    .limit(100);
  const list = notifications ?? [];
  const unread = list.filter((n) => !n.read_at).length;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-or-400/80 font-sans text-xs tracking-[0.4em] uppercase">Admin</p>
          <h1 className="text-ivoire font-display mt-2 text-4xl font-semibold">Notifications</h1>
        </div>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="border-or-400/30 text-or-300 hover:bg-noir-900 rounded-full border px-4 py-2 font-sans text-sm transition"
            >
              Tout marquer comme lu ({unread})
            </button>
          </form>
        )}
      </div>

      <section className="mt-8">
        {list.length === 0 ? (
          <p className="border-or-400/10 text-ivoire-muted rounded-2xl border border-dashed px-6 py-12 text-center font-sans text-sm">
            Aucune notification pour l&apos;instant. Les bulletins déposés apparaîtront ici.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((n) => {
              const ed = editionName(n.editions);
              const isUnread = !n.read_at;
              return (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 rounded-2xl border px-5 py-4 ${
                    isUnread ? "border-or-400/40 bg-or-500/5" : "border-or-400/12 bg-noir-700/40"
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      isUnread ? "bg-or-400" : "bg-ivoire-faint/40"
                    }`}
                  />
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-ivoire font-sans text-sm">{n.message}</span>
                    <span className="text-ivoire-faint font-sans text-xs">
                      {fmt(n.created_at)}
                      {ed ? (
                        <>
                          {" · "}
                          <Link
                            href={`/admin/editions/${n.edition_id}`}
                            className="hover:text-or-300 transition"
                          >
                            {ed.name}
                          </Link>
                        </>
                      ) : null}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
