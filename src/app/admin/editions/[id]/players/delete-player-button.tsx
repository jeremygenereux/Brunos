"use client";

import { deletePlayer } from "./actions";

export function DeletePlayerButton({
  playerId,
  editionId,
  name,
}: {
  playerId: string;
  editionId: string;
  name: string;
}) {
  return (
    <form
      action={deletePlayer}
      onSubmit={(e) => {
        if (!window.confirm(`Retirer ${name} de cette édition ?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="player_id" value={playerId} />
      <input type="hidden" name="edition_id" value={editionId} />
      <button
        type="submit"
        className="text-ivoire-faint font-sans text-xs transition hover:text-red-300"
      >
        Retirer
      </button>
    </form>
  );
}
