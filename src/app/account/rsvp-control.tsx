"use client";

import { useState, useTransition } from "react";
import { setRsvp, type RsvpStatus } from "./actions";

const OPTIONS: { value: RsvpStatus; label: string; emoji: string }[] = [
  { value: "yes", label: "J'y serai", emoji: "🥂" },
  { value: "maybe", label: "Peut-être", emoji: "🤔" },
  { value: "no", label: "Absent·e", emoji: "🚫" },
];

export function RsvpControl({
  editionId,
  initial,
}: {
  editionId: string;
  initial: RsvpStatus | null;
}) {
  const [value, setValue] = useState<RsvpStatus | null>(initial);
  const [pending, start] = useTransition();

  function choose(v: RsvpStatus) {
    const prev = value;
    setValue(v);
    start(async () => {
      const r = await setRsvp(editionId, v);
      if (r.error) setValue(prev);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-ivoire-faint font-sans text-xs tracking-[0.2em] uppercase">
        Ta présence
      </span>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => choose(o.value)}
            disabled={pending}
            aria-pressed={value === o.value}
            className={`rounded-full border px-4 py-2 font-sans text-sm transition disabled:opacity-60 ${
              value === o.value
                ? "border-or-400/60 bg-or-500/15 text-or-200"
                : "border-or-400/15 text-ivoire-muted hover:border-or-400/40 hover:text-ivoire"
            }`}
          >
            <span aria-hidden>{o.emoji}</span> {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
