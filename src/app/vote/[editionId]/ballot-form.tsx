"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
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
import { saveDraft, submitBallot, type BallotResult } from "./actions";
import type { DrinkRule } from "@/lib/editions/drink-rule";

type Player = { id: string; display_name: string; headshot_url: string | null };
type Question = {
  id: string;
  prompt: string;
  format: string;
  drinkRule: DrinkRule;
  initialRanking: string[];
  initialChoice: string;
};

function Avatar({
  player,
  size = 36,
  rounded = false,
}: {
  player: Player;
  size?: number;
  rounded?: boolean;
}) {
  const shape = rounded ? "rounded-full border border-or-400/30" : "rounded-md";
  if (player.headshot_url) {
    return (
      <Image
        src={player.headshot_url}
        alt={player.display_name}
        width={size}
        height={size}
        className={`shrink-0 object-cover ${shape}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`bg-noir-900/60 text-or-400/70 font-display flex shrink-0 items-center justify-center ${shape}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {player.display_name.charAt(0).toUpperCase()}
    </div>
  );
}


/* ── Écran d'ouverture ────────────────────────────────────────────────
   Deux pictogrammes valent mieux qu'un paragraphe : le votant doit saisir
   d'un coup d'œil ce qu'on attend de lui, et où tombe la charge. Les glyphes
   reprennent la géométrie réelle des deux écrans de vote (une pile ordonnée,
   une désignation parmi un rang), pour que la promesse tienne. */

/** Pile ordonnée, la barre la plus basse marquée d'un jeton. */
function RankingGlyph() {
  return (
    <svg viewBox="0 0 64 48" className="h-12 w-16" fill="none" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x="6"
          y={6 + i * 14}
          width={44 - i * 6}
          height="8"
          rx="4"
          fill="currentColor"
          opacity={0.9 - i * 0.25}
        />
      ))}
      <circle cx="56" cy="40" r="5" fill="var(--or-300)" />
    </svg>
  );
}

/** Un rang de jetons, un seul cerclé d'or. */
function ChoiceGlyph() {
  return (
    <svg viewBox="0 0 64 48" className="h-12 w-16" fill="none" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={10 + i * 15} cy="24" r="5" fill="currentColor" opacity={0.35} />
      ))}
      <circle cx="25" cy="24" r="5" fill="var(--or-300)" />
      <circle cx="25" cy="24" r="10" stroke="var(--or-400)" strokeWidth="1.5" opacity="0.8" />
    </svg>
  );
}

function ModeCard({
  glyph,
  title,
  count,
  children,
}: {
  glyph: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="border-or-400/15 bg-noir-900/40 flex flex-1 flex-col items-center gap-3 rounded-2xl border px-5 py-6 text-center">
      <span className="text-or-400/70">{glyph}</span>
      <div className="flex flex-col gap-0.5">
        <span className="text-ivoire font-display text-lg font-semibold">{title}</span>
        <span className="text-or-300 font-sans text-xs tabular-nums">
          {count} catégorie{count > 1 ? "s" : ""}
        </span>
      </div>
      <p className="text-ivoire-muted font-sans text-xs leading-relaxed">{children}</p>
    </div>
  );
}

/** Les nommés de la cérémonie, en suspension. */
function PlayerGallery({ players }: { players: Player[] }) {
  if (players.length === 0) return null;
  return (
    <div className="flex flex-col items-center gap-4">
      <span className="text-or-400/70 font-sans text-[11px] tracking-[0.35em] uppercase">
        Les nommés
      </span>
      <ul className="flex flex-wrap items-start justify-center gap-x-6 gap-y-5">
        {players.map((p, i) => (
          <li key={p.id} className="flex w-20 flex-col items-center gap-2">
            <span
              className="brunos-float block"
              style={{
                animationDelay: `${(i % 6) * 0.7}s`,
                animationDuration: `${6 + (i % 3)}s`,
                // Halo porté par le portrait : `brunos-aura` s'appuie sur un
                // ::before en z-index négatif, prévu pour un fond nu, qui
                // passerait derrière la carte ici.
                filter: "drop-shadow(0 0 14px color-mix(in oklab, var(--or-400) 30%, transparent))",
              }}
            >
              <Avatar player={p} size={64} rounded />
            </span>
            <span className="text-ivoire-muted text-center font-sans text-[11px] leading-tight">
              {p.display_name}
            </span>
          </li>
        ))}
      </ul>
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
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved">("idle");
  const [draftError, setDraftError] = useState<string | null>(null);

  // ── Brouillon ────────────────────────────────────────────────────────
  // Le bulletin est enregistré sans être rendu (`submitted_at` reste nul), ce
  // qui permet de quitter et de revenir. On temporise pour ne pas écrire à
  // chaque pixel de glisser-déposer, et on saute le tout premier rendu :
  // sinon on réécrirait le brouillon avec ce qu'on vient tout juste de lire.
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setDraftState("saving");
    const id = window.setTimeout(async () => {
      const answers = questions.map((qq) =>
        qq.format === "ranking"
          ? { questionId: qq.id, format: "ranking", ranking: rankings[qq.id] }
          : { questionId: qq.id, format: "single_choice", choice: choices[qq.id] || null },
      );
      const r = await saveDraft(editionId, answers);
      // Ne JAMAIS avaler l'échec : un brouillon qu'on croit enregistré alors
      // qu'il ne l'est pas, c'est pire que pas de brouillon du tout.
      setDraftError(r.error);
      setDraftState(r.error ? "idle" : "saved");
    }, 1200);
    return () => window.clearTimeout(id);
  }, [rankings, choices, editionId, questions]);

  const total = questions.length;
  const rankingCount = questions.filter((qq) => qq.format === "ranking").length;
  const choiceCount = total - rankingCount;
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
      : { text: "Sans réponse", missing: true };
  }

  function submit() {
    const missing = questions.find((qq) => qq.format === "single_choice" && !choices[qq.id]);
    if (missing) {
      setResult({ error: "Une catégorie à désignation unique demeure sans réponse." });
      return;
    }
    if (
      !window.confirm(
        "Votre bulletin sera déposé de façon irrévocable. Confirmez-vous ?",
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
          <div className="flex flex-col items-center gap-8 py-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <p className="text-or-400/80 font-sans text-xs tracking-[0.4em] uppercase">
                Bulletin de vote
              </p>
              <h2 className="text-ivoire font-display text-4xl font-semibold">
                Le scrutin est ouvert.
              </h2>
              <p className="text-ivoire-muted max-w-md font-sans text-sm leading-relaxed">
                {total} catégorie{total > 1 ? "s" : ""} vous {total > 1 ? "sont" : "est"} soumise
                {total > 1 ? "s" : ""}. Votre bulletin est conservé à mesure que vous progressez ; il
                ne devient <span className="text-or-300">définitif </span> qu&apos;au dépôt.
              </p>
            </div>

            <PlayerGallery players={players} />

            <div className="flex w-full flex-col gap-3 sm:flex-row">
              <ModeCard glyph={<RankingGlyph />} title="Classement" count={rankingCount}>
                Vous ordonnez l&apos;ensemble des nommés, du plus concerné au moins concerné. La
                charge revient à une position précise du classement final, signalée par un shooter.
              </ModeCard>
              <ModeCard glyph={<ChoiceGlyph />} title="Désignation" count={choiceCount}>
                Vous désignez une seule personne. La charge revient à celle que le suffrage place en
                tête, ou en queue, selon le règlement de la catégorie.
              </ModeCard>
            </div>

            <button
              type="button"
              onClick={() => setPage(1)}
              className="from-or-300 to-or-600 text-noir-900 hover:from-or-400 hover:to-or-500 rounded-full bg-gradient-to-b px-8 py-3 font-sans text-sm font-semibold shadow-lg transition"
            >
              Ouvrir le bulletin →
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
                Catégorie {page} sur {total}
              </span>
              {draftError ? (
                <span className="ml-auto font-sans text-[11px] text-red-300/90">
                  Bulletin non conservé : {draftError}
                </span>
              ) : (
                <span className="text-ivoire-faint ml-auto font-sans text-[11px]">
                  {draftState === "saving"
                    ? "Conservation…"
                    : draftState === "saved"
                      ? "Bulletin conservé"
                      : ""}
                </span>
              )}
            </div>
            <h3 className="text-ivoire font-display text-2xl leading-tight font-semibold">
              {q.prompt}
            </h3>
            <p className="text-ivoire-muted font-sans text-xs leading-relaxed">
              {q.format === "ranking" ? (
                <>
                  Du plus concerné en haut au moins concerné en bas. Le 🥃 signale la position
                  qui devra s&apos;acquitter d&apos;un shooter au dépouillement.
                </>
              ) : (
                "Désignez la personne qui correspond le plus à l&apos;énoncé."
              )}
            </p>
            {q.format === "ranking" ? (
              <RankingQuestion
                order={rankings[q.id] ?? []}
                playerById={playerById}
                drinkRule={q.drinkRule}
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
            <h2 className="text-ivoire font-display text-3xl font-semibold">Récapitulatif</h2>
            <p className="text-ivoire-muted font-sans text-sm">
              Relisez votre bulletin. Le dépôt est irrévocable.
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
              Le dépôt est irrévocable. Aucune modification ne sera possible par la suite.
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
  drinkRule,
  onReorder,
}: {
  order: string[];
  playerById: Map<string, Player>;
  drinkRule: DrinkRule;
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
            // Le shooter va au 1er en « Gagnant boit », au dernier sinon.
            const drinks =
              drinkRule === "TOP_UNIQUE" ? i === 0 : i === order.length - 1;
            return (
              <SortableRow key={id} id={id} rank={i + 1} player={player} drinks={drinks} />
            );
          })}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  rank,
  player,
  drinks,
}: {
  id: string;
  rank: number;
  player: Player;
  drinks: boolean;
}) {
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
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
        drinks ? "border-or-400/50 bg-or-500/10" : "border-or-400/15 bg-noir-900/40"
      }`}
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
      <span className="text-ivoire flex-1 font-sans text-sm">{player.display_name}</span>
      {drinks && (
        <span className="text-base" title="Cette place cale le shooter">
          🥃
        </span>
      )}
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
