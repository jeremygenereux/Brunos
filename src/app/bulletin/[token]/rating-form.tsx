"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import {
  CascadeGlyph,
  DuoGlyph,
  GaugeGlyph,
  SealGlyph,
  ShooterGlyph,
} from "@/components/party-glyphs";
import { saveRatings, submitRatings, type RatingMap, type RatingResult } from "./actions";

export type EntourageQuestion = { id: string; prompt: string; rating: number | null };

const SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * L'échelle. Dix cases plutôt qu'un curseur : sur un téléphone, un curseur se
 * règle mal du pouce et n'affiche pas ce qu'on vient de choisir. Les cases
 * donnent une valeur exacte et un retour immédiat.
 */
function Scale({
  value,
  onChange,
  disabled,
  labelledBy,
}: {
  value: number | null;
  onChange: (v: number) => void;
  disabled: boolean;
  labelledBy: string;
}) {
  return (
    <div>
      <div className="grid grid-cols-10 gap-1" role="radiogroup" aria-labelledby={labelledBy}>
        {SCALE.map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${n} sur 10`}
              disabled={disabled}
              onClick={() => onChange(n)}
              className={`aspect-square rounded-lg border font-sans text-xs font-semibold transition sm:text-base ${
                active
                  ? "border-or-400 from-or-300 to-or-600 text-noir-900 bg-gradient-to-b shadow"
                  : "border-or-400/20 bg-noir-700/40 text-ivoire-muted hover:border-or-400/50 hover:text-ivoire"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="text-ivoire-faint mt-2 flex justify-between font-sans text-xs">
        <span>Pas du tout lui</span>
        <span>Tout à fait lui</span>
      </div>
    </div>
  );
}

/** Une étape d'explication : un pictogramme, un titre, deux phrases. */
function Card({
  glyph,
  title,
  children,
}: {
  glyph: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-or-400/15 bg-noir-700/30 flex flex-col items-center gap-4 rounded-3xl border px-6 py-9 text-center">
      <span className="text-or-400/70">{glyph}</span>
      <h2 className="text-ivoire font-display text-2xl font-semibold">{title}</h2>
      <div className="text-ivoire-muted flex flex-col gap-3 font-sans text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export function RatingForm({
  token,
  playerName,
  playerHeadshot,
  relation,
  eventDate,
  questions,
  submittedAt,
  open,
}: {
  token: string;
  playerName: string;
  playerHeadshot: string | null;
  relation: string;
  eventDate: string | null;
  questions: EntourageQuestion[];
  submittedAt: string | null;
  open: boolean;
}) {
  const [ratings, setRatings] = useState<RatingMap>(() =>
    Object.fromEntries(questions.map((q) => [q.id, q.rating])),
  );
  const [result, setResult] = useState<RatingResult>({ error: null });
  const [pending, startTransition] = useTransition();
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved">("idle");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [sent, setSent] = useState(Boolean(submittedAt));

  // Pages 0..2 = mise en contexte, 3..N+2 = les questions, N+3 = relecture.
  const INTRO_PAGES = 3;
  const total = questions.length;
  const reviewPage = INTRO_PAGES + total;
  const [page, setPage] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  const locked = sent || !open;
  const q = page >= INTRO_PAGES && page < reviewPage ? questions[page - INTRO_PAGES] : null;

  // Brouillon temporisé, sur le modèle du bulletin des joueurs : on n'écrit pas
  // à chaque case cliquée, et on saute le premier rendu pour ne pas réécrire
  // aussitôt ce qu'on vient de lire. Un échec n'est jamais avalé : croire son
  // brouillon enregistré alors qu'il ne l'est pas est pire que pas de brouillon.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (locked) return;
    const id = window.setTimeout(async () => {
      const r = await saveRatings(token, ratings);
      setDraftError(r.error);
      setDraftState(r.error ? "idle" : "saved");
    }, 1200);
    return () => window.clearTimeout(id);
  }, [ratings, token, locked]);

  /** Le passage à « enregistrement » appartient au clic, pas à l'effet. */
  function rate(questionId: string, value: number) {
    setDraftState("saving");
    setRatings((prev) => ({ ...prev, [questionId]: value }));
  }

  function go(next: number) {
    setPage(next);
    topRef.current?.scrollIntoView({ block: "start" });
  }

  const answered = questions.filter((x) => typeof ratings[x.id] === "number").length;
  const complete = answered === total && total > 0;
  const canAdvance = !q || typeof ratings[q.id] === "number";

  function send() {
    startTransition(async () => {
      const r = await submitRatings(token, ratings);
      setResult(r);
      if (!r.error) setSent(true);
    });
  }

  if (sent) {
    return (
      <Card glyph={<SealGlyph />} title="C'est envoyé. Merci.">
        <p>
          Vos réponses sont scellées et ne peuvent plus être modifiées. {playerName} découvrira le
          verdict sur grand écran, sans savoir qui a dit quoi.
        </p>
      </Card>
    );
  }

  return (
    <div ref={topRef} className="flex flex-col gap-6">
      {/* Une barre plutôt qu'un « 3 / 7 » : le proche n'a aucune idée de la
          longueur du questionnaire en arrivant, et un chiffre nu inquiète. */}
      <div className="bg-noir-700/60 h-1 w-full overflow-hidden rounded-full">
        <div
          className="from-or-300 to-or-600 h-full bg-gradient-to-r transition-all duration-500"
          style={{ width: `${Math.round((page / reviewPage) * 100)}%` }}
        />
      </div>

      {page === 0 && (
        <Card glyph={<DuoGlyph />} title={`Vous connaissez ${playerName.split(" ")[0]}`}>
          <p>
            {eventDate ? `Le ${eventDate}` : "Le soir de la cérémonie"}, il sera jugé par ses amis
            dans une série de catégories. Eux votent entre eux. Vous, vous le connaissez autrement,
            et certaines catégories ne sont posées qu&apos;aux proches.
          </p>
          <p className="text-ivoire">Vous répondez en tant que {relation.toLowerCase()}.</p>
        </Card>
      )}

      {page === 1 && (
        <Card glyph={<GaugeGlyph />} title="Une note, pas un classement">
          <p>
            Vous n&apos;avez personne à classer. Pour chaque énoncé, dites simplement à quel point
            ça lui ressemble.
          </p>
          <p className="text-ivoire">
            1 si ce n&apos;est pas lui du tout. 10 si c&apos;est tout lui.
          </p>
          <p className="text-ivoire-faint text-xs">
            Il y a {total} énoncé{total > 1 ? "s" : ""}. Comptez deux minutes.
          </p>
        </Card>
      )}

      {page === 2 && (
        <Card glyph={<ShooterGlyph />} title="Ce que ça lui coûte">
          <p>
            Chaque nommé reçoit les notes de ses propres proches. On en fait la moyenne, on compare,
            et on classe.
          </p>
          <p className="text-ivoire">
            La moyenne la plus haute cale un shooter devant tout le monde. Les suivants s&apos;en
            tirent avec des gorgées, de moins en moins jusqu&apos;au dernier.
          </p>
          <div className="text-or-400/60 flex justify-center pt-1">
            <CascadeGlyph />
          </div>
          <p className="text-ivoire-faint text-xs">
            Personne ne verra votre note. Seule la moyenne est dévoilée. À vous de voir si vous le
            défendez ou si vous le livrez.
          </p>
        </Card>
      )}

      {q && (
        <div className="border-or-400/15 bg-noir-700/30 rounded-3xl border px-5 py-6 sm:px-7">
          <div className="mb-5 flex items-center gap-3">
            <Avatar name={playerName} headshot={playerHeadshot} size={40} />
            <div className="flex flex-col">
              <span className="text-or-400/70 font-sans text-xs tracking-[0.25em] uppercase">
                Énoncé {page - INTRO_PAGES + 1} sur {total}
              </span>
              <span className="text-ivoire-muted font-sans text-sm">{playerName}</span>
            </div>
          </div>
          <p
            id={`q-${q.id}`}
            className="text-ivoire font-display mb-6 text-2xl leading-snug font-semibold"
          >
            {q.prompt}
          </p>
          <Scale
            labelledBy={`q-${q.id}`}
            value={typeof ratings[q.id] === "number" ? (ratings[q.id] as number) : null}
            disabled={locked || pending}
            onChange={(v) => rate(q.id, v)}
          />
        </div>
      )}

      {page === reviewPage && (
        <div className="flex flex-col gap-4">
          <Card glyph={<SealGlyph />} title="Relisez-vous">
            <p>
              Une fois envoyé, plus rien ne se modifie. Touchez une ligne pour revenir dessus.
            </p>
          </Card>
          <ul className="flex flex-col gap-2">
            {questions.map((x, i) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => go(INTRO_PAGES + i)}
                  className="border-or-400/12 bg-noir-700/40 hover:border-or-400/40 flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition"
                >
                  <span className="text-ivoire-muted flex-1 font-sans text-sm">{x.prompt}</span>
                  <span
                    className={`font-display shrink-0 text-lg font-semibold ${
                      typeof ratings[x.id] === "number" ? "text-or-300" : "text-red-300/80"
                    }`}
                  >
                    {typeof ratings[x.id] === "number" ? `${ratings[x.id]}/10` : "à noter"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigation. Collée en bas : sur un téléphone, la question longue
          pousserait autrement le bouton hors de l'écran. */}
      <div className="border-or-400/15 bg-noir-800/80 sticky bottom-0 -mx-6 mt-2 border-t px-6 py-4 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:bg-transparent sm:px-5 sm:backdrop-blur-none">
        <div className="flex items-center gap-3">
          {page > 0 && (
            <button
              type="button"
              onClick={() => go(page - 1)}
              className="text-ivoire-muted hover:text-ivoire font-sans text-sm transition"
            >
              Retour
            </button>
          )}
          <span className="flex-1" />
          {page < reviewPage ? (
            <button
              type="button"
              disabled={!canAdvance}
              onClick={() => go(page + 1)}
              className="from-or-300 to-or-600 text-noir-900 hover:from-or-400 hover:to-or-500 rounded-full bg-gradient-to-b px-6 py-2.5 font-sans text-sm font-semibold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {page < INTRO_PAGES ? "Continuer" : "Suivant"}
            </button>
          ) : (
            <button
              type="button"
              disabled={!complete || pending || locked}
              onClick={send}
              className="from-or-300 to-or-600 text-noir-900 hover:from-or-400 hover:to-or-500 rounded-full bg-gradient-to-b px-6 py-2.5 font-sans text-sm font-semibold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Envoi" : "Envoyer définitivement"}
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between font-sans text-xs">
          <span className="text-ivoire-faint">
            {page >= INTRO_PAGES ? `${answered} / ${total} noté${answered > 1 ? "s" : ""}` : ""}
            {draftState === "saving" && " · enregistrement"}
            {draftState === "saved" && " · enregistré"}
          </span>
          {page === reviewPage && !complete && (
            <span className="text-red-300/80">Il reste des énoncés sans note.</span>
          )}
        </div>
        {draftError && <p className="mt-1 font-sans text-xs text-red-300/90">{draftError}</p>}
        {result.error && <p className="mt-1 font-sans text-sm text-red-300/90">{result.error}</p>}
      </div>
    </div>
  );
}
