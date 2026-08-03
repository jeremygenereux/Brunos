import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { signOut } from "@/app/(auth)/actions";
import { createClient } from "@/lib/supabase/server";
import { NotificationBell } from "./notification-bell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  const supabase = await createClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, message, created_at, read_at, edition_id")
    .order("created_at", { ascending: false })
    .limit(8);
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
          <Link href="/account" className="text-ivoire-muted hover:text-or-300 transition">
            Accueil
          </Link>
          <NotificationBell notifications={notifications ?? []} unread={unread} />
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
