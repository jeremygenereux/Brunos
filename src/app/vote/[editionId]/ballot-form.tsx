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
import { saveBallot, type BallotResult } from "./actions";

type Player = { id: string; display_name: string; headshot_url: string | null };
type Question = {
  id: string;
  prompt: string;
  format: string;
  initialRanking: string[];
  initialChoice: string;
};

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

  function save() {
    const answers = questions.map((q) =>
      q.format === "ranking"
        ? { questionId: q.id, format: "ranking", ranking: rankings[q.id] }
        : { questionId: q.id, format: "single_choice", choice: choices[q.id] || null },
    );
    startTransition(async () => setResult(await saveBallot(editionId, answers)));
  }

  return (
    <div className="flex flex-col gap-8">
      {questions.map((q, i) => (
        <div key={q.id} className="border-or-400/15 bg-noir-700/40 rounded-2xl border p-5">
          <h3 className="text-ivoire font-display mb-1 text-xl">
            <span className="text-or-400/70">{i + 1}.</span> {q.prompt}
          </h3>
          <p className="text-ivoire-faint mb-4 font-sans text-xs">
            {q.format === "ranking"
              ? "Classe du plus (en haut) au moins probable."
              : "Choisis un joueur."}
          </p>
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
      ))}

      {result.error && <p className="font-sans text-sm text-red-300/90">{result.error}</p>}
      {result.saved && <p className="text-or-300 font-sans text-sm">Votes enregistrés ✓</p>}

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="from-or-300 to-or-600 text-noir-900 hover:from-or-400 hover:to-or-500 w-full rounded-lg bg-gradient-to-b px-4 py-3 font-sans text-sm font-semibold shadow-lg transition disabled:opacity-60"
      >
        {pending ? "Enregistrement…" : "Enregistrer mes votes"}
      </button>
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
