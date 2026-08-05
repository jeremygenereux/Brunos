"use client";

import { useState } from "react";

/**
 * Le lien de bulletin d'un proche. Il n'y a rien d'autre à transmettre : pas
 * d'identifiant, pas de mot de passe, pas de courriel à envoyer. On copie, on
 * colle dans un message, c'est fini.
 */
export function BallotLink({ url, name }: { url: string; name: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Le presse-papiers peut être refusé (contexte non sécurisé, permission
      // navigateur). On le dit plutôt que de laisser croire à une copie.
      window.prompt(`Copiez le lien de ${name} :`, url);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={url}
      className="border-or-400/25 text-or-300 hover:border-or-400/60 hover:text-or-200 rounded-full border px-3 py-1 font-sans text-xs transition"
    >
      {copied ? "Lien copié ✓" : "Copier le lien"}
    </button>
  );
}
