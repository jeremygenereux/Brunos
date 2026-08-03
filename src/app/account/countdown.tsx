"use client";

// Compte à rebours jusqu'à la soirée. Rendu côté client uniquement : l'écart
// dépend de l'heure du navigateur, et l'afficher au premier rendu serveur
// provoquerait un décalage d'hydratation (le serveur et le client ne calculent
// pas à la même seconde). On n'affiche donc rien tant que le montage n'a pas eu
// lieu — c'est aussi ce qui évite un « saut » de valeur.

import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

function Cell({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-or-300 font-display text-3xl leading-none tabular-nums sm:text-4xl">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-ivoire-faint font-sans text-[10px] tracking-[0.2em] uppercase">
        {label}
      </span>
    </div>
  );
}

export function Countdown({ target }: { target: string }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const at = new Date(target).getTime();
    if (Number.isNaN(at)) return;
    const tick = () => setLeft(at - Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (left === null) return null;

  if (left <= 0) {
    return (
      <p className="text-or-300 font-display text-2xl font-semibold">C&apos;est ce soir 🎉</p>
    );
  }

  const { days, hours, minutes, seconds } = parts(left);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-ivoire-faint font-sans text-[10px] tracking-[0.3em] uppercase">
        Avant la cérémonie
      </span>
      <div className="flex items-start gap-5">
        <Cell value={days} label={days > 1 ? "jours" : "jour"} />
        <Cell value={hours} label="h" />
        <Cell value={minutes} label="min" />
        <Cell value={seconds} label="s" />
      </div>
    </div>
  );
}
