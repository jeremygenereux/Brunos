"use client";

import { useState, useTransition } from "react";
import { setQuestionReveal } from "./actions";
import type { DramaCard } from "@/lib/editions/presentation-types";

export type RevealItem = {
  questionId: string;
  prompt: string;
  drama: DramaCard[];
  ballotCount: number;
  revealEnabled: boolean;
};

function Toggle({ editionId, item }: { editionId: string; item: RevealItem }) {
  const [on, setOn] = useState(item.revealEnabled);
  const [pending, start] = useTransition();
  function flip() {
    const next = !on;
    setOn(next);
    start(async () => {
      const r = await setQuestionReveal(editionId, item.questionId, next);
      if (r.error) setOn(!next);
    });
  }
  return (
    <button
      type="button"
      onClick={flip}
      disabled={pending}
      role="switch"
      aria-checked={on}
      aria-label="Afficher en présentation"
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        on ? "bg-or-500" : "bg-noir-900 border-or-400/20 border"
      }`}
    >
      <span
        className={`bg-ivoire absolute top-0.5 h-5 w-5 rounded-full transition-all ${
          on ? "left-5" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function RevealCurator({ editionId, items }: { editionId: string; items: RevealItem[] }) {
  return (
    <section className="mt-12">
      <h2 className="text-or-400/80 font-sans text-xs tracking-[0.3em] uppercase">
        Révélations & déboules
      </h2>
      <p className="text-ivoire-muted mt-1 mb-5 font-sans text-sm">
        Aperçu de ce qui pourra être révélé en présentation et dans l&apos;archive. Active ou
        désactive par question.
      </p>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item.questionId}
            className={`rounded-2xl border p-5 transition ${
              item.revealEnabled
                ? "border-or-400/25 bg-noir-700/40"
                : "border-or-400/10 bg-noir-700/20 opacity-60"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-ivoire font-display text-lg leading-tight font-semibold">
                  {item.prompt}
                </h3>
                <span className="text-ivoire-faint font-sans text-xs">
                  {item.ballotCount} bulletin{item.ballotCount > 1 ? "s" : ""}
                  {item.drama.length > 0
                    ? ` · ${item.drama.length} déboule${item.drama.length > 1 ? "s" : ""}`
                    : " · pas de déboule"}
                </span>
              </div>
              <Toggle editionId={editionId} item={item} />
            </div>
            {item.drama.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {item.drama.map((d, i) => (
                  <div
                    key={`${d.kind}-${i}`}
                    className="brunos-glass border-or-400/20 rounded-xl border px-3 py-2"
                  >
                    <span className="text-or-300 font-sans text-sm font-medium">{d.title}</span>
                    <span className="text-ivoire-muted font-sans text-sm"> — {d.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
