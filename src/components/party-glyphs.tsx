// Pictogrammes du bulletin des proches.
//
// Le proche n'a jamais vu l'application, ne connaît pas les six gars et ne
// sait pas ce qu'est un Bruno. Le texte seul le laisserait à distance ; ces
// figures disent en un coup d'œil de quoi il retourne : une personne à juger,
// une échelle à régler, un verre à payer.
//
// Volontairement dessinées à la main plutôt qu'empruntées à une police
// d'icônes : rien à charger, rien à mettre à jour, et le trait s'accorde à
// l'or de la cérémonie.

const BOX = "h-16 w-20 sm:h-20 sm:w-24";

/** Deux silhouettes côte à côte : vous, et la personne que vous connaissez. */
export function DuoGlyph() {
  return (
    <svg viewBox="0 0 96 64" className={BOX} fill="none" aria-hidden="true">
      <circle cx="32" cy="20" r="9" fill="currentColor" opacity={0.35} />
      <path d="M16 52c0-9 7-15 16-15s16 6 16 15" fill="currentColor" opacity={0.35} />
      <circle cx="64" cy="18" r="11" fill="var(--or-300)" />
      <path d="M46 54c0-11 8-18 18-18s18 7 18 18" fill="var(--or-400)" opacity={0.9} />
    </svg>
  );
}

/** Une jauge réglée aux deux tiers : une note, pas un rang. */
export function GaugeGlyph() {
  return (
    <svg viewBox="0 0 96 64" className={BOX} fill="none" aria-hidden="true">
      <rect x="8" y="26" width="80" height="12" rx="6" fill="currentColor" opacity={0.25} />
      <rect x="8" y="26" width="56" height="12" rx="6" fill="var(--or-400)" opacity={0.85} />
      <circle cx="64" cy="32" r="10" fill="var(--or-300)" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <rect key={i} x={9 + i * 8.2} y="46" width="2" height="6" rx="1" fill="currentColor" opacity={0.4} />
      ))}
    </svg>
  );
}

/** Un shooter plein, cerclé d'or : la sanction du premier. */
export function ShooterGlyph() {
  return (
    <svg viewBox="0 0 96 64" className={BOX} fill="none" aria-hidden="true">
      <path d="M36 14h24l-3 30a9 9 0 0 1-18 0z" fill="currentColor" opacity={0.2} />
      <path d="M37.6 30h20.8l-1.4 14a9 9 0 0 1-18 0z" fill="var(--or-400)" />
      <path
        d="M36 14h24l-3 30a9 9 0 0 1-18 0z"
        stroke="var(--or-300)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect x="30" y="54" width="36" height="3" rx="1.5" fill="var(--or-300)" opacity={0.6} />
      <path d="M70 18l3 5 5 2-5 2-3 5-3-5-5-2 5-2z" fill="var(--or-300)" opacity={0.7} />
    </svg>
  );
}

/** Des verres décroissants : la charge tombe de haut en bas du classement. */
export function CascadeGlyph() {
  return (
    <svg viewBox="0 0 96 64" className={BOX} fill="none" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => {
        const h = 34 - i * 7;
        return (
          <g key={i}>
            <rect
              x={8 + i * 22}
              y={52 - h}
              width="14"
              height={h}
              rx="3"
              fill="currentColor"
              opacity={0.2}
            />
            <rect
              x={8 + i * 22}
              y={52 - h}
              width="14"
              height={h}
              rx="3"
              fill={i === 0 ? "var(--or-400)" : "var(--or-400)"}
              opacity={0.9 - i * 0.22}
            />
          </g>
        );
      })}
      <circle cx="15" cy="10" r="4" fill="var(--or-300)" />
    </svg>
  );
}

/** Une enveloppe scellée : le vote part et ne revient pas. */
export function SealGlyph() {
  return (
    <svg viewBox="0 0 96 64" className={BOX} fill="none" aria-hidden="true">
      <rect
        x="20"
        y="14"
        width="56"
        height="38"
        rx="5"
        fill="currentColor"
        opacity={0.2}
        stroke="var(--or-400)"
        strokeWidth="2"
      />
      <path d="M20 20l28 18 28-18" stroke="var(--or-300)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="70" cy="46" r="10" fill="var(--or-300)" />
      <path
        d="M65.5 46l3 3 6-6"
        stroke="var(--noir-900, #0a0a0b)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
