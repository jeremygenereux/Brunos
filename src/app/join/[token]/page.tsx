import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Rejoindre une édition" };

type JoinInfo = {
  id: string;
  name: string;
  state: string;
  event_at: string | null;
  venue_name: string | null;
  already_participant: boolean;
  players: { id: string; display_name: string }[];
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="border-or-400/20 bg-noir-700/60 w-full max-w-md rounded-2xl border p-8 shadow-2xl backdrop-blur-xl">
        {children}
      </div>
    </main>
  );
}

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const current = await getCurrentUser();

  if (!current) {
    return (
      <Shell>
        <h1 className="text-ivoire font-display text-3xl font-semibold">Rejoindre les Brunos</h1>
        <p className="text-ivoire-muted mt-2 font-sans text-sm">
          Identifiez-vous ou créez votre accès pour prendre part au scrutin.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={`/login?next=/join/${token}`}
            className="from-or-300 to-or-600 text-noir-900 hover:from-or-400 hover:to-or-500 rounded-lg bg-gradient-to-b px-4 py-2.5 text-center font-sans text-sm font-semibold shadow-lg transition"
          >
            Se connecter
          </Link>
          <Link
            href={`/signup?next=/join/${token}`}
            className="text-ivoire-muted hover:text-or-300 text-center font-sans text-sm transition"
          >
            Créer un compte
          </Link>
        </div>
      </Shell>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("edition_join_info", { p_token: token });
  const info = data as JoinInfo | null;

  if (!info) {
    return (
      <Shell>
        <h1 className="text-ivoire font-display text-3xl font-semibold">Invitation invalide</h1>
        <p className="text-ivoire-muted mt-2 font-sans text-sm">
          Ce lien ne correspond à aucune cérémonie. Veuillez en demander un nouveau à
          l&apos;organisateur.
        </p>
        <Link href="/account" className="text-or-300 mt-6 inline-block font-sans text-sm">
          ← Mon espace
        </Link>
      </Shell>
    );
  }

  if (info.already_participant) {
    return (
      <Shell>
        <p className="text-or-400/80 font-sans text-xs tracking-[0.3em] uppercase">
          Déjà inscrit·e
        </p>
        <h1 className="text-ivoire font-display mt-2 text-3xl font-semibold">{info.name}</h1>
        <p className="text-ivoire-muted mt-2 font-sans text-sm">
          Votre participation est déjà enregistrée.
        </p>
        <Link href="/account" className="text-or-300 mt-6 inline-block font-sans text-sm">
          ← Mon espace
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-or-400/80 font-sans text-xs tracking-[0.3em] uppercase">Invitation</p>
      <h1 className="text-ivoire font-display mt-2 text-3xl font-semibold">{info.name}</h1>
      <p className="text-ivoire-muted mt-2 mb-6 font-sans text-sm">
        Prenez part au scrutin de cette cérémonie.
      </p>
      <JoinForm token={token} players={info.players} />
    </Shell>
  );
}
