import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { signOut } from "@/app/(auth)/actions";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  const unread = count ?? 0;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-or-400/15 bg-noir-800/70 flex items-center justify-between gap-6 border-b px-6 py-4 backdrop-blur-md">
        <Link href="/admin" className="text-ivoire font-display text-lg font-semibold">
          Les Brunos <span className="text-or-400/70 font-sans text-xs">· Admin</span>
        </Link>
        <nav className="flex items-center gap-6 font-sans text-sm">
          <Link href="/admin/editions" className="text-ivoire-muted hover:text-or-300 transition">
            Éditions
          </Link>
          <Link href="/admin/people" className="text-ivoire-muted hover:text-or-300 transition">
            Banque de joueurs
          </Link>
          <Link
            href="/admin/notifications"
            className="text-ivoire-muted hover:text-or-300 inline-flex items-center gap-1.5 transition"
          >
            Notifications
            {unread > 0 && (
              <span className="bg-or-500 text-noir-900 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums">
                {unread}
              </span>
            )}
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="text-ivoire-faint hover:text-ivoire font-sans text-sm transition"
            >
              Déconnexion
            </button>
          </form>
        </nav>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
