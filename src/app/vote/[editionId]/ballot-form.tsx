"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { submitBallot, type BallotResult } from "./actions";
import { DRINK_RULE_LABEL, type DrinkRule } from "@/lib/editions/drink-rule";

type Player = { id: string; display_name: string; headshot_url: string | null };
type Question = {
  id: string;
  prompt: string;
  format: string;
  drinkRule: DrinkRule;
  initialRanking: string[];
  initialChoice: string;
};

/**
 * L'enjeu de la catégorie, dit sans détour.
 *
 * On classe TOUJOURS du plus concerné (en haut) au moins concerné. Ce qui
 * change d'une catégorie à l'autre, c'est qui trinque au bout — et ça, le
 * votant doit le savoir avant de classer, sinon il vote à l'aveugle.
 *
 * Nuance importante : c'est le classement COLLECTIF final qui décide, pas le
 * bulletin de la personne. On le formule donc ainsi.
 */
function StakeNotice({ rule, format }: { rule: DrinkRule; format: string }) {
  const winnerDrinks = rule === "TOP_UNIQUE";
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl border px-4 py-3 ${
        winnerDrinks ? "border-or-400/35 bg-or-500/10" : "border-or-400/20 bg-noir-900/40"
      }`}
    >
      <span className="text-or-300 font-sans text-[11px] tracking-[0.25em] uppercase">
        🥃 {DRINK_RULE_LABEL[rule]}
      </span>
      <p className="text-ivoire font-sans text-xs leading-relaxed">
        {winnerDrinks ? (
          <>
            C&apos;est la personne arrivée <strong>1re</strong> au classement final — celle que le
            groupe juge la plus concernée — qui <strong>cale le shooter</strong>.
          </>
        ) : (
          <>
            C&apos;est la personne arrivée <strong>dernière</strong> au classement final — celle que
            le groupe juge la moins concernée — qui <strong>cale le shooter</strong>.
            {format === "ranking" && " Les autres boivent selon leur rang."}
          </>
        )}
      </p>
      <p className="text-ivoire-faint font-sans text-[11px]">
        {format === "ranking"
          ? "Classe quand même du plus concerné au moins concerné : c'est le total du groupe qui tranche."
          : "Choisis la personne la plus concernée : c'est le total des voix qui tranche."}
      </p>
    </div>
  );
}

function Avatar({ player, size = 36 }: { player: Player; size?: number }) {
  if (player.headshot_url) {
    return (
      <Image
        src={player.headshot_url}
        alt={player.display_name}
        width={size}
        height={size}
        className="shrink-0 rounded-md object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="bg-noir-900/60 text-or-400/70 font-display flex shrink-0 items-center justify-center rounded-md"
      style={{ width: size, height: size }}
    >
      {player.display_name.charAt(0).toUpperCase()}
    </div>
  );
}

export function BallotForm({
  editionId,
  players,
  questions,
}: {
  editionId: string;
  players: Player[];
  questions: Question[];
}) {
  const playerById = new Map(players.map((p) => [p.id, p]));
  const [rankings, setRankings] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      questions.filter((q) => q.format === "ranking").map((q) => [q.id, q.initialRanking]),
    ),
  );
  const [choices, setChoices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      questions.filter((q) => q.format === "single_choice").map((q) => [q.id, q.initialChoice]),
    ),
  );
  const [result, setResult] = useState<BallotResult>({ error: null });
  const [pending, startTransition] = useTransition();
  const [page, setPage] = useState(0); // 0 = intro, 1..N = questions, N+1 = review

  const total = questions.length;
  const reviewPage = total + 1;
  const q = page >= 1 && page <= total ? questions[page - 1] : null;
  const canAdvance = !q || q.format === "ranking" || Boolean(choices[q.id]);
  const progress = page / reviewPage;

  function answerSummary(question: Question): { text: string; missing: boolean } {
    if (question.format === "ranking") {
      const top = rankings[question.id]?.[0];
      return {
        text: top ? `${playerById.get(top)?.display_name ?? "—"} en tête` : "—",
        missing: false,
      };
    }
    const pick = choices[question.id];
    return pick
      ? { text: playerById.get(pick)?.display_name ?? "—", missing: false }
      : { text: "Pas encore répondu", missing: true };
  }

  function submit() {
    const missing = questions.find((qq) => qq.format === "single_choice" && !choices[qq.id]);
    if (missing) {
      setResult({ error: "Choisis un joueur pour chaque catégorie à choix unique." });
      return;
    }
    if (
      !window.confirm(
        "Ton vote est définitif : une fois envoyé, tu ne pourras plus rien modifier. Envoyer ?",
      )
    ) {
      return;
    }
    const answers = questions.map((qq) =>
      qq.format === "ranking"
        ? { questionId: qq.id, format: "ranking", ranking: rankings[qq.id] }
        : { questionId: qq.id, format: "single_choice", choice: choices[qq.id] || null },
    );
    startTransition(async () => setResult(await submitBallot(editionId, answers)));
  }

  return (
    <div className="flex min-h-[28rem] flex-col">
      <div className="brunos-fade flex-1" key={page}>
        {/* Intro */}
        {page === 0 && (
          <div className="flex flex-col items-center gap-5 py-8 text-center">
            <p className="text-or-400/80 font-sans text-xs tracking-[0.4em] uppercase">
              Bulletin de vote
            </p>
            <h2 className="text-ivoire font-display text-4xl font-semibold">À toi de juger.</h2>
            <p className="text-ivoire-muted max-w-md font-sans text-sm leading-relaxed">
              {total} catégorie{total > 1 ? "s" : ""}. Pour certaines tu <strong>classes</strong>{" "}
              les joueurs (glisse-dépose), pour d&apos;autres tu en <strong>choisis un</strong>.
              Prends ton temps — ton vote est <span className="text-or-300">définitif</span> une
              fois envoyé.
            </p>
            <button
              type="button"
              onClick={() => setPage(1)}
              className="from-or-300 to-or-600 text-noir-900 hover:from-or-400 hover:to-or-500 mt-2 rounded-full bg-gradient-to-b px-8 py-3 font-sans text-sm font-semibold shadow-lg transition"
            >
              Commencer →
            </button>
          </div>
        )}

        {/* One question per page */}
        {q && (
          <div className="border-or-400/15 bg-noir-700/40 flex flex-col gap-4 rounded-2xl border p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 font-sans text-[11px] tracking-wide uppercase ${
                  q.format === "ranking"
                    ? "bg-or-500/15 text-or-300"
                    : "bg-noir-900/60 text-ivoire-muted"
                }`}
              >
                {q.format === "ranking" ? "À classer" : "Choix unique"}
              </span>
              <span className="text-ivoire-faint font-sans text-xs">
                Question {page} / {total}
              </span>
            </div>
            <h3 className="text-ivoire font-display text-2xl leading-tight font-semibold">
              {q.prompt}
            </h3>
            <p className="text-ivoire-faint font-sans text-xs">
              {q.format === "ranking"
                ? "Glisse pour classer : en haut, celui ou celle qui correspond LE PLUS à l'énoncé ; en bas, le moins."
                : "Choisis la personne qui correspond le plus à l'énoncé."}
            </p>
            <StakeNotice rule={q.drinkRule} format={q.format} />
            {q.format === "ranking" ? (
              <RankingQuestion
                order={rankings[q.id] ?? []}
                playerById={playerById}
                onReorder={(ids) => setRankings((r) => ({ ...r, [q.id]: ids }))}
              />
            ) : (
              <ChoiceQuestion
                players={players}
                value={choices[q.id] ?? ""}
                onChange={(id) => setChoices((c) => ({ ...c, [q.id]: id }))}
              />
            )}
          </div>
        )}

        {/* Review + submit */}
        {page === reviewPage && (
          <div className="flex flex-col gap-4">
            <h2 className="text-ivoire font-display text-3xl font-semibold">Révision</h2>
            <p className="text-ivoire-muted font-sans text-sm">
              Vérifie tes réponses avant d&apos;envoyer.
            </p>
            <ul className="flex flex-col gap-2">
              {questions.map((question, i) => {
                const s = answerSummary(question);
                return (
                  <li
                    key={question.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                      s.missing
                        ? "border-red-400/30 bg-red-500/5"
                        : "border-or-400/12 bg-noir-700/40"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-ivoire font-sans text-sm">
                        {i + 1}. {question.prompt}
                      </span>
                      <span
                        className={`font-sans text-xs ${s.missing ? "text-red-300/90" : "text-or-300"}`}
                      >
                        {s.text}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPage(i + 1)}
                      className="text-ivoire-faint hover:text-or-300 shrink-0 font-sans text-xs transition"
                    >
                      Modifier
                    </button>
                  </li>
                );
              })}
            </ul>

            {result.error && <p className="font-sans text-sm text-red-300/90">{result.error}</p>}
            {result.saved && <p className="text-or-300 font-sans text-sm">Vote envoyé ✓</p>}

            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="from-or-300 to-or-600 text-noir-900 hover:from-or-400 hover:to-or-500 mt-2 w-full rounded-lg bg-gradient-to-b px-4 py-3 font-sans text-sm font-semibold shadow-lg transition disabled:opacity-60"
            >
              {pending ? "Envoi…" : "Envoyer mes réponses"}
            </button>
            <p className="text-ivoire-faint text-center font-sans text-xs">
              ⚠️ Définitif — tu ne pourras plus rien modifier après l&apos;envoi.
            </p>
          </div>
        )}
      </div>

      {/* Bottom nav + progress */}
      <div className="border-or-400/10 mt-6 flex flex-col gap-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-ivoire-muted hover:text-or-300 font-sans text-sm transition disabled:opacity-30"
          >
            ← Précédent
          </button>
          {page < reviewPage ? (
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(reviewPage, p + 1))}
              disabled={!canAdvance}
              className="text-or-300 hover:text-or-400 font-sans text-sm transition disabled:opacity-30"
            >
              {page === 0 ? "Commencer →" : page === total ? "Réviser →" : "Suivant →"}
            </button>
          ) : (
            <span className="text-ivoire-faint font-sans text-sm">Dernière étape</span>
          )}
        </div>
        <div className="bg-noir-900/60 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="from-or-300 to-or-600 h-full rounded-full bg-gradient-to-r transition-all duration-500"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function RankingQuestion({
  order,
  playerById,
  onReorder,
}: {
  order: string[];
  playerById: Map<string, Player>;
  onReorder: (ids: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(order, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-2">
          {order.map((id, i) => {
            const player = playerById.get(id);
            if (!player) return null;
            return <SortableRow key={id} id={id} rank={i + 1} player={player} />;
          })}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, rank, player }: { id: string; rank: number; player: Player }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="border-or-400/15 bg-noir-900/40 flex items-center gap-3 rounded-lg border px-3 py-2"
    >
      <button
        type="button"
        className="text-ivoire-faint hover:text-or-300 cursor-grab touch-none active:cursor-grabbing"
        aria-label="Déplacer"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <span className="text-or-300 font-display w-5 text-center text-lg">{rank}</span>
      <Avatar player={player} />
      <span className="text-ivoire font-sans text-sm">{player.display_name}</span>
    </li>
  );
}

function ChoiceQuestion({
  players,
  value,
  onChange,
}: {
  players: Player[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {players.map((p) => (
        <label
          key={p.id}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${
            value === p.id
              ? "border-or-400/60 bg-or-500/10"
              : "border-or-400/15 bg-noir-900/40 hover:border-or-400/30"
          }`}
        >
          <input
            type="radio"
            name={`choice-${p.id}-${value}`}
            checked={value === p.id}
            onChange={() => onChange(p.id)}
            className="accent-[var(--or-500)]"
          />
          <Avatar player={p} />
          <span className="text-ivoire font-sans text-sm">{p.display_name}</span>
        </label>
      ))}
    </div>
  );
}
