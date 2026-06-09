# Les Brunos

Application web du gala annuel des **Brunos** — votes _who's most likely to_,
agrégation des classements (méthode Borda), « égaliseur » qui équilibre qui boit,
et mode présentation plein écran style Oscars pour la révélation des gagnants.

> Spécification complète : [`docs/BRUNOS_MVP_SPEC.md`](docs/BRUNOS_MVP_SPEC.md) ·
> Idées post-MVP : [`docs/BRUNOS_FUTURE_FEATURES.md`](docs/BRUNOS_FUTURE_FEATURES.md)

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Supabase** (Postgres, Auth, Storage, RLS)
- **Vercel** (hébergement, Production + Preview)

## Prérequis

- **Node.js ≥ 20**
- **pnpm ≥ 9** (`corepack enable` ou `npm i -g pnpm`)
- **Docker** (pour la stack Supabase locale)

## Démarrage rapide

```bash
pnpm install
cp .env.example .env.local        # puis remplir les clés (voir ci-dessous)

pnpm db:start                     # démarre Supabase en local (Docker)
pnpm db:reset                     # applique les migrations + seed
pnpm db:types                     # génère src/lib/types/database.types.ts

pnpm dev                          # http://localhost:3000
```

Après `pnpm db:start`, le CLI affiche l'**API URL** et les **clés** locales à
copier dans `.env.local` :

| Variable                        | Source                                   |
| ------------------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `API URL` affichée par `supabase start`  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon key` affichée par `supabase start` |
| `SUPABASE_SERVICE_ROLE_KEY`     | `service_role key` (serveur uniquement)  |

## Scripts

| Script                              | Rôle                                               |
| ----------------------------------- | -------------------------------------------------- |
| `pnpm dev`                          | Serveur de développement                           |
| `pnpm build` / `pnpm start`         | Build de production / serveur prod                 |
| `pnpm lint` · `pnpm typecheck`      | ESLint · vérification des types                    |
| `pnpm format` · `pnpm format:check` | Prettier                                           |
| `pnpm db:start` · `pnpm db:stop`    | Stack Supabase locale                              |
| `pnpm db:reset`                     | Re-applique migrations + seed                      |
| `pnpm db:diff -f <nom>`             | Génère une migration depuis les changements locaux |
| `pnpm db:types`                     | Régénère les types TypeScript du schéma            |

## Structure

```
src/
  app/                 # Routes App Router + layout + direction artistique
  lib/
    supabase/
      client.ts        # client navigateur (RLS)
      server.ts        # client Server Components / Actions (RLS)
      admin.ts         # client service_role (serveur, bypass RLS)
      middleware.ts    # refresh de session
    utils.ts           # helper cn()
  proxy.ts             # convention Next 16 (ex-"middleware")
supabase/
  config.toml
  migrations/          # source de vérité du schéma (versionné)
docs/                  # specs MVP + features futures
```

## Environnements & branches

Modèle **prod / dev** :

| Git         | Environnement             | Supabase            | Vercel                 |
| ----------- | ------------------------- | ------------------- | ---------------------- |
| `main`      | **Production**            | branche/projet prod | déploiement Production |
| `develop`   | **Staging / intégration** | preview DB          | déploiement Preview    |
| `feature/*` | éphémère                  | preview DB (par PR) | Preview par PR         |

- Tout le travail se fait sur des branches **`feature/*`** → **PR vers `develop`**.
- Les releases se font par **PR `develop` → `main`**.
- Commits en **Conventional Commits** (`feat:`, `fix:`, `chore:`, `db:`…).
- La base est **« branching-ready »** : migrations versionnées + intégration
  Vercel↔Supabase. Activer le **plan Pro + Supabase Branching** crée une DB de
  preview éphémère par PR, sans refactor.

## Déploiement

Déploiement continu via **Vercel** (projet `brunos`, org Asteryx) :
`main` → Production, `develop` + PRs → Preview. Les variables d'environnement
Supabase sont définies par environnement dans Vercel.

## Sécurité

- Toutes les tables sont protégées par **Row Level Security**. Un votant ne voit
  jamais les votes d'autrui avant l'archivage de l'édition.
- La clé `service_role` est **serveur uniquement** (jamais exposée au navigateur).
- `.env.local` est ignoré par Git ; ne jamais committer de secret.
