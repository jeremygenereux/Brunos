"use client";

import { useState } from "react";

export function InviteLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/join/${token}`;

  function copy() {
    const url = `${window.location.origin}${path}`;
    void navigator.clipboard?.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="border-or-400/15 bg-noir-700/40 flex items-center gap-3 rounded-xl border px-4 py-3">
      <code className="text-ivoire-muted flex-1 truncate font-mono text-sm">{path}</code>
      <button
        type="button"
        onClick={copy}
        className="border-or-400/30 text-or-300 hover:bg-noir-900 shrink-0 rounded-md border px-3 py-1.5 font-sans text-xs transition"
      >
        {copied ? "Copié ✓" : "Copier le lien"}
      </button>
    </div>
  );
}
