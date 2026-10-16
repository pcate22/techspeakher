# Politique de sécurité

## Signaler une faille

**N'ouvrez pas d'issue publique** pour une faille de sécurité.

Écrivez en privé à **techspeakher@gmail.com** (ou utilisez l'onglet *Security →
Report a vulnerability* de GitHub si activé). Décrivez :

- le type de faille et le composant concerné,
- les étapes pour la reproduire,
- l'impact potentiel,
- si possible, une piste de correction.

Nous accusons réception sous **72 heures** et vous tenons informé·e de la
correction. Merci de nous laisser un délai raisonnable pour corriger avant toute
divulgation publique.

## Ne partagez jamais de secret

Ne collez **aucune** valeur sensible (clé d'API, `DATABASE_URL`, `AUTH_SECRET`,
token, mot de passe) dans une issue, une PR, un commit ou un message public.
Les secrets vivent uniquement dans l'environnement (Vercel / `.env.local`),
jamais dans le dépôt.

Si un secret a fuité (commit, capture, message) : considérez-le comme compromis,
**révoquez-le et régénérez-le** immédiatement, puis signalez-le à l'adresse
ci-dessus.

## Bonnes pratiques du projet

- Secrets en variables d'environnement uniquement (voir [`.env.example`](./.env.example)).
- Server Actions : identité issue de la session, autorisation ré-vérifiée côté
  serveur, entrées validées (Zod), SQL paramétré.
- Anti-abus : `src/lib/rate-limit.ts` (contact, lien magique) ; crons protégés
  par `CRON_SECRET`.
- Aucune donnée personnelle réelle dans le dépôt.

## Versions concernées

Le projet est déployé en continu depuis `main`. Seule la version courante de
`main` est maintenue et reçoit les correctifs de sécurité.
