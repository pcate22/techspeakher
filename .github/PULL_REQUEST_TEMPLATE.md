<!-- Merci pour votre contribution ! Remplissez les sections ci-dessous. -->

## Quoi et pourquoi

<!-- Décrivez le changement et la raison. Liez l'issue : Closes #123 -->

## Type de changement

- [ ] `fix` — correction de bug
- [ ] `feat` — nouvelle fonctionnalité
- [ ] `docs` — documentation
- [ ] `chore` / `test` / `refactor`

## Pour tout le monde

- [ ] `npm run test` passe
- [ ] `npm run type-check` passe
- [ ] `npm run lint` passe
- [ ] Comportement changé ? Un test l'accompagne (ou je dis plus haut que je n'ai pas su l'écrire)
- [ ] Schéma DB modifié ? → `db/schema.sql` **+** `db/sync-to-latest.sql` **+** migration `db/migrations/NNN_*.sql`
- [ ] Contenu / commits en français, commit préfixé (`feat:`, `fix:`, `docs:`…)
- [ ] Aucun secret ni donnée personnelle réelle ajouté au dépôt

## Pour une session Claude

<!-- Une contributrice humaine peut laisser cette partie vide : la relecture
     côté association s'en charge (CONTRIBUTING.md, « Le parcours d'une
     contributrice »). -->

- [ ] Tests écrits **avant** le code, **et cassés une fois** pour vérifier qu'ils tombent
- [ ] Tests hérités du périmètre touché re-jugés (mutation faite, ou « rien croisé »)
- [ ] Quatre revues passées (`docs/revue-avant-pr.md`), findings corrigés ou justifiés ci-dessus
- [ ] Dette croisée : soldée (avec ses numéros), ou écrite avec sa priorité et son chemin complet
- [ ] `docs/dette-technique.md` et `docs/roadmap.md` tenus **dans cette PR** (`CLAUDE.md` §Clore une session)
- [ ] Les autres docs que la PR rend faux sont corrigés ici même

## Captures / notes

<!-- Captures d'écran pour un changement d'UI, ou notes pour la revue. -->
