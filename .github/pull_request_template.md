## Résumé

<!-- Que fait cette PR, et pourquoi ? -->

## Type de changement

- [ ] ✨ Feature
- [ ] 🐛 Correctif
- [ ] ♻️ Refactor
- [ ] 🎨 UI / direction artistique
- [ ] 🗄️ Migration base de données (Supabase)
- [ ] 🔧 Outillage / CI / config

## Checklist

- [ ] `pnpm lint && pnpm typecheck && pnpm build` passent en local
- [ ] Migrations Supabase incluses + testées (`pnpm db:reset`) si le schéma change
- [ ] RLS vérifiées si de nouvelles tables/colonnes sont exposées
- [ ] Pas de secret commité (`.env.local` ignoré)
- [ ] Cible la bonne branche (`develop` pour le dev, `main` pour une release)

## Captures / notes

<!-- Captures d'écran pour les changements visuels, notes de test, etc. -->
