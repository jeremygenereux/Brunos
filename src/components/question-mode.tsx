// Les deux façons de voter, dites en pictogrammes.
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
  stage: "text-base tracking-[0.2em] uppercase",
};

const BODY: Record<Scale, string> = {
  ballot: "gap-2 text-xs leading-relaxed",
  // Le règlement est dense et se lit d'un bout à l'autre de la pièce : c'est
  // le texte le plus long de la soirée, donc celui qui pardonne le moins une
  // taille trop juste.
  stage: "gap-4 text-xl leading-relaxed sm:text-2xl",
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
