#!/usr/bin/env bash
# Lancement de l'environnement de dev Les Brunos (local-first).
# Usage : pnpm dev:local   (ou : bash scripts/dev.sh)
set -uo pipefail
cd "$(dirname "$0")/.."

# Avis (non bloquant) si une mise à jour de Supabase CLI est disponible
( o=$(brew outdated supabase 2>/dev/null); [ -n "$o" ] && echo "ℹ️  Mise à jour Supabase CLI dispo → brew upgrade supabase" ) &

echo "▶ Démarrage de Supabase (OrbStack) — ports dédiés Brunos…"
supabase start || true

# Pour repartir d'une BD fraîche (migrations + seed), décommente :
# echo "▶ Reset de la BD locale…"; supabase db reset

echo "▶ Ouverture des onglets dès que Next sera prêt…"
( sleep 3; open \
    "http://127.0.0.1:54424" \
    "http://127.0.0.1:54423" \
    "http://brunos.localhost:3001" ) &

echo "▶ Serveur Next.js (port 3001)…"
pnpm dev
