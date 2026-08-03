"use client";

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
import { reorderQuestions, deleteQuestion, setQuestionRule } from "./actions";
import { DRINK_RULE_LABEL, type DrinkRule } from "@/lib/editions/drink-rule";

type Rule = DrinkRule;
type Question = { id: string; prompt: string; format: string; drink_rule_override: Rule | null };

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

function RuleControl({
  questionId,
  editionId,
  value,
}: {
  questionId: string;
  editionId: string;
  value: Rule;
}) {
  const [rule, setRule] = useState<Rule>(value);
  const [pending, start] = useTransition();
  function change(next: Rule) {
    const prev = rule;
    setRule(next);
    start(async () => {
      const r = await setQuestionRule(questionId, editionId, next);
      if (r.error) setRule(prev);
    });
  }
  return (
    <select
      value={rule}
      disabled={pending}
      onChange={(e) => change(e.target.value as Rule)}
      onPointerDown={(e) => e.stopPropagation()}
      className="border-or-400/20 bg-noir-900/60 text-ivoire focus:border-or-400/60 shrink-0 rounded-lg border px-2 py-1 font-sans text-xs outline-none disabled:opacity-60"
    >
      <option value="ESCALATION">{DRINK_RULE_LABEL.ESCALATION}</option>
      <option value="TOP_UNIQUE">{DRINK_RULE_LABEL.TOP_UNIQUE}</option>
    </select>
  );
}

export function QuestionsManager({
  editionId,
  questions,
  editable,
  editionRule,
}: {
  editionId: string;
  questions: Question[];
  editable: boolean;
  editionRule: Rule;
}) {
  // Seeded from props. The parent keys this component on the SET of question
  // ids, so it remounts (fresh state) when questions are added/removed, while
  // a reorder (same id set) keeps the optimistic local order.
  const [items, setItems] = useState<Question[]>(questions);
  const [, startTransition] = useTransition();

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
            <span className="text-or-300/70 shrink-0 font-sans text-xs">
              {DRINK_RULE_LABEL[q.drink_rule_override ?? editionRule]}
            </span>
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
            <SortableRow
              key={q.id}
              question={q}
              index={i}
              editionId={editionId}
              editionRule={editionRule}
            />
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
  editionRule,
}: {
  question: Question;
  index: number;
  editionId: string;
  editionRule: Rule;
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
      <RuleControl
        questionId={question.id}
        editionId={editionId}
        value={(question.drink_rule_override ?? editionRule) as Rule}
      />
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
