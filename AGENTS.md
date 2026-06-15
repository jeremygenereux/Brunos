<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Les Brunos — contexte projet (dev local-first)

App du gala annuel « Les Brunos » : votes *who's most likely to*, classement Borda, « égaliseur » de shooters, mode présentation. Next.js 16 (App Router) + React 19 + Tailwind v4 + Supabase. pnpm, Node ≥ 20.

## Lancer en local
- `pnpm dev:local` → Supabase (OrbStack) + ouvre les onglets + serveur (voir `scripts/dev.sh`).
- Manuel : `pnpm db:start` puis `pnpm dev`. Toujours depuis la racine du repo.
- **Ports dédiés** (parallèles à Asteryx One) : API Supabase **54421**, DB **54422**, Studio **54423**, Mailpit **54424** ; app Next sur **3001**.
- App : http://brunos.localhost:3001 · Studio : http://127.0.0.1:54423 · Mailpit : http://127.0.0.1:54424

## Base de données
- Schéma = `supabase/migrations/` (source de vérité). Seed de dev : `supabase/seed.sql`.
- Changer le schéma : `pnpm db:diff <nom>` → `pnpm db:reset` → commit. Types : `pnpm db:types`.
- Prod : intégration GitHub Supabase / `supabase db push`. **Vercel ne touche jamais la BD.**

## Env / secrets
- `.env.local` (git-ignored) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clé publishable locale), `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement), `NEXT_PUBLIC_SITE_URL`.

## Git
- `main` → Production (Vercel). Travail : `feature/*` → PR vers `develop` → PR vers `main`. Conventional Commits.
- Ne pas mentionner Claude Code / Anthropic dans les commits ou le code.
