import type { Database } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

type State = Database["public"]["Enums"]["edition_state"];

const MAP: Record<State, { label: string; cls: string }> = {
  CONSTRUCTION: { label: "Construction", cls: "border-ivoire-faint/40 text-ivoire-muted" },
  SENT_FOR_VOTE: { label: "Vote ouvert", cls: "border-or-400/50 text-or-300" },
  COMPILATION: { label: "Compilation", cls: "border-or-400/50 text-or-300" },
  LOCKED: { label: "Verrouillée", cls: "border-ivoire-faint/40 text-ivoire-muted" },
  LIVE: { label: "En direct", cls: "border-or-300 text-or-300" },
  ARCHIVED: { label: "Archivée", cls: "border-ivoire-faint/30 text-ivoire-faint" },
};

export function StateBadge({ state }: { state: State }) {
  const s = MAP[state];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-sans text-xs tracking-wide",
        s.cls,
      )}
    >
      {s.label}
    </span>
  );
}
