// Les façons de voter, dites en pictogrammes.
//
// Partagé par l'intro du bulletin et le règlement de la présentation : c'est
// le même langage visuel des deux côtés, pour que l'assemblée reconnaisse en
// séance ce qu'elle a déjà vu en votant.
//
// Deux échelles, parce que les deux écrans n'ont rien à voir : « bulletin »
// se lit à trente centimètres sur un téléphone, « scène » se lit à cinq mètres
// depuis le fond de la pièce.

type Scale = "ballot" | "stage";

const GLYPH: Record<Scale, string> = {
  ballot: "h-12 w-16",
  stage: "h-20 w-28",
};

const CARD: Record<Scale, string> = {
  ballot: "gap-3 rounded-2xl px-5 py-6",
  stage: "gap-5 rounded-3xl px-8 py-10",
};

const TITLE: Record<Scale, string> = {
  ballot: "text-lg",
  stage: "text-3xl sm:text-4xl",
};

const SUBTITLE: Record<Scale, string> = {
  ballot: "text-xs",
  stage: "text-sm tracking-[0.2em] uppercase",
};

const BODY: Record<Scale, string> = {
  ballot: "gap-2 text-xs leading-relaxed",
  stage: "gap-4 text-lg leading-relaxed sm:text-xl",
};

/** Des barres décroissantes : un ordre, du premier au dernier. */
export function RankingGlyph({ scale = "ballot" }: { scale?: Scale }) {
  return (
    <svg viewBox="0 0 64 48" className={GLYPH[scale]} fill="none" aria-hidden="true">
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
export function ChoiceGlyph({ scale = "ballot" }: { scale?: Scale }) {
  return (
    <svg viewBox="0 0 64 48" className={GLYPH[scale]} fill="none" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx={10 + i * 15} cy="24" r="5" fill="currentColor" opacity={0.35} />
      ))}
      <circle cx="25" cy="24" r="5" fill="var(--or-300)" />
      <circle cx="25" cy="24" r="10" stroke="var(--or-400)" strokeWidth="1.5" opacity="0.8" />
    </svg>
  );
}

/** Une jauge remplie aux deux tiers : une note, pas un rang. */
export function RatingGlyph({ scale = "ballot" }: { scale?: Scale }) {
  return (
    <svg viewBox="0 0 64 48" className={GLYPH[scale]} fill="none" aria-hidden="true">
      <rect x="6" y="20" width="52" height="9" rx="4.5" fill="currentColor" opacity={0.25} />
      <rect x="6" y="20" width="36" height="9" rx="4.5" fill="var(--or-400)" opacity={0.85} />
      <circle cx="42" cy="24.5" r="7" fill="var(--or-300)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={9 + i * 12} y="35" width="2" height="5" rx="1" fill="currentColor" opacity={0.4} />
      ))}
    </svg>
  );
}

/* ── Pastille de format ────────────────────────────────────────────────────
   Dit d'un coup d'œil de quel type est la catégorie qu'on s'apprête à
   dévoiler. En salle, ça évite d'avoir à redemander « attends, celle-là
   c'est nous ou c'est les blondes ? » au moment du verdict.               */

export type QuestionFormatValue = "ranking" | "single_choice" | "entourage";

const FORMAT_LABEL: Record<QuestionFormatValue, string> = {
  ranking: "Classement",
  single_choice: "Choix unique",
  entourage: "Entourage",
};

/** Version minuscule des pictogrammes, pour tenir dans une pastille. */
function MiniGlyph({ format }: { format: QuestionFormatValue }) {
  if (format === "ranking") {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x="1"
            y={2 + i * 5}
            width={12 - i * 3}
            height="3"
            rx="1.5"
            fill="currentColor"
            opacity={1 - i * 0.25}
          />
        ))}
      </svg>
    );
  }
  if (format === "entourage") {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
        <rect x="1" y="6" width="14" height="4" rx="2" fill="currentColor" opacity={0.35} />
        <rect x="1" y="6" width="9" height="4" rx="2" fill="currentColor" />
        <circle cx="10" cy="8" r="3" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={3 + i * 5} cy="8" r="2" fill="currentColor" opacity={0.35} />
      ))}
      <circle cx="8" cy="8" r="2.4" fill="currentColor" />
      <circle cx="8" cy="8" r="4.6" stroke="currentColor" strokeWidth="1" opacity={0.7} />
    </svg>
  );
}

export function FormatBadge({
  format,
  size = "sm",
}: {
  format: string;
  size?: "sm" | "lg";
}) {
  const kind: QuestionFormatValue =
    format === "ranking" ? "ranking" : format === "entourage" ? "entourage" : "single_choice";
  const dense = size === "sm";
  return (
    <span
      className={`border-or-400/30 bg-or-500/10 text-or-300 inline-flex shrink-0 items-center gap-1.5 rounded-full border font-sans tracking-[0.15em] uppercase ${
        dense ? "px-2.5 py-1 text-[0.65rem]" : "px-4 py-1.5 text-sm tracking-[0.25em]"
      }`}
    >
      <MiniGlyph format={kind} />
      {FORMAT_LABEL[kind]}
    </span>
  );
}

export function ModeCard({
  glyph,
  title,
  subtitle,
  scale = "ballot",
  children,
}: {
  glyph: React.ReactNode;
  title: string;
  /** Repère chiffré facultatif — « 12 catégories ». */
  subtitle?: string;
  scale?: Scale;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`border-or-400/15 bg-noir-900/40 flex flex-1 flex-col items-center border text-center ${CARD[scale]}`}
    >
      <span className="text-or-400/70">{glyph}</span>
      <div className="flex flex-col gap-1">
        <span className={`text-ivoire font-display font-semibold ${TITLE[scale]}`}>{title}</span>
        {subtitle && (
          <span className={`text-or-300 font-sans tabular-nums ${SUBTITLE[scale]}`}>{subtitle}</span>
        )}
      </div>
      <div className={`text-ivoire-muted flex flex-col font-sans ${BODY[scale]}`}>{children}</div>
    </div>
  );
}
