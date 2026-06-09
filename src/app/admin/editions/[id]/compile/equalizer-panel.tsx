"use client";

import { useState, useTransition } from "react";
import { equalize, type QuestionLoad } from "@/lib/scoring/equalizer";
import { saveSelection, type SelectionResult } from "./actions";

type Player = { id: string; name: string };
type Question = {
  id: string;
  prompt: string;
  format: string;
  drinks: Record<string, number>;
};

function totalsFor(selected: Set<string>, questions: Question[], players: Player[]) {
  const totals: Record<string, number> = {};
  for (const p of players) totals[p.id] = 0;
  for (const q of questions) {
    if (!selected.has(q.id)) continue;
    for (const p of players) totals[p.id] += q.drinks[p.id] ?? 0;
  }
  return totals;
}

function spreadOf(totals: Record<string, number>) {
  const vals = Object.values(totals);
  if (!vals.length) return 0;
  return Math.max(...vals) - Math.min(...vals);
}

export function EqualizerPanel({
  editionId,
  players,
  questions,
  initialSelected,
}: {
  editionId: string;
  players: Player[];
  questions: Question[];
  initialSelected: string[];
}) {
  const [k, setK] = useState(initialSelected.length || Math.min(questions.length, 20));
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [result, setResult] = useState<SelectionResult>({ error: null });
  const [pending, startTransition] = useTransition();

  const totals = totalsFor(selected, questions, players);
  const spread = spreadOf(totals);

  function suggest() {
    const candidates: QuestionLoad[] = questions.map((q) => ({
      questionId: q.id,
      drinks: new Map(Object.entries(q.drinks)),
    }));
    const r = equalize(
      candidates,
      players.map((p) => p.id),
      k,
    );
    setSelected(new Set(r.selected));
    setResult({ error: null });
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    setResult({ error: null });
  }

  function save() {
    const ordered = questions.filter((q) => selected.has(q.id)).map((q) => q.id);
    startTransition(async () => setResult(await saveSelection(editionId, ordered)));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border-or-400/15 bg-noir-700/40 flex flex-wrap items-end gap-4 rounded-2xl border p-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-ivoire-muted font-sans text-xs tracking-wider uppercase">
            Questions à présenter
          </span>
          <input
            type="number"
            min={1}
            max={questions.length}
            value={k}
            onChange={(e) => setK(Math.max(1, Math.min(questions.length, Number(e.target.value))))}
            className="border-or-400/20 bg-noir-900/60 text-ivoire focus:border-or-400/60 w-24 rounded-lg border px-3 py-2 font-sans outline-none"
          />
        </label>
        <button
          type="button"
          onClick={suggest}
          className="border-or-400/40 text-or-300 hover:bg-noir-900 rounded-lg border px-4 py-2 font-sans text-sm transition"
        >
          Suggérer la combinaison équilibrée
        </button>
      </div>

      <div className="border-or-400/15 bg-noir-700/40 rounded-2xl border p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-or-400/80 font-sans text-xs tracking-[0.3em] uppercase">
            Équilibre des gorgées
          </h2>
          <span className="text-ivoire-muted font-sans text-xs">
            Écart max−min : <span className="text-or-300">{spread}</span>
          </span>
        </div>
        <ul className="flex flex-col gap-1.5">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 font-sans text-sm">
              <span className="text-ivoire w-28 shrink-0 truncate">{p.name}</span>
              <span className="text-or-300 w-10 text-right">{totals[p.id]}</span>
              <span className="bg-noir-900/60 h-2 flex-1 overflow-hidden rounded-full">
                <span
                  className="from-or-300 to-or-600 block h-full bg-gradient-to-r"
                  style={{
                    width: `${Math.min(100, (totals[p.id] / (Math.max(1, spreadOf(totals) + Math.min(...Object.values(totals))) || 1)) * 100)}%`,
                  }}
                />
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-or-400/80 mb-3 font-sans text-xs tracking-[0.3em] uppercase">
          Questions ({selected.size} sélectionnées)
        </h2>
        <ul className="flex flex-col gap-2">
          {questions.map((q) => (
            <li
              key={q.id}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                selected.has(q.id)
                  ? "border-or-400/40 bg-or-500/5"
                  : "border-or-400/15 bg-noir-700/40"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(q.id)}
                onChange={() => toggle(q.id)}
                className="accent-[var(--or-500)]"
              />
              <span className="text-ivoire flex-1 font-sans text-sm">{q.prompt}</span>
              <span className="text-ivoire-faint shrink-0 font-sans text-xs">
                {Object.values(q.drinks).reduce((a, b) => a + b, 0)} gorgées
              </span>
            </li>
          ))}
        </ul>
      </div>

      {result.error && <p className="font-sans text-sm text-red-300/90">{result.error}</p>}
      {result.saved && <p className="text-or-300 font-sans text-sm">Sélection enregistrée ✓</p>}

      <button
        type="button"
        onClick={save}
        disabled={pending || selected.size === 0}
        className="from-or-300 to-or-600 text-noir-900 hover:from-or-400 hover:to-or-500 w-full rounded-lg bg-gradient-to-b px-4 py-3 font-sans text-sm font-semibold shadow-lg transition disabled:opacity-60"
      >
        {pending ? "Enregistrement…" : `Enregistrer la sélection (${selected.size})`}
      </button>
    </div>
  );
}
