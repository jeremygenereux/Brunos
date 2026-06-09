"use client";

import { useEffect, useState, useTransition } from "react";
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
import { reorderQuestions, deleteQuestion } from "./actions";

type Question = { id: string; prompt: string; format: string };

const FORMAT_LABEL: Record<string, string> = {
  ranking: "Classement",
  single_choice: "Choix unique",
};

function FormatBadge({ format }: { format: string }) {
  return (
    <span className="border-or-400/30 text-or-300/90 shrink-0 rounded-full border px-2 py-0.5 font-sans text-[11px] tracking-wide">
      {FORMAT_LABEL[format] ?? format}
    </span>
  );
}

export function QuestionsManager({
  editionId,
  questions,
  editable,
}: {
  editionId: string;
  questions: Question[];
  editable: boolean;
}) {
  const [items, setItems] = useState<Question[]>(questions);
  const [, startTransition] = useTransition();

  // Re-sync when questions are added/removed on the server (ids change).
  const signature = questions.map((q) => q.id).join(",");
  useEffect(() => {
    setItems(questions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((q) => q.id === active.id);
    const newIndex = items.findIndex((q) => q.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    startTransition(async () => {
      await reorderQuestions(
        editionId,
        next.map((q) => q.id),
      );
    });
  }

  if (!editable) {
    return (
      <ol className="flex flex-col gap-2">
        {items.map((q, i) => (
          <li
            key={q.id}
            className="border-or-400/15 bg-noir-700/40 flex items-center gap-3 rounded-xl border px-4 py-3"
          >
            <span className="text-ivoire-faint w-5 text-right font-sans text-sm">{i + 1}</span>
            <FormatBadge format={q.format} />
            <span className="text-ivoire flex-1 font-sans text-sm">{q.prompt}</span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((q) => q.id)} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-2">
          {items.map((q, i) => (
            <SortableRow key={q.id} question={q} index={i} editionId={editionId} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  question,
  index,
  editionId,
}: {
  question: Question;
  index: number;
  editionId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
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
      className="border-or-400/15 bg-noir-700/40 flex items-center gap-3 rounded-xl border px-4 py-3"
    >
      <button
        type="button"
        className="text-ivoire-faint hover:text-or-300 cursor-grab touch-none px-1 active:cursor-grabbing"
        aria-label="Déplacer"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <span className="text-ivoire-faint w-5 text-right font-sans text-sm">{index + 1}</span>
      <FormatBadge format={question.format} />
      <span className="text-ivoire flex-1 font-sans text-sm">{question.prompt}</span>
      <form
        action={deleteQuestion}
        onSubmit={(e) => {
          if (!window.confirm("Supprimer cette question ?")) e.preventDefault();
        }}
      >
        <input type="hidden" name="question_id" value={question.id} />
        <input type="hidden" name="edition_id" value={editionId} />
        <button
          type="submit"
          className="text-ivoire-faint font-sans text-xs transition hover:text-red-300"
        >
          Supprimer
        </button>
      </form>
    </li>
  );
}
