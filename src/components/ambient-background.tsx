// Global ambient backdrop: slowly drifting golden orbs + rising champagne
// particles + faint grain. Pure CSS (keyframes in globals.css), no deps,
// honours prefers-reduced-motion via the global rule. Sits behind all content.

const PARTICLES = [
  { left: 6, size: 3, delay: 0, duration: 26 },
  { left: 14, size: 2, delay: 8, duration: 32 },
  { left: 23, size: 4, delay: 3, duration: 22 },
  { left: 31, size: 2, delay: 14, duration: 30 },
  { left: 39, size: 3, delay: 6, duration: 28 },
  { left: 47, size: 2, delay: 18, duration: 34 },
  { left: 54, size: 4, delay: 1, duration: 24 },
  { left: 62, size: 2, delay: 11, duration: 31 },
  { left: 69, size: 3, delay: 5, duration: 27 },
  { left: 77, size: 2, delay: 16, duration: 33 },
  { left: 84, size: 4, delay: 9, duration: 23 },
  { left: 91, size: 3, delay: 2, duration: 29 },
  { left: 19, size: 2, delay: 20, duration: 36 },
  { left: 43, size: 3, delay: 13, duration: 25 },
  { left: 58, size: 2, delay: 7, duration: 35 },
  { left: 73, size: 3, delay: 17, duration: 30 },
  { left: 88, size: 2, delay: 4, duration: 32 },
  { left: 34, size: 4, delay: 22, duration: 21 },
];

export function AmbientBackground() {
  return (
    <div aria-hidden="true" className="brunos-ambient">
      <span className="brunos-orb brunos-orb-1" />
      <span className="brunos-orb brunos-orb-2" />
      <span className="brunos-orb brunos-orb-3" />
      <div className="brunos-particles">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            style={{
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>
      <div className="brunos-grain" />
    </div>
  );
}
