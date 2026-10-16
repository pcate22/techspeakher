# Dette technique — Tech Speak'Her

> **Session du 2026-10-16 — audit « reprise humaine »**
> (`docs/audit-reprise-humaine.md`, docs seulement). Aucun P0 touché ; le **3**
> n'a pas été relu ce jour. Recalés contre le code : les chiffres du P1
> « Squelette copié-collé des actions redirect » (§ Robustesse). Rien soldé,
> rien de nouveau : le plan (découpage, commentaires, archive de la dette
> soldée) attend la validation de Cateline et vit dans la roadmap.
>
> **Session du 2026-10-15 — les six rouges locaux sous Node 26.** SOLDÉ : le
> P2 « six tests rouges en local sous Node 26 » (§ Tests). Deux causes,
> vérifiées : le `localStorage` natif de Node ≥ 25 masquait celui de jsdom
> (`vitest.config.ts`, `--no-experimental-webstorage`), et deux tests de
> route comparaient par égalité profonde un `File` RECONSTRUIT par
> `formData()` (helper `contenuFichier`, `src/__tests__/test-helpers.ts`).
> Pas d'épinglage de `engines` : la suite passe sous Node 22 et 26. DÉCOUVERT,
> en P3 : `reaction-row.test.tsx` vu une fois rouge sous charge (§ Tests).
>
> **Session du 2026-10-15 — crons bloqués, bilan des adhésions.** DÉCOUVERT
> et réglé le jour même : `CRON_SECRET` manquait en production, donc tous les
> crons répondaient 401 sans rien écrire (rappels, récap orga, conservation,
> synchro Brevo, adhésions, moissonneur). Depuis quand : inconnu (une heure de
> logs seulement), à vérifier au besoin dans l'historique des envois Brevo.
> Posée par Cateline ; un refus se dit désormais dans les logs
> (`src/lib/cron-auth.ts`) et `checkEnv` la réclame au démarrage. Le bilan de
> la dernière relecture HelloAsso est gardé en base et lu sur
> `/admin/adhesions` (bouton « Relire HelloAsso maintenant », freiné à une
> relecture par minute). SOLDÉ : les deux hypothèses sur l'API HelloAsso
> (§ Adhésions HelloAsso) ; l'`INSERT` de `plateforme_reglages` écrit en un
> seul endroit (`ecrireValeurReglage`). NOUVEAU, P2 : deux relectures sans
> verrou, et un seul « dernier » bilan (§ Adhésions HelloAsso).
>
> **Session du 2026-10-15 — préalable au dépôt public** : vraies finalistes du
> seed Tremplin 1 remplacées par des figurantes, gabarits CSV supprimés,
> garde `seeds-figurants.test.ts`. Rien de nouveau en dette.
>
> **Session du 2026-10-15 — e-mails à l'ouverture des adhésions.** Aucun P0
> touché ; le **3** n'a pas été relu ce jour. SOLDÉ dans le geste : les
> e-mails mêlaient « Bonjour » et « Salut », des cadratins dans trois objets,
> des tournures négatives et des espaces simples avant « : » ; une salutation
> unique (`salutation`, `src/lib/format.ts`) et une garde commune à TOUS les
> e-mails (`src/__tests__/emails-redaction.test.ts`, chaque règle cassée une
> fois). Hors de cette garde, et dit ici pour qu'on ne la croie pas
> complète : l'e-mail du formulaire de contact (interne, vers la boîte des
> orga, `src/app/api/contact/route.ts`), exclu exprès et dit dans le test.
> La lettre d'information y est entrée (salutation, insécables). Le reste
> relevé par les revues et laissé, en P2 § Adhésions HelloAsso : deux
> composants d'envoi par lot jumeaux, la boucle « envoyer puis marquer »
> en quatre copies, le tarif écrit en dur, `dateLongueFr` (UTC) sur
> d'autres horodatages.
>
> **Session du 2026-10-15 — adhésions HelloAsso et annuaire réservé aux
> membres** (`docs/conception-adhesions-helloasso.md`, migration 074, PR #212
> des feature flags reprise). Aucun P0 touché ; le **3** n'a pas été relu ce
> jour. SOLDÉ dans le geste : la réserve « hors adhésion en cours » sur la
> conservation maximale des mentions légales (§ Revue croisée du 2026-08-16) ;
> le re-jugement de `STATUTS_FICHE_JOINTE` à l'extension de `PROFILE_STATUSES`
> (`en_pause` y reste jointe : ce n'est pas un retrait) ; la liste fermée des
> statuts désormais tenue **dans les deux sens** (TS ↔ CHECK SQL,
> `listes-fermees-sql.integration.test.ts`) ; la comparaison de secret mise en
> commun (`secretValide`, cron, Brevo, HelloAsso) ; un commentaire orphelin de
> `withdrawOwnProfile` remis à sa place ; « 1er » au lieu de « 1 » pour le
> premier du mois (`dateLongueFr`, trois tests hérités recalés). DÉCOUVERT, en P2 : deux points à
> vérifier sur la première vraie commande HelloAsso, et le branchement de
> `accounts.email` sans test de montage (§ Adhésions HelloAsso).
>
> **2026-10-15 — SOLDÉ par #365** : le P2 « l'en-tête public se chevauche
> au-dessus de 1 024 px » (§ A11y). Le menu à sept entrées (« Partenaires »)
> débordait entre 1 024 et 1 279 px : le burger, la barre d'onglets et
> leur dégagement (`globals.css`) passent ensemble de `lg` à `xl`. Gardes :
> `e2e/largeur.spec.ts` (burger à 1 024 et 1 279 px, aucun chevauchement ni
> retour à la ligne de 1 280 à 1 536 px) et `barre-action-collante.test.ts`.
>
> **Session du 2026-10-15 — landing partenaires** : « Contact » quitte le menu
> (donc le burger) ; le pied court le garde désormais (`footer-coquille-app`).
> Rien de nouveau en dette.
>
> **Session du 2026-10-15 — navigation connectée** (rail bureau, onglet « Ma
> fiche », « Une date » sans ouvrir le talk). Aucun P0 touché ; le **3** n'a
> pas été relu ce jour. SOLDÉ dans le geste : la navigation tombait avec
> `getFeuilleDonnees` (P2 du 2026-08-18). DÉCOUVERT, en P2 : ce que la refonte
> laisse ouvert (§ « Navigation connectée », six items ; la décision sur le
> repli de l'onglet-photo a été tranchée et soldée le même jour).
>
> **Session du 2026-10-15 — liens vers `/adherer`** : le menu passe à sept
> entrées, ce qui aggrave le chevauchement de l'en-tête entre 1 024 et
> ~1 100 px déjà en P2 (§ A11y, non relu ce jour).
>
> **Session du 2026-10-15 — textes après l'AGE** (mentions légales, code de
> conduite, `/adherer`). Aucun P0 touché ; le **3** n'a pas été relu ce jour.
> SOLDÉ dans le geste : la citation de la page code de conduite et ses
> `charteRules` (4 règles libres) remplacées par le texte adopté, source unique
> `src/data/charte.ts`. Rien de nouveau en dette ; les écarts produit sont dans
> la roadmap.
>
> **État au 2026-08-23 (P0 non relus depuis, à vérifier au 2026-10-14) — un seul P0 ouvert : le 3.** Le journal des erreurs
> serveur existe depuis le 08-09 (`onRequestError` → `journal-erreurs.ts`) ;
> ce qui manque est l'**alerte** : personne n'est prévenu, il faut aller lire
> les logs Vercel. Les `console.error` qui avalent un repli restent hors
> journal, chemins RGPD compris. Il ne perd ni ne fausse de données, et il
> demande un choix d'outillage plus qu'une journée de code.
>
> **Sessions du 2026-10-14 — bombe de date dans le décor E2E** (PR #364, puis
> #366, qui l'englobe). Le parcours
> « 4 tâches à faire » (`e2e/espaces-connectes.spec.ts`) est tombé en CI sans
> qu'une ligne de code bouge : l'atelier « Répétition des pitchs » de l'édition
> EN COURS de `db/seed-preview.sql` était daté en dur au 2026-10-13. SOLDÉ :
> les dates de cette édition (ateliers, finale, conférence, inscriptions) sont
> relatives à `CURRENT_DATE`, et `src/__tests__/seed-preview-dates.test.ts`
> refuse toute date littérale future du décor sans marqueur `-- date fixe :`.
> DÉCOUVERT, en P2, puis SOLDÉ le même jour (PR #368, empilée sur #366) :
> l'ANNÉE du décor. Les trois éditions (N-1 archivée, N en cours, N+1 en
> préparation) dérivent leur année, leurs noms et leurs dates de `CURRENT_DATE`
> (N = année de la conférence en cours, à J+37), côté seed comme côté e2e
> (`ANNEE`, `DATE_CONF`, `EDITION` dans `e2e/decor.ts`) ; le même test refuse
> désormais toute année en dur dans le code du seed, et tient le décalage J+37
> égal des deux côtés.
>
> **Session du 2026-10-14 — E2E instables.** `e2e/parcours-talks.spec.ts`
> tombait une fois sur huit en local parallèle : deux courses de l'automate,
> soldées (registre de `docs/principes-tests.md`). DÉCOUVERT, en P2 : une
> course de régénération ISR sur `/partenaires`, mesurée en E2E parallèle.
>
> **Session du 2026-10-14 — kit de communication** (`/kit-de-communication`).
> Aucun P0 touché ; le **3** n'a pas été relu ce jour. SOLDÉ dans le geste :
> `public/brand/tokens.json` et `public/llms.txt` annonçaient des logos « fond
> transparent » qui n'ont **aucun canal alpha** (vérifié au fichier), et
> `llms.txt` les disait « libres d'usage », contre `TRADEMARK.md`. DÉCOUVERT, en
> P2 : l'en-tête public se chevauche entre 1 024 et ~1 100 px (§ A11y) ; six
> tests rouges en local sous Node 26, déjà rouges sur `main` (§ Tests ;
> SOLDÉ le 2026-10-15, voir en tête).
>
> **Session du 2026-08-23 — licence du dépôt : code public, pas libre.** Le
> dépôt promettait l'inverse à **six endroits** : `LICENSE` (AGPL-3.0
> intégrale), `package.json`, le README (section « Monter votre propre
> tremplin »), `CONTRIBUTING.md`, `TRADEMARK.md` (« le code est à tout le
> monde ») et **deux e-mails envoyés aux membres** (« le site est open source »).
> Les six sont recalés, et tenus ensemble par
> `src/__tests__/licence-coherence.test.ts` (5 mutations rouges). Les docs de
> conception qui posaient l'open source en prémisse sont recalés aussi
> (`plateforme-conception-technique.md` §1/§10/§16,
> `plateforme-conception-fonctionnelle.md`, `tremplin-edition-publique.md`) :
> le principe qu'ils tenaient — le code se lit, les données jamais — ne bouge
> pas. DÉCOUVERT, en P2 : l'attribution « Propulsé par Tech Speak'Her » n'existe
> que dans les docs.
>
> **P0 soldés**, date portée par chaque item : **1** le 08-21 (docs
> d'architecture fantômes — bandeau ARCHIVE et carte des écarts sur
> `tremplin-implementation.md`, `architecture.md` recalé sur 34 tables et
> `src/proxy.ts`, `migration-speakeuses.md` marquée exécutée, volet env
> complété) · **2** le 08-16 (migration 072, `preparation` en base) · **4** et
> **5** le 08-16 (PR #326, import de talks) ·
> **6** le 08-16 (suppression RGPD laissée chez Brevo, avec le point P2 « échecs
> de suppression muets » qu'il rendait plus probable) · **7** le 08-16
> (proposition partagée modifiée en place) · **8** le 08-21 (migration 073, les
> deux colonnes à lecteur fail-open, puis PR #350 pour leurs deux lecteurs ; le
> reliquat sans lecteur fail-open est descendu en P2). Les items **4 à 7**
> venaient de la relecture croisée du 08-16 (5 relecteurs, périmètre : tout ce
> qui avait été mergé depuis la revue de juillet) : **quatre défauts à
> conséquence sur les données**, dont deux reproduits en exécutant le code. Le
> reste de cette relecture est en P2, section « Revue croisée du 2026-08-16 ».
>
> Revue de fond : **2026-07-30** — vérification item par item du doc contre le
> code (à `9355fa5`), recalage des statuts et repriorisation complète ; les
> items ouverts de la PR #233 (nom de compte obligatoire, fusionnée le même
> jour) sont intégrés dans les sections ci-dessous. Revue précédente :
> 2026-07-03, complétée d'addenda jusqu'au 2026-07-26 (résumés en fin de
> document). Dernier ajout thématique : **2026-08-16**, les mots tronqués et
> les sigles dans la copie affichée (§ A11y), dette révélée par la mise en
> principes de l'accessibilité cognitive.
>
> **Session du 2026-08-22 — arbitrage des conférences proposées** (PR #359,
> `docs/conception-arbitrage-conferences.md`). SOLDÉ : la garde d'état de
> `refuseConferenceProposition` (P2, item rayé plus bas) ; le nettoyage d'URL de
> `ConfirmationBanner`, qui ignorait quatre paramètres neufs et n'avait aucun
> test depuis les huit premiers ; le jumeau en capitales de
> `admin/conferences/page.tsx`, qui sort des `RESTANTS` de
> `typographie-lisible.test.ts` ; et la copie locale d'`estIdValide` dans
> `mon-espace/actions.ts`, arrêtée à `Number.isInteger` — dont son propre
> commentaire annonçait la 500. DÉCOUVERT, en P2 § « Répertoire des conférences »
> : cinq items, dont deux mesurés en sonde (l'année corrigée par l'orga reste
> réversible par la membre, et `conference_propositions` n'a aucun index sur un
> chemin lu à chaque rendu de page connectée). MESURÉ ET DURCI dans la même PR :
> jouée sur les 112 noms de la file réelle, la fonction de rapprochement donnait
> **1,00** — le score d'un vrai doublon — à trois propositions parisiennes contre
> « ParisTestConf », parce qu'un nom du répertoire sans coupure fait un seul
> jeton. Deux bornes posées (`COUVERTURE_DEBUT`, `memeSuiteDeLettres`), six
> mutations rouges ; détail et nombres avant/après dans
> `docs/conception-arbitrage-conferences.md` § « Ce que la file réelle a
> mesuré ».
>
> Vue technique : `docs/architecture.md`. Ce doc **se clôt en fin de session**,
> ménage compris : `CLAUDE.md` §Clore une session.

> **Travailler à plusieurs sessions sur ce doc** — leçon du 2026-08-21, payée
> trois fois dans la journée. Le P0-8 a été traité **en parallèle par trois
> sessions**, dont deux sur la MÊME branche : sept fichiers en conflit, deux
> variantes du même correctif, et un merge qui a failli faire disparaître la
> moitié utile du travail. Ce qui a évité la perte : comparer le contenu réel de
> `main` à celui de la branche, fichier par fichier, au lieu de se fier au
> « 0 conflit » de git. D'où trois réflexes, AVANT de prendre un item :
> **une branche par session** ; **marquer l'item PRIS ici et pousser ce marquage
> tout de suite** (celui du P0-7 est arrivé après que le travail avait commencé
> ailleurs, donc il n'a servi à rien) ; et **au merge, vérifier ce que `main`
> contient VRAIMENT** sur les fichiers du lot — un conflit résolu « en prenant
> `main` » jette la partie du travail qui n'existait que chez soi. Méthode
> complète : `docs/clore-une-session.md`.

État général : **base saine, un seul P0 ouvert** — le **3** (les erreurs
serveur sont journalisées, mais personne n'en est prévenu), qui ne touche pas
aux données. Depuis la revue de juillet sont partis en prod :
l'annuaire refondu (filtres, recherche unifiée, SEO/GEO, slugs), les talks
multi-conférences, le journal de consentement avec provenance, la migration de
schéma automatique au déploiement, les trois paliers de suppression et l'agenda
public (lots 0 à 4). La dette réelle restante se concentre sur **l'absence
d'alerte quand la prod casse** et la série d'items à **détonation datée :
l'ouverture de la prochaine édition Tremplin**.

**Ce doc se tient en travaillant, pas en revue annuelle.** Quand on touche à une
zone, on lit ce qu'il en dit (`grep` le fichier, le module), on solde ce qui tient
dans le geste en cours, et on met à jour **dans les deux sens** : soldé → marqué
soldé, avec la date ; découvert → écrit avec sa priorité et sa raison. Les deux
dérives coûtent, et le dépôt a payé les deux : un item soldé mais annoncé ouvert
fait rouvrir un chantier terminé (constaté à la revue du 07-30, sur beaucoup
d'items) ; une entrée « RÉSOLU » posée sur la seule existence d'`e2e/auth.spec.ts`
a laissé le filtrage par rôle à **une seule couche au lieu des deux écrites**
pendant des mois — sans exposition, mais sans que rien le signale (08-08).

**Pour qu'un item se retrouve, il doit nommer son fichier par son chemin
complet** (`src/app/mon-espace/actions.ts`, pas `actions.ts` — le dépôt compte
17 `actions.ts` et 112 `page.tsx`). Un item qu'on traverse se voit ajouter son
chemin au passage. Et comme ce doc est rangé **par priorité puis par thème**,
jamais par emplacement de code, un `grep` muet ne prouve rien : on parcourt aussi
P0 en entier et la section thématique qui couvre la zone. Règle courte :
`CLAUDE.md` §Toucher à du code existant.

## Recalages de cette revue (le doc disait ≠ le code fait)

Vérifié contre le code le 2026-07-30 ; corrections portées dans les sections
ci-dessous, listées ici pour la traçabilité :

1. **« `/speakeuses` passée en ISR 300 » (addendum perf 07-20) : ANNULÉ en
   prod.** La page est repassée en `force-dynamic` le 2026-07-23 (cache figé
   sur « L'annuaire arrive bientôt » quand la base est injoignable au build,
   constaté en prod). Nouvelle cible documentée en commentaire de
   `src/app/speakeuses/page.tsx` : cacher la **donnée** (`unstable_cache` +
   tag), pas la page. Repris en P1.
2. **P1 « zéro E2E sur les gardes d'accès » : RÉOUVERT (2026-08-08).** On avait
   noté « RÉSOLU » sur la seule existence d'`e2e/auth.spec.ts`. Mesuré depuis :
   **ce test ne peut pas échouer**. Le job `e2e` de la CI n'a aucun bloc `env:`,
   donc pas d'`AUTH_SECRET` : Auth.js échoue au décodage de session
   (`MissingSecret`), `req.auth` est `null` pour tout le monde, et le proxy
   redirige vers `/connexion` quelle que soit la logique de
   `authConfig.authorized`. Vérifié en remplaçant les DEUX gardes par
   `return true` puis en rejouant la spec : **3 tests verts sur une garde
   entièrement supprimée**. Et le cas qui compte — connectée non-orga →
   `/admin` — n'était joué nulle part en navigateur.
   **RÉSOLU pour de bon le 2026-08-09**, et le test réparé a trouvé mieux qu'un
   test cassé : le filtrage par rôle n'existait pas au bord. Auth.js n'honore le
   verdict d'`authorized` que si le proxy ne fournit pas son propre
   gestionnaire (`handleAuth` : `else if (userMiddlewareOrRoute)` court-circuite
   `else if (!authorized)`) — le callback était appelé et sa réponse jetée.
   Mesuré avec une session de membre non-orga : 200 sur `/admin`,
   `/admin/messages`, `/admin/reglages`… Sans exposition (les 60 pages portent
   chacune leur garde serveur), mais à une seule couche au lieu des deux
   écrites. La décision vit désormais dans `refusDAcces` (`auth.config.ts`),
   appliquée par le proxy et réutilisée par le callback ; `e2e/auth.spec.ts`
   juge le BORD (requêtes sans JavaScript, redirections non suivies), sans quoi
   les gardes de page masquent la panne. Vérifié par mutation : en neutralisant
   `refusDAcces`, trois tests tombent. Audit complet des parcours :
   `docs/audit-e2e-parcours-2026-08.md`.
3. **P2 « scinder `[edition]/page.tsx` (616 lignes) » : RÉSOLU et au-delà** —
   la page fait 214 lignes, c'est un hub `NavRow` vers ~60 sous-fichiers ;
   `HiddenIds` n'existe plus dans le repo.
4. **« Bascules admin en redirect plein rechargement » : RÉSOLU** — sous-pages
   mono-fonction + `InlineActionForm` (`useActionState`, sans perte de
   scroll). La décision produit « sous-page vs menu ⋯ » est de fait tranchée :
   sous-pages.
5. **P2 `ConfirmSubmitButton` volet RGAA : RÉSOLU** (07-25) — `aria-disabled`
   + `aria-describedby` posés ; la saisie est postée (`name="confirmation"`)
   et revérifiée serveur via `plierConfirmation` (source unique
   `src/lib/confirmation.ts`).
6. **Item accepté « runner de migrations manuel » : PÉRIMÉ** — un runner
   automatisé existe depuis le 07-24 (#193) : step GitHub Actions dans
   `vercel-deploy.yml` qui applique `db/sync-to-latest.sql` (une requête,
   tout-ou-rien) AVANT de livrer le code. La preview reste manuelle.
   Conséquence : les migrations numérotées `db/migrations/NNN` sont de
   l'historique documentaire, jamais exécutées par le runner — le test de
   drift `db-schema-drift.test.ts` (ex-P0-3) devient le garde-fou central.
7. **RGPD « journal de consentement sans acteur ni source » : RÉSOLU** —
   migration 037 : colonnes `base` (`self`/`formulaire_inscription`/`email`/
   `autre`) + `preuve_lien` sur `tremplin_consent_log`, exposées par
   `ConsentJournal`. (Nommage différent des `consent_actor`/`consent_source`
   proposés, besoin couvert.)
8. **« Colonnes mortes de `tremplin_registrations` » : 4, pas 5** —
   `participante_role` est encore lue et AFFICHÉE sur la fiche orga d'une
   participante (`participantes/[registration]/page.tsx`). Seules `bio`,
   `site_web`, `photo_url`, `participante_linkedin` sont mortes en lecture.
9. **« `etapes` n'est plus importé que par les tests » : FAUX** — renommé
   `tremplinSteps`, importé et **rendu en prod** par `/tremplin` (avec ses
   4 cadratins de copie marketing).
10. **Chiffres recalés** : `admin/tremplins/actions.ts` = **1994 lignes**
    (pas 1937) ; JSON-LD inline = **8** scripts (pas 6) ; liens « ← Retour »
    recopiés = **23** fichiers ; doublons de numéros de migration = **5
    paires** (010, 011, 012, 032, 044), le README n'en signale que 3.
11. **« Les modales admin n'ont aucun test » : PARTIELLEMENT** — 3 fichiers de
    tests de modales existent, et la précédence `restoredValue` > defaults est
    verrouillée (`action-state.test.ts`). Restent nus : la garde
    `nouvelleSoumise` et le protocole de régions vivantes d'`AdminDialog`.
12. **Duplication d'édition, raccord conf/lieu : RÉSOLU** — `duplicateEdition`
    recopie `confLieu` (migration 029 fusionnée). `addRecompense` reste non
    transactionnelle (détonation : phase 2 de la duplication).
13. **`ChampTexte` contour sous-contrasté : RÉSOLU** (#232) —
    `border-field-border` ; bénéfice repo-wide via `inputClass` partagé.
    Nuance (#233) : 3 fichiers + 2 copies locales d'`inputClass` gardent
    `border-navy-lighter` — repris en P2.
14. ~~**Env : `AUTH_REDIRECT_PROXY_URL` manque partout, et les deux variables
    au tableau d'`exploitation.md`.**~~ **SOLDÉ le 2026-08-21** (volet env de
    P0-1) : `AUTH_REDIRECT_PROXY_URL` est dans `.env.example` **et** au tableau,
    `PREVIEW_DATABASE_URL` aussi.

## 🔴 P0 — à traiter en priorité

> **Un seul item ouvert ici : le 3.** Les items 1, 2 et 4 à 8 sont soldés et
> restent barrés à leur place, avec leur date et ce qui les garde — ce qui reste
> à faire se lit donc en un item, l'historique en dessous.

1. ~~**Les docs d'architecture décrivent un module fantôme**~~ **RÉSOLU le
   2026-08-21** (taillé, pas réécrit — recalé contre un inventaire exhaustif du
   code) :
   - `docs/tremplin-implementation.md` porte un bandeau **ARCHIVE — livré, le
     réel a divergé** et une **carte des écarts** (15 tables réelles dont
     `tremplin_atelier_membres`/`_coachs` et `coachs TEXT` legacy, `preparation`
     pivot du 404 public, 23 libs, `src/proxy.ts` au lieu du `middleware.ts`
     projeté, `audit_events` jamais créée) ; le corps reste comme trace de
     conception, sous un séparateur explicite.
   - `docs/architecture.md` : modèle de données recalé sur les **34 tables**
     (registre des conférences, occurrences, moissonneur, Tremplin réel avec
     ses 5 statuts et consentements par phase, contenus/fil, réglages, seeds),
     note « `sync-to-latest.sql` est ce qui est joué (`scripts/migrate.mjs`),
     dernière migration 073 », rôle **coach** ajouté, garde `src/proxy.ts`
     décrite (avec `refusDAcces`).
   - `docs/migration-speakeuses.md` : statut **exécutée** (cohorte `migrated`,
     `.invalid` = sans adresse connue), les trois références au
     `src/data/speakeuses.ts` jamais versionné remplacées (données perso hors
     git) ; la référence résiduelle de `plateforme-conception-technique.md`
     §12 annotée de même.
   - Volet env : `AUTH_REDIRECT_PROXY_URL` (lue par Auth.js lui-même, vérifiée
     dans `@auth/core`) ajoutée à `.env.example` **et** au tableau
     d'`exploitation.md` ; `PREVIEW_DATABASE_URL` ajoutée au tableau (elle
     était déjà dans `.env.example`).

2. ~~**`preparation` n'existe nulle part côté SQL.**~~ **RÉSOLU le
   2026-08-16** (migration 072, dans les 3 fichiers SQL). `DEFAULT
   'preparation'` : une édition créée à la main dans l'éditeur Neon (mode
   opératoire réel) naît invisible du public au lieu de naître **publique**.
   `tremplin_editions_statut_ck` ferme la liste sur les 5 valeurs du code —
   la base refuse d'elle-même un statut qu'aucun écran ne saurait lire, quel
   que soit le chemin d'écriture. Le commentaire de `schema.sql`, resté à
   4 valeurs, dit maintenant les 5 et renvoie à `EDITION_STATUTS`.
   Le défaut ne touche que les INSERT à venir ; les 5 valeurs sont celles
   que l'application écrit depuis toujours (bornées par `isEditionStatut`),
   donc rien à redresser avant la contrainte.
   Gardé par `listes-fermees-sql.integration.test.ts` (absorbé le 2026-08-21,
   ex-`edition-statut-sql.integration.test.ts` ; vrai Postgres sur le
   vrai `schema.sql`), qui parcourt `EDITION_STATUTS` : ajouter un statut au
   code sans l'ajouter au CHECK fait tomber la CI. `sync-to-latest.sql` est
   tenu au même état par `db-schema-drift.test.ts`. Vérifié par mutation :
   défaut remis à `'ouvert'` → 2 tests tombent ; CHECK retiré → 2 tests ;
   bloc 072 retiré du seul sync → le drift tombe.

3. **Personne n'est PRÉVENU d'une erreur serveur** (relu contre le code le
   2026-08-21 ; l'item décrivait jusque-là un état antérieur au 08-09, cf.
   encadré sous cette liste). Ce qui existe depuis `ba70d87` (08-09) :
   `src/instrumentation.ts` exporte `onRequestError` et le route vers
   `src/lib/journal-erreurs.ts` (ligne JSON structurée, chaîne de requête et
   en-têtes exclus, gardé par `journal-erreurs.test.ts`), et
   `.github/workflows/surveillance-prod.yml` rejoue un contrôle de prod toutes
   les 30 min. Ce qui manque : **une alerte**. Il faut aller LIRE les logs
   Vercel pour savoir qu'une page a cassé — c'est ce que disent déjà
   `docs/principes-tests.md` (§ journal) et `docs/exploitation.md`
   (« À venir — Monitoring/alertes »). Restent aussi **hors journal** les ~126
   `console.error` de `src/`, dont des replis silencieux sur chemins RGPD :
   le hook attrape le rendu, pas un `catch` qui avale. Minimum viable : alerte
   Vercel sur logs error-level, ou Sentry côté serveur. **Effort : S-M.**

4. ~~**Import de talks : un fichier JSON perd presque tout, et l'écran annonce
   « 0 ignorée ».**~~ **CORRIGÉ le 2026-08-16 (PR #326)** — dépliage PAR élément
   (`deplierRessources`), repro exact pinné par deux tests (« fichier MIXTE :
   rien n'est jeté » et « autrice SANS présentation : aucun talk à son
   prénom », `import-talks.test.ts`). Constat d'origine (2026-08-16),
   `src/lib/import-talks.ts:157` (`deplierRessources`) : le dépliage des ressources imbriquées est décidé
   **pour toute la liste** : dès qu'UN élément porte `relationships.data`, la
   fonction renvoie la concaténation des seules listes imbriquées et jette tous
   les éléments de premier niveau, celui qui portait le nid compris.
   **Reproduit** en exécutant la fonction :
   ```json
   {"data":[
     {"attributes":{"title":"A","event":"X"},"relationships":{"data":[{"attributes":{"title":"B"}}]}},
     {"attributes":{"title":"C"}}
   ]}
   ```
   → seul `B` est importé ; `A` et `C` disparaissent. Le rejet a lieu AVANT la
   boucle `versCandidat`, donc `ignorees` reste à `0` : l'aperçu affiche
   « 1 talk lu dans le fichier », rien ne signale les deux pertes. Sur un export
   « une entrée par présentation, liée à son événement », toutes les
   présentations sont remplacées par des cibles sans titre et l'import meurt sur
   « Aucun talk lisible dans ce fichier » — pour un fichier parfaitement valide.
   Le dépliage doit se faire **par entrée** (garder l'entrée ET ses ressources
   imbriquées), et toute entrée écartée doit être comptée. C'est l'image
   inversée du défaut corrigé par `e71aa99` (« le fichier d'Aurélie importait
   Aurélie »). **Effort : S.**

5. ~~**Import de talks : un guillemet isolé dans un CSV avale la fin du
   fichier.**~~ **CORRIGÉ le 2026-08-16 (PR #326)** — le mode « champ quoté »
   ne s'ouvre plus qu'en début de champ (espaces de tête tolérés), repro pinné
   par deux tests (« un " isolé en milieu de champ reste un caractère » et
   « un champ CITÉ précédé d'espaces se lit comme avant »,
   `import-talks.test.ts`). Constat d'origine (2026-08-16),
   `src/lib/import-talks.ts:231` : hors champ entre guillemets,
   tout `"` fait basculer le scanner en mode « champ quoté » : le séparateur ET
   le retour à la ligne cessent d'être honorés jusqu'au `"` suivant.
   **Reproduit** en exécutant `lignesCsv` sur :
   ```csv
   titre,description
   Écran 5" pouces,un talk
   Autre talk,rien
   Troisième talk,rien
   ```
   → l'en-tête plus **une seule** ligne de données, dont l'unique champ est tout
   le reste du fichier. Ce bloc de 72 caractères passe sous `TITRE_MAX` : un
   talk-poubelle est écrit dans `speaker_talks`, « Autre talk » et « Troisième
   talk » sont perdus, et `ignorees` vaut `0`. Placé tôt dans un gros fichier, le
   titre fusionné dépasse 200 caractères et tout l'import est refusé sur
   « Aucun talk lisible dans ce fichier ». RFC 4180 traite un guillemet à
   l'intérieur d'un champ non quoté comme une donnée littérale ; ici il change le
   mode d'analyse. **Effort : S.**

6. ~~**La suppression RGPD efface le compte en base et laisse le contact chez
   Brevo (2026-08-16).**~~ **RÉSOLU le 2026-08-16.** La suppression complète vit
   dans `supprimerCompte()` (`src/lib/suppression-compte.ts`), unique porte
   d'entrée : contact du sous-traitant **d'abord**, base ensuite. La moitié SQL
   garde le nom `effacerCompteEnBase`, qui dit ce qu'elle ne fait pas — c'est le
   nom, et non la mémoire du prochain, qui empêche d'oublier le sous-traitant.
   (L'appel a d'abord été posé DANS `profiles.ts` ; deux revues indépendantes ont
   montré que ça faisait entrer le SDK Brevo dans le graphe de l'accueil, du
   sitemap et de l'annuaire — 551 modules, ~180 ms au démarrage à froid — et
   laissait cinq suites d'intégration à une variable d'environnement d'appeler
   vraiment le sous-traitant.)
   Deux chemins, pour respecter la cohabitation des trois populations de Brevo
   (`docs/conception-synchro-contacts.md`, section ajoutée) : le contact qui ne
   vit que par nous est **supprimé** ; celui qu'une autre liste porte (adhésion
   HelloAsso, écosystème) est **détaché** de `BREVO_LIST_COMPTES` avec nos
   attributs de ciblage vidés — le supprimer effacerait le travail d'un autre
   écrivain pour quelqu'un qui reste membre de l'association.
   L'ordre porte la règle : l'adresse est le seul moyen d'aller chercher le
   contact, donc une panne du sous-traitant fait RENONCER à la suppression
   (retentée par la passe du lendemain, dite à l'écran côté manuel) plutôt que
   d'effacer l'adresse et de perdre la trace. Vérifié par mutation : en retirant
   l'appel, deux tests d'intégration tombent ; en supprimant la branche
   « détaché », le contact d'une adhérente repart en suppression.
   Ce qui reste ouvert, et qu'on assume : `emailBlacklisted` d'un contact
   détaché appartient à Brevo (on ne le touche jamais), et un contact supprimé
   chez Brevo perd sa désinscription — si la personne recrée un compte, elle
   revient dans la liste. C'est le comportement de tout effacement.
   **Nouvelle pression, à surveiller** : la boucle de suppression de la passe
   fait désormais 2 appels HTTP par compte, en séquentiel, dans un cron déjà
   chargé (rappels + deux digests + jusqu'à 200 avertissements) et sans
   `maxDuration` déclaré. Un lot plein (`LOT_CONSERVATION = 200`) passe de
   quelques secondes à 1-3 minutes. Sans effet aujourd'hui — la file est vide
   jusqu'en 2028 — mais le jour du drainage de la cohorte migrée, il faudra une
   concurrence bornée, un plafond de suppression distinct de celui des
   avertissements, ou les deux. **Sorti en P2 le 08-21** (« Reliquats d'items P0
   soldés »), avec sa détonation.

7. ~~**Une proposition de conférence partagée est modifiée en place, ce qui
   republie les talks des autres occurrences (2026-08-16).**~~ **RÉSOLU le
   2026-08-16.** (Item réservé le même jour par la session import « pour une PR
   dédiée après le chantier Notist #326 » : il a été traité avant, rien à
   reprendre de ce côté.) `updateConferenceProposition` ne corrige plus en place
   que ce que la saisie appelante est SEULE à tenir ; sinon la saisie se détache
   sur sa propre proposition. Méthode et effets de bord assumés :
   `docs/conception-registre-conferences.md`, section « Corriger sa saisie ne
   réécrit pas celle des autres ».
   La revue d'altitude a trouvé, sur la même fonction, un **second trou de la
   même famille**, corrigé dans la foulée : la correction en place est une porte
   d'écriture qui ne portait AUCUN des arbitrages de l'autre porte. Renommer sa
   saisie vers un nom que l'orga avait écarté le remettait en file — le
   contournement déjà fermé pour l'écran « Propose-la ». L'état de la file se lit
   désormais avant toute écriture, sur tous les chemins.
   La revue de correction a ensuite attrapé une **régression du correctif
   lui-même** : `dejaEcartee` porte sur le nom TOUTES ANNÉES, alors qu'une
   proposition est datée. Refuser sur le nom seul gelait une saisie légitime
   (« Foo Conf 2023 » écartée empêchait de toucher à « Foo Conf 2025 » encore
   en attente, jusqu'au lien de slides), et l'écran se contredisait : pas de
   bandeau « écartée », mais un message qui l'affirmait. Le refus ne joue donc
   que si la correction fait entrer quelque chose de neuf dans la file.
   Vérifié par mutation, sept fois : `NOT EXISTS` retiré (3 tests), id de saisie
   plus transmis, refus du nom écarté retiré, garde de doublon retirée,
   exception du nom écarté élargie puis supprimée, exemption de quota retirée
   (1 à 2 tests chacun).
   **Reste ouvert, assumé** : quand une saisie seule-tenante rejoint une AUTRE
   proposition, celle qu'elle quitte reste en file avec zéro talk derrière —
   l'orga voit une ligne à arbitrer pour rien. Moins nocif que le doublon
   d'avant. Un ramassage des propositions à zéro occurrence reste à écrire :
   **rangé en P2 le 08-21** (« Reliquats d'items P0 soldés »).

8. ~~**Les listes fermées du code sont des `TEXT` libres en base — et deux
   lecteurs échouent OUVERT (2026-08-16).**~~ **RÉSOLU le 2026-08-21** pour les
   deux colonnes à lecteur fail-open, celles que l'item chiffrait (migration
   073) : `speaker_profiles.status` (un statut hors liste passait le
   `NOT IN ('masque','refuse')` de `src/lib/tremplin-public.ts` et EXPOSAIT
   bio, LinkedIn et site perso dans la galerie publique) et
   `user_memberships.status` (le `<> 'active'` de `src/lib/comptes-inactifs.ts`
   rangeait le compte dans la cohorte de **suppression** — et la table n'a
   AUCUNE porte applicative : elle se tient dans l'éditeur Neon). La base refuse
   à l'écriture, et **les deux lecteurs sont passés en liste blanche le même
   jour** (seconde passe, PR #350 — section P2 « Les deux lecteurs les plus
   sensibles étaient restés en négatif ») : le CHECK ferme la faute de frappe,
   la liste blanche ferme l'ajout légitime d'un statut. Miroirs TS :
   `PROFILE_STATUSES` et `MEMBERSHIP_STATUSES` (créé pour l'occasion,
   `src/lib/membership-status.ts`), tenus ensemble par
   `listes-fermees-sql.integration.test.ts` (PGlite sur le vrai `schema.sql` ;
   `sync-to-latest.sql` tenu par le drift). Vérifié par mutation, cinq fois :
   CHECK fiche retiré du seul schema (2 tests), un statut retiré des deux
   fichiers (1), CHECK adhésion retiré (1), bloc 073 retiré du seul sync
   (le drift), défaut passé à `'publie'` (1). Un test hérité re-jugé au
   passage : `comptes-inactifs.integration.test.ts` inventait un statut
   `'annulee'` pour éprouver la branche `<> 'active'` — remplacé par
   `'expired'` posé avant terme, même garde, valeur réelle.
   Le **reliquat sans lecteur fail-open connu** est descendu en P2 (section
   « Listes fermées : le reliquat sans lecteur fail-open »).

## 🟠 P1 — détonation connue : l'ouverture de la prochaine édition

> **Recalé le 2026-08-21** : « vérifié intact au 07-30 » avait cessé d'être
> vrai — deux items étaient déjà soldés par la refonte du récit d'édition
> sans que ce doc suive (le motif « le doc disait ≠ le code fait », encore).
> Le lot du 21/08 solde le reste. **Reste ouvert : la décision produit seule.**

- ~~**Blocs éditoriaux « 2026 » rendus pour toute édition.**~~ **RÉSOLU** —
  l'essentiel l'était **déjà** (constaté le 21/08, non daté) : la page
  d'édition gate FAQ, JSON-LD `FAQPage`, jury, prix et partenaires derrière
  `editorialDeCetteEdition`. Le lot du 21/08 a fermé le **dernier bloc qui
  fuyait** (`retoursPourTous`, rendu sur toute édition à palmarès) et partagé
  le prédicat (`estEditionEditoriale`, `src/data/tremplin.ts`) entre la page
  et la vitrine. La **cible (M)** — contenus par édition en base — reste une
  évolution possible, non nécessaire à la détonation.
- **[décision produit] « Inscriptions ouvertes » sans aucune action
  possible.** Aucun CTA d'inscription sur la page publique d'édition (flux
  100 % orga). Décider AVANT la prochaine ouverture : formulaire externe ?
  lien contact ? auto-inscription connectée ? **Effort : S-M** selon la
  réponse. **Le seul item encore ouvert du bloc — attend l'orga.**
- ~~**Dates d'inscriptions jamais affichées au public.**~~ **RÉSOLU** (déjà
  soldé par le récit d'édition, constaté le 21/08) : `recitEdition` affiche
  « Candidatures ouvertes jusqu'au … » (`src/lib/recit-edition.ts`).
- ~~**`/tremplin` figé sur 2026.**~~ **RÉSOLU le 2026-08-21** : la vitrine
  dérive l'édition mise en avant de `listEditionsPubliques` (ISR 300, repli
  éditorial complet si la base est injoignable) ; la phrase-preuve et le lien
  finalistes restent chez l'édition éditoriale. Banc :
  `tremplin-vitrine.test.tsx`.
- ~~**Sitemap : URL d'édition en dur.**~~ **RÉSOLU le 2026-08-21** : URLs
  dérivées de `listEditionsPubliques` ; « montée sur scène » listée par le
  prédicat source-unique du 404 (`aUnChapitreMonteeSurScene`). Banc :
  `sitemap.test.ts`.
- ~~**Lien mort dans la recherche interne.**~~ **RÉSOLU le 2026-08-21** : le
  lien FAQ dérive d'`editionEditoriale` (cliqueté dans
  `search-index.test.ts`).

### Annuaire (devenu le produit principal)

- ~~**`/speakeuses` : cacher la donnée, pas la page.**~~ **Soldé le
  2026-08-22.** La page reste `force-dynamic` (le vide de panne ne se fige
  jamais) ; la LECTURE est en `unstable_cache` (`lireAnnuaire` dans la page :
  tag `annuaire` + filet `revalidate: 300` qui borne une invalidation
  oubliée), et elle **jette en panne** — un rejet ne se mémorise pas, la
  dégradation noindex reste hors cache. Invalidation par
  `invaliderAnnuaire()` (`src/lib/annuaire-cache.ts`) dans les Server
  Actions : le helper `revalidatePublicProfile` (fiche, talks, nom, retrait —
  et, ajoutés par la passe simplify du lot : re-soumission d'une fiche
  publiée, photo LinkedIn, moisson à la demande), la suppression RGPD, la
  modération, l'import de talks, la validation d'une proposition de
  conférence. En **`updateTag`** (Next 16), pas `revalidateTag("max")` :
  expiration immédiate — une fiche masquée ou supprimée ne doit pas être
  servie « stale pendant que ça rafraîchit ». Les contextes où `updateTag`
  est interdit (dépôt d'avatar en route handler, crons moisson et
  conservation) passent par `invaliderAnnuaireDiffere()`
  (`revalidateTag("max")`, du périmé servi au plus une fois).
  `use cache`/Cache Components attendra le chantier ISR de la fiche
  ci-dessus (`unstable_cache` est remplacé mais supporté en Next 16).
- **Payload = tout l'annuaire sérialisé** (bio + texte complet des talks) vers
  le client, sans pagination ni virtualisation ; filtrage 100 % local. Croît
  linéairement avec le nombre de profils. Cible : filtrer `searchText` côté
  serveur (l'API `/api/search/speakeuses` existe) + paginer. **M**, à faire
  quand l'annuaire grossit.
- **`/speakeuses/[id]` en `force-dynamic`** : justifié (lit `auth()` pour
  l'encart orga), mais 99 % du trafic est anonyme. Cible : fiche publique en
  ISR + panneau de modération côté client. **Chantier.**
- ~~**Fiches publiées sans nom : l'invariant de #233 est prospectif** (tracé
  PR #233).~~ **Soldé le 2026-08-22.** Le diagnostic tenait : le chemin
  d'affichage utilisait `??` (qui laisse passer `""` et `"   "`) quand les
  gardes de publication testent `.trim()`. Le remède : `nomAffiche` est
  calculé **une fois au bord** (`mapRow`, projeté par `toPublicSpeaker`) via
  `nomAffiche()` de `profile-status.ts` (`trim` + repli titre + libellé
  générique), et les surfaces d'affichage le **lisent** au lieu de recalculer
  — 10 au total : la passe simplify en a trouvé 4 de plus que le lot initial
  (carte d'annuaire, corps de fiche, Person JSON-LD, recherche). Le backfill
  est remplacé par un signalement orga durable : la règle `nommer-fiche` du
  moteur (requête `getProfilesPubliesSansNom`), en **constat** — le nom est
  self-service, aucun geste d'orga ne referme la ligne (précédent « photos
  privées » 2026-08-17, confronté à l'écran par la 4e passe) — et **une
  ligne par fiche**, le roster affichant le repli qui masquerait le défaut.
  Second temps : 18 mutations, 18 tueuses ; retirer la règle du registre
  casse la **compilation** du digest (cliquet `AGREGATS`).
- **`btrim` SQL ≠ `trim()` JS sur les blancs exotiques** (relevé par la passe
  justesse du 2026-08-22, en soldant l'item ci-dessus). Postgres `btrim(text)`
  ne retire que l'espace U+0020 ; `String.trim()` retire tout blanc Unicode
  (`\t`, insécable…). Un `users.name` fait de tabulations : l'écran affiche le
  repli (`nomAffiche`, trim JS), la garde de publication #233
  (`src/lib/profiles.ts`, `setProfileStatus`) le juge « nommé », et
  `getProfilesPubliesSansNom` ne le signale pas. Cas quasi théorique (cohorte
  migrée : espaces simples). Cible : aligner requête ET garde #233 sur un même
  prédicat « tout blanc » (`u.name ~ '^\s*$'`), ensemble — la garde est
  sensible, ça mérite sa propre passe. Le double pg-mem du banc a déjà été
  rendu fidèle (espaces seuls) pour que le test ne mente pas. **S.**

### Robustesse

- **Flake E2E local élucidé, consigné pour mémoire (2026-08-16)** : sur le
  runner local (Chromium 1194 de l'image, PAS celui apparié à Playwright),
  « Importer la sélection » reste parfois sur « Import en cours… ». Mesuré :
  l'action serveur répond TOUJOURS (< 60 ms, 12/12 pendant l'échec), et le
  navigateur REÇOIT le 200 (journal réseau) — la réponse se perd dans son
  application côté client, au milieu d'annulations de préchargements `_rsc`.
  La CI (Chromium officiel, workers=1) est verte de façon répétée : défaut
  d'outillage local, pas du produit. Si ça apparaît en CI un jour : rejouer
  le journal réseau (page.on("response")) avant toute autre hypothèse.
- **« Un seul CTA principal par page » tenu à la main, leaf par leaf** : la
  règle d'or n'a aucune garde structurelle — chaque `Button`/`SubmitButton`
  sans `variant` retombe en `primary` (défaut de `Button.tsx`), et la passe
  du 15/08 sur « Mes talks » a dû rétrograder QUATRE boutons un par un (dont
  un « Confirmer » par suggestion, oublié des passes précédentes). Précédent
  à copier : `barre-action-collante.test.ts` scanne les sources et interdit
  le `sticky bottom-*` manuel. Faire pareil ici (compter les aplats primaires
  par sous-arbre de route), ou retirer le défaut `primary` pour que l'aplat
  soit toujours une décision écrite. **Effort : M.**
- **Deux patterns de « page liste + action de création »** :
  `ListPageTemplate` (slot `create` permanent, état vide en texte qui pointe
  le bouton — ~5 pages admin) et l'en-tête à la main de `/mon-espace/talks`
  (paire `TalksActions` dans l'en-tête, qui BASCULE dans la carte quand la
  fiche est vide). Deux réponses à la même question, la plus récente étant la
  bespoke ; la prochaine page liste ne sait pas laquelle copier. Trancher,
  puis porter le choix dans `ListPageTemplate` (slot `actions` d'en-tête ou
  bascule d'état vide) et y ramener « Mes talks ». **Effort : M.**
- **Deux copies manuscrites du pattern combobox ARIA** : `SearchBar.tsx`
  (recherche ⌘K) et `ConferenceCombobox.tsx` (choix de conférence, 2026-08)
  portent chacune ~100 lignes de la même mécanique (état ouvert/fermé,
  aria-activedescendant aux flèches, sélection au mousedown-preventDefault,
  région vivante du compte). Une correction du pattern (défilement de l'option
  active, contraste du surlignage…) doit aujourd'hui se poser deux fois et
  divergera. Extraction d'un hook `useCombobox` partagé — refusée à chaud dans
  le lot combobox pour éviter de churner SearchBar (éprouvé, testé) dans une PR
  d'UX ; à faire à froid, avec les tests des DEUX composants comme filet.
  **Effort : M.**
- **La garde `nouvelleSoumise` d'`AddEditionDialog` n'a aucun test** (empêche
  de restaurer le slug d'une conf existante → édition sous la mauvaise URL,
  irréversible ; l'invariant vit dans un commentaire de
  `ConferenceFields.tsx`). Idem protocole de régions vivantes d'`AdminDialog`.
  Testable en jsdom (`showModal` polyfillé dans les tests de modales
  existants). **Effort : M** (prioriser `nouvelleSoumise`).
- **`french-spelling.test.ts` ne peut pas attraper ce qu'il doit imposer** :
  13 imports en dur (un nouveau fichier `src/data` n'est jamais scanné), pas
  de scan du JSX de `src/app`/`src/components`, aucune règle cadratin alors
  que CLAUDE.md l'interdit. Chantier délicat, **à faire à la main, PAS en
  autonome** : un scan brut du `—` est inexploitable (légitime dans les
  commentaires de code, ~150 occurrences) ; la règle doit extraire le texte
  AFFICHÉ (nœuds JSX + littéraux `src/data`). Les 4 cadratins de
  `tremplinSteps` (affichés en prod sur `/tremplin`) sont de la copie
  marketing : remplacement = décision de ton à faire trancher par la cliente.
  **Effort : M.**
- **Une source de recherche en panne le reste jusqu'au rechargement de la
  page.** `fetchSource` (`src/components/SearchBar.tsx`) avale l'échec réseau
  ET le `!res.ok`, et rend `[]`. Comme le Fuse est mémoïsé au niveau du module,
  un 500 passager de `/api/search/speakeuses` ou `/api/search/contenus` est figé
  pour toute la session de page : la loupe cherchera dans l'index amputé,
  silencieusement, jusqu'au prochain chargement dur. Le commentaire
  « échec d'init → nouvel essai à la prochaine frappe » ne vaut en fait que
  pour un échec d'`import("fuse.js")`, seul cas qui rejette le `Promise.all` et
  remet `fusePromise` à `null`.
  Antérieur au lot « contenus dans la recherche » (PR #283), qui n'a fait
  qu'ajouter une deuxième source au même mécanisme, et relevé par sa revue de
  correction. Aucune urgence : la dégradation est le comportement voulu (la
  recherche est un confort), c'est sa PERSISTANCE qui est de trop.
  Cible : distinguer « source vide » de « source en échec », et ne mémoïser que
  le succès — un échec laisse la source retentée à la prochaine ouverture de la
  palette. **Effort : S.**
- **`excerpt` du digest orga coupe encore au milieu d'un mot et d'un emoji.**
  `src/lib/digest-email.ts` fait `uneSeuleLigne(body)` puis un `slice` brut.
  `couperSurUnMot` (`src/lib/texte-markdown.ts`, ajouté par la PR #283) est un
  sur-ensemble strict : même passe-plat sous la limite, même ellipse, plus la
  frontière de mot et la paire de substitution. Les deux défauts que la palette
  a corrigés vivent donc encore à un fichier de leur remède. Écarté du lot
  recherche parce que le digest est hors de son périmètre et que la sortie de
  l'e-mail changerait. `excerpt` devient
  `couperSurUnMot(uneSeuleLigne(body), EXCERPT_LEN)`. **Effort : XS.**
- **`couperSurUnMot` est filé sous « markdown » alors qu'il n'en fait pas.**
  C'est une troncature de chaîne pure ; sa place est à côté d'`uneSeuleLigne`
  dans `src/lib/format.ts`, où vit déjà la logique de coupe du projet. Le
  déplacement conditionne le point précédent (on ne délègue pas depuis un
  module e-mail vers un module « markdown »). **Effort : XS.**
- **Deux tables de couleurs par catégorie, qui divergent déjà.**
  `COULEURS_TAG` (`TagBadge`) rend « Behind the Scenes » en magenta sur
  `/actualites` et l'en-tête d'article ; `categoryColors` (`SearchBar`) le rend
  en cyan dans la palette. C'est délibéré — la palette colore la NATURE du
  résultat, la chip colore la catégorie — mais rien ne le dit aux deux endroits,
  et ajouter une catégorie demande d'éditer deux tables et deux tests de
  couverture presque identiques (`data-integrity.test.ts`,
  `search-bar.test.tsx`). À trancher : soit assumer et croiser les commentaires,
  soit une seule source avec deux vues. **Effort : S.**
- **Squelette copié-collé des actions redirect** dans
  `src/app/admin/tremplins/actions.ts` (**2 610 lignes**, 54 actions,
  97 `revalidatePath`, chiffres recalés le 2026-10-16 ; le détail qui suit
  n'a pas été relu ce jour, sauf `editionBase` : 5 appels, et
  `revaliderEditionPartout` : 3 appels). Le découpage par sujet proposé par
  `docs/audit-reprise-humaine.md` §4.4 (PR 3a) le solderait dans le geste.
  Constat d'origine : 4 suppressions PRG + 2 actions talk sur le même
  préambule recopié ; `editionBase` ne retourne pas l'`editionId` (re-parse
  commenté 4×) ; le helper `revaliderEditionPartout` existe mais n'est
  utilisé que 3 fois. Faire retourner `{ base, editionId }` et généraliser le
  helper. **Effort : S/M** (refactor sûr, les redirects sont testés).

## 🟡 P2 — nice-to-have

### Navigation connectée : ce que la refonte du 2026-10-15 laisse ouvert

Relevé par les quatre passes de revue de la PR (rail bureau, onglet « Ma
fiche », fenêtre « Une date »). Rien de bloquant ; chaque item dit son effort.

- ~~**À trancher (Cateline) — l'onglet-photo s'allume « Ma fiche » hors de la
  fiche.**~~ **TRANCHÉ et SOLDÉ le 2026-10-15, dans la même PR (#382)** :
  « Ma fiche » ne s'allume que sur la fiche (et ses sections) et les talks ;
  ailleurs (réglages, messages, `/admin`…), aucun onglet ne s'allume. Cela
  remplace le repli de l'audit C5 (2026-08-15) pour ce nom : sous « Profil »,
  le repli était vrai ; sous « Ma fiche », il ne l'était plus. Gardé par
  `src/__tests__/bottom-nav.test.tsx` (« hors de la fiche et des talks, aucun
  onglet ne s'allume »), cassé une fois dans chaque sens. Sur bureau, le rail
  allume l'entrée exacte. L'onglet « Mon profil » des comptes sans fiche
  possible garde le repli du « moi », où son nom reste juste.
- **Le registre des conférences voyage à chaque visite de la fiche.**
  `src/app/mon-espace/fiche/page.tsx` lit `getOccurrenceSuggestions()` (4
  requêtes, ~110 Ko bruts / 15-20 Ko gzip dans la charge RSC) pour les
  fenêtres « Une date », que la plupart des visites n'ouvrent pas. Lu en
  parallèle des talks et sous filet depuis la revue. Pistes mesurées par la
  passe efficacité : `unstable_cache` + tag invalidé par les écritures du
  registre (précédent `src/app/speakeuses/page.tsx`), et la promesse lue par
  `use()` dans la fenêtre. **Effort : S.**
- **La fenêtre `<dialog>` existe en trois copies** : `FeuilleCreer`,
  `AjoutDateRapide`, `src/app/admin/tremplins/[edition]/AdminDialog.tsx` —
  même chaîne « feuille par le bas / carte centrée », même × et même couple
  `fermer` + `onClose`. Une constante `FEUILLE_DIALOG` (patron `ONGLET_BARRE`)
  et un `BoutonFermer`. Le motif « un élément → lien, plusieurs → étape de
  choix + Retour » est aussi recopié dans `FeuilleCreer` (talks, ateliers).
  **Effort : S.**
- **Le bouton « Une date » vit sous la carte, pas dedans.**
  `src/components/FicheSpeakeuseCorps.tsx` (slot `actionTalk`) : 8 px de sa
  carte, 12 px de la suivante, il peut se lire rattaché au talk du dessous ; et
  N boutons d'aspect identique sur l'écran (§6, atténué par le nom
  accessible). Dans `TalkCard`, à côté de « Modifier ». **Effort : S.**
- **Deux noms pour `/mon-espace` sur bureau** : « Mon espace » (menu du compte,
  `AccountMenu.tsx`) et « Accueil » (rail), visibles ensemble (COGA « un seul
  mot par concept »). Et « Ma fiche » (onglet, rail, menu) contre « Ma fiche
  publique » (titre, fil d'Ariane « Mon profil › Ma fiche publique », qui
  décrit encore la fiche SOUS le profil). **Effort : XS, décision de mots.**
- **La fenêtre « Une date » ouvre son focus sur « Fermer »**, premier
  focalisable ; un `autoFocus` sur « Conférence » épargne une tabulation au
  geste qui se veut à un appui. Et les confirmations de deux talks peuvent
  rester affichées ensemble (une région `role="status"` par talk). **XS.**
- **Croisé, hors diff** : « Pour aller plus loin » sur la fiche est en
  capitales forcées 10 px à interlettrage élargi (checklist COGA « Ce qui se
  lit ») ; le champ Ville a un texte indicatif « Toulouse » qui ressemble à
  une valeur, trompeur dans une fenêtre où la ville se remplit d'elle-même.
  **XS.**

### Adhésions HelloAsso : ce qui reste à vérifier (2026-10-15)

- ~~**Deux hypothèses sur l'API, à vérifier sur la première vraie commande**~~
  **SOLDÉ le 2026-10-15**, vérifié en production sur l'adhésion de Cateline :
  l'adresse de l'adhérente arrive bien dans `customFields` (`emailsDuMembre`),
  et l'état d'une adhésion gratuite est reconnu (`articles: 1` lu, puis
  `comptes: 1` une fois l'adresse corrigée sur HelloAsso et le bon compte
  Google relié). La première lecture disait `sansCompte: 1` : adresse saisie
  différente de celle du compte, cas que la page `/admin/adhesions` explique
  désormais.
- **`accounts.email` : le branchement n'a pas de test de montage.** La pièce
  (`rafraichirJetonProvider`, `src/lib/accounts.ts`) est testée contre la base ;
  le passage de `profile.email` depuis le callback `jwt` de `src/auth.ts` ne
  l'est pas — une connexion OAuth réelle ne se joue pas en E2E. Les comptes
  déjà reliés gagnent leur adresse à leur prochaine connexion seulement. **S**
  si on veut un test du callback isolé.
- **Les fiches à adresse `.invalid` (cohorte de migration) sont hors de la
  règle.** Sans adresse joignable, aucun préavis ne leur part, donc aucune
  pause (`fichesAPrevenir`, `src/lib/annuaire-adhesion.ts`) : elles restent
  dans l'annuaire réservé aux membres sans adhésion. Conforme à « jamais de
  pause sans préavis », mais à trancher par Cateline avant l'allumage
  (roadmap). **XS** une fois tranché.
- **« Mettre en retrait » se dit « à ta demande » côté membre**
  (`src/app/mon-espace/fiche/page.tsx`, `PROMESSE_PAR_STATUT.masque`) alors
  que l'orga peut aussi mettre une fiche en retrait (`ModerationPanel`). Relevé
  par la revue UX du 2026-10-15, antérieur à cette PR. **XS.**
- **Deux envois par lot jumeaux** (revue /simplify du 2026-10-15) :
  `src/app/admin/adhesions/inviter/InviterLot.tsx` recopie
  `src/app/admin/speakeuses/relances/RelancerLot.tsx` (popup de confirmation,
  piège `AlertDialog.Action` commenté deux fois), et les deux `Retour` de page
  se ressemblent. Un composant `ConfirmerEnvoiLot` les réunirait. **S.**
- **« Envoyer puis marquer, un par un » en quatre copies** :
  `inviter/actions.ts` (réserver, envoyer, libérer), `relances/actions.ts`,
  et les préavis et relances de `src/lib/passe-adhesions.ts`. Un helper
  `envoyerUnParUn` porterait la règle une fois. Touche des écritures :
  dans une PR à part, avec sa revue. **S.**
- **Une invitation à adhérer peut se perdre sans trace** (revue du
  2026-10-15) : la fiche est réservée AVANT l'envoi (`reserverInvitationAdhesion`,
  `src/lib/annuaire-adhesion.ts`), pour qu'aucun double clic n'écrive deux fois.
  Si la fonction serveur est coupée entre la réservation et l'envoi (délai
  maximum), la fiche reste marquée invitée sans avoir rien reçu, et sort de la
  liste. C'est le prix choisi du « au plus une fois » : une fiche au plus par
  coupure, visible seulement dans les logs. Remède possible : une date
  d'envoi confirmé distincte de la réservation. **S.**
- **Le tarif « 10 € » écrit en dur** à quatre endroits
  (`src/lib/adhesion-email.ts`, `src/lib/invitation-email.ts`,
  `src/data/adhesion.ts` deux fois) : une constante le rendrait modifiable à
  un seul endroit le jour où le collège le change. **XS.**
- **`dateLongueFr` formate en UTC** : juste pour une colonne `DATE`, faux de
  quelques heures pour un horodatage (paiement à 0 h 30, heure de Paris, daté
  de la veille). Les dates d'adhésion passent par `dateLongueParis` depuis le
  2026-10-15 ; les autres appelants sur des `TIMESTAMPTZ` sont à relire
  (à vérifier, 2026-10-15). **XS.**
- **Le rôle orga est figé dans la session** (`isOrga` posé dans le JWT à la
  connexion) : une orga à qui on retire le rôle garde l'accès, envoi en masse
  compris, jusqu'à sa reconnexion. Antérieur, relevé par la revue sécurité du
  2026-10-15. **S** (relire le rôle en base sur les actions d'envoi).
- **La notification relit tout l'historique** à chaque adhésion
  (`traiterNotificationHelloAsso`, `src/lib/passe-adhesions.ts`) : choisi pour
  n'avoir qu'un calcul. À quelques centaines d'adhésions par an, c'est quelques
  appels ; à reprendre si le volume change d'ordre. Le limiteur de débit de la
  route est en mémoire, par instance (`src/lib/rate-limit.ts`) ; si la clé de
  l'URL fuyait, un rejeu épuiserait le quota d'API (revue sécurité du
  2026-10-15 : dédoublonner par commande, une synchro à la fois). **S.**
- **Deux relectures HelloAsso peuvent se croiser** (revue du 2026-10-15) :
  cron, notification, invitation et bouton lancent la même synchro
  (`synchroniserDepuisHelloAsso`, `src/lib/passe-adhesions.ts`) sans verrou
  entre elles. Chacune écrit l'état complet de HelloAsso, donc la dernière
  arrivée gagne avec des données justes ; le risque est un double appel
  d'API, pas une donnée fausse. Seul le bouton est freiné (une minute). Un
  verrou consultatif Postgres (`pg_try_advisory_lock`) le réglerait. **S.**
- **Le bilan ne garde que le DERNIER passage** (`bilan-adhesions.ts`) : un
  cron du soir en échec, suivi d'une notification réussie, disparaît de la
  page. Accepté : le passage suivant a relu tout HelloAsso, l'état est juste ;
  ce qui se perd, c'est la trace de l'échec. À reprendre si un échec répété
  passe inaperçu (garder le dernier échec à part). **XS.**

### ~~Le décor E2E garde une ANNÉE fixe pour l'édition « en cours » (2026-10-14)~~ — SOLDÉ le 2026-10-14 (PR #368)

`db/seed-preview.sql` déclare `date_conf = CURRENT_DATE + 37` et
`n = EXTRACT(YEAR FROM date_conf)` : l'édition en cours s'appelle « Tremplin
DevFest N », l'archivée N-1 (dates par `make_date(n - 1, …)`, toutes passées
puisque N bascule le 25 novembre), celle en préparation N+1. L'édition de
conférence N porte le même jour que `conf_date` (plus de DevFest à deux dates),
et un seed rejoué recale les dates d'une édition de conférence déjà là. Côté
e2e, `e2e/decor.ts` exporte `ANNEE`, `DATE_CONF` et `EDITION`, lus par
`pages-publiques.ts`, `parcours-import.spec.ts` et `parcours-talks.spec.ts`.
Gardes : `seed-preview-dates.test.ts` (aucune année en dur dans le code du
seed, décalage égal des deux côtés). Restent volontairement en dur les
redirections legacy de `e2e/contrat-http.spec.ts` (`/tremplin/2026` →
`/tremplin/devfest-toulouse/2026`) : elles gardent des URL figées dans le code
de prod (`src/app/tremplin/2026`, `src/app/tremplin/participantes`), pas le
décor. La purge du seed couvre N-3 à N+1 : un décor de plus de trois ans laisse
ses éditions, sans effet sur les specs.

### `/partenaires` : une régénération ISR concurrente peut masquer un accord (2026-10-14)

`src/app/partenaires/page.tsx` (`revalidate = 300`) est bien revalidée par
chaque geste sur l'accord d'une accompagnante (`src/app/admin/tremplins/actions.ts`,
`PUBLIC_PARTENAIRES_ROUTE`). Mais quand deux gestes se croisent, la page
régénérée pour le PREMIER peut être calculée avant que le SECOND soit écrit,
puis servie comme fraîche. Mesuré avec
`e2e/parcours-tremplin-orga.spec.ts:326` : 0 échec sur 30 en série, 1 sur 30 avec
6 workers (la page citait l'accompagnante d'un autre worker, pas la sienne).
La CI joue en série, elle ne le voit donc pas. En production, il faut deux
gestes d'orga dans la même fraction de seconde, et c'est rattrapé en 5 minutes
au plus. Le sens qui compte est le RETRAIT d'un accord : un nom peut rester
affiché jusqu'à 5 minutes. Cause exacte dans Next.js : hypothèse, à vérifier.
Remède à étudier : lire la liste par `unstable_cache` taguée, et invalider le
tag, comme `src/lib/annuaire-cache.ts`.

### La mention « Propulsé par Tech Speak'Her » n'existe que dans les docs (2026-08-23)

`TRADEMARK.md` fait de l'attribution « Propulsé par Tech Speak'Her » une
condition des déploiements que nous autorisons, et le README l'annonçait même
comme « présente par défaut dans le pied de page ». Elle n'est nulle part :
`src/components/Footer.tsx` porte deux colonnes de liens et les réseaux, rien
d'autre. Le README est recalé (la promesse est partie avec la section « Monter
votre propre tremplin »), et la condition ne vaut désormais que pour un
déploiement autorisé — il n'y en a aucun. Reste à écrire la mention le jour où
une première autorisation est donnée, sinon celui qui la reçoit n'a rien à
conserver. **Effort : XS.**

### Reliquats d'items P0 soldés — sortis de l'historique le 2026-08-21

Deux tâches chiffrées ne vivaient que **dans le corps d'items barrés** : lisibles
en dépliant l'historique, invisibles de qui lit ce qui reste à faire. Un item
barré ne doit rien garder d'ouvert (règle : `CLAUDE.md` §Clore une session).

- **Le cron de suppression n'a pas de concurrence bornée** (reliquat du P0-6,
  `src/app/api/cron/*` + `src/lib/suppression-compte.ts`). La boucle fait
  2 appels HTTP par compte, en séquentiel, dans un cron déjà chargé (rappels,
  deux digests, jusqu'à 200 avertissements) et sans `maxDuration` déclaré : un
  lot plein (`LOT_CONSERVATION = 200`) passe de quelques secondes à 1-3 minutes.
  **Sans effet aujourd'hui** — la file est vide jusqu'en 2028. **Détonation : le
  drainage de la cohorte migrée**, à traiter AVANT. Concurrence bornée, ou
  plafond de suppression distinct de celui des avertissements, ou les deux.
  **Effort : S.**
- **Une proposition qui perd sa dernière occurrence reste en file** (reliquat du
  P0-7, `src/lib/conference-propositions.ts`). Quand une saisie seule-tenante
  rejoint une AUTRE proposition, celle qu'elle quitte reste à arbitrer avec zéro
  talk derrière : l'orga voit une ligne pour rien. Moins nocif que le doublon
  d'avant, assumé à la correction du 08-16. Un ramassage des propositions à zéro
  occurrence reste à écrire. **Effort : XS.**

### ~~Les deux lecteurs les plus sensibles étaient restés en négatif~~ — SOLDÉ le 2026-08-21 (PR #350)

Le lot 073 a fermé les listes en base et retourné le consentement moissonneur en
liste positive, mais **deux lecteurs sur trois sont restés écrits en négatif**,
avec le CHECK pour justification (« la liste est fermée par la 073, `expired`
est le seul statut non actif possible ») :

- `comptes-inactifs.ts` — `m.status <> 'active'`, sur la **cohorte de
  suppression** ;
- `tremplin-public.ts` — `sp.status NOT IN ('masque','refuse')`, sur
  l'**exposition publique** de bio, LinkedIn et site perso.

Le raisonnement tient pour la valeur illisible d'aujourd'hui, pas pour le
statut qu'on ajoutera **légitimement** demain : lu en négatif, il entre tout
seul du mauvais côté. Les deux passent donc par `sqlDansListe` et les listes
dérivées que le lot avait déjà créées (`ADHESION_STATUTS_PERIMES`,
`STATUTS_FICHE_JOINTE`) — les pièces existaient, elles n'étaient pas branchées.
Chacun est désormais gardé par un cas qui joue une valeur hors liste (contrainte
retirée le temps de l'écrire) : mutation faite, chaque clause remise en négatif
fait tomber son cas.

Même chose côté consentement : les requêtes du moissonneur dérivaient bien du
`Record`, mais la garde du Server Action « repérer maintenant » et la case
pré-cochée du formulaire comparaient encore en dur à `"aucun"` — dont un
`!== "aucun"`. Un quatrième mode aurait ouvert le moissonnage et pré-coché la
case sans décision. `moissonnageConsenti` est exporté et appelé aux deux
endroits.

### Listes fermées : le reliquat sans lecteur fail-open (2026-08-21)

- Reliquat du P0-8 (les deux colonnes à lecteur fail-open sont fermées par la
  073). Restent des `TEXT` libres sans CHECK, sans lecteur en négatif connu :
  `tremplin_registrations.statut`, `talk_suggestions.statut`,
  `contact_messages.status`, `speaker_profiles.cfp_sync_mode` (consentement
  moissonneur), et les `type` ouverts (`conferences.type`,
  `conference_editions.type`). Même mode opératoire déclencheur : une écriture
  à la main dans l'éditeur Neon. Le mécanisme est prêt à répliquer colonne par
  colonne : CHECK nommé dans les trois fichiers SQL, miroir TS, et une entrée
  de plus dans la table `CAS` de `listes-fermees-sql.integration.test.ts`.
  **Effort : S**, en une seule migration le jour où on traverse la zone.
- Relevé par la passe sécurité de la 073, **soldé le 2026-08-21** (PR #350) :
  les deux lecteurs sensibles (`src/lib/tremplin-public.ts`,
  `src/lib/comptes-inactifs.ts`) lisent désormais des listes blanches
  (`sqlDansListe`), donc l'AJOUT LÉGITIME d'un statut ne les traverse plus tout
  seul. Reste debout, et c'est du travail de tête : **re-juger
  `STATUTS_FICHE_JOINTE` et `ADHESION_STATUTS_PERIMES` à chaque extension de
  `PROFILE_STATUSES` ou `MEMBERSHIP_STATUSES`** (HelloAsso est le déclencheur
  annoncé côté adhésions) — une liste blanche protège d'un oubli, pas d'une
  décision prise trop vite. Les commentaires-cliquets des deux fichiers, restés
  à décrire la lecture en négatif, ont été redressés le 2026-08-21.

### ~~L'archive et l'aperçu du passé lisent deux fois la même chose~~ — SOLDÉ le 2026-08-21

Croisé en corrigeant l'aperçu du passé de `/agenda` (§7.1 de
`docs/audit-ux-agenda-2026-08.md`). `getAnneesArchive` et `getApercuPasse`
(`src/lib/agenda-public.ts`) posaient **la même requête** puis appliquaient
chacune sa règle « passé ». Les deux lisent désormais `lireScenesPassees` : une
seule requête, **un seul verdict sur « passé »**. C'était le vrai enjeu, plus
encore que la duplication — l'invariant « l'aperçu voit exactement ce que
l'archive compte » tenait par coïncidence tant que chacune décidait pour elle, et
c'est en divergeant qu'elles ont fait annoncer à la page une carte absente.

**Cette entrée a d'abord été refusée pour une raison fausse, et c'est ce qu'elle
apprend.** Le 18/08, la factorisation a été écartée au motif que la garde
« mémoire complète » n'existait pas — *parce que la liste §7 de l'audit la disait
encore à écrire*. Elle existait depuis le lot 2 : `e2e/agenda.spec.ts`,
« MÉMOIRE COMPLÈTE ». Un plafond de douze remis dans la lecture partagée la fait
tomber sur les deux tailles d'écran ; vérifié le 21/08 avant de toucher au code,
pas après.

**La règle qui en sort** : un doc de suivi qu'on ne raye pas ne se contente pas
de vieillir, il **bloque** — il fait refuser un geste sûr. Une liste de « gardes
à écrire » se relit **contre le code**, jamais contre elle-même. C'est le motif
« le doc disait ≠ le code fait » de l'en-tête de ce fichier, retourné contre nos
propres notes.

Le `maxPassees` de `separerScenes` (12 par défaut) reste ce qu'il était : une
borne d'**affichage**. La lecture partagée passe explicitement
`Number.POSITIVE_INFINITY`, et son commentaire dit pourquoi — sans quoi le
prochain passage lira ce défaut comme une valeur raisonnable.

### Sans JavaScript, toute page derrière un `loading.tsx` reste sur son repli (2026-08-18)

- Constaté en écrivant le test « filtrable sans JS » promis par la conception
  de « À faire » (§5) : JS coupé, l'écran reste sur « Chargement de la
  page… ». Le contenu EST dans le HTML streamé, mais le remplacement du repli
  de `loading.tsx` passe par les scripts de streaming de l'App Router — sans
  eux, rien ne se révèle. Ça vaut pour **toutes** les pages derrière un
  `loading.tsx`, pas pour « À faire » en particulier.
- Ce qui est gardé à la place (`e2e/espaces-connectes.spec.ts`) : le HTML servi
  contient la vue filtrée entière et son retour — le filtre est calculé par le
  serveur depuis l'URL, aucun JS ne le calcule. La promesse « sans JS » au
  sens strict demanderait de retirer les `loading.tsx` (au prix du streaming)
  ou d'attendre mieux de la plateforme : à trancher seulement si un vrai
  public sans JS se présente. **Effort : décision, pas code.**

### ~~La barre basse tombe avec `getFeuilleDonnees`, alors que le point, lui, a son filet (2026-08-18)~~ — RÉSOLU le 2026-10-15

- **Soldé dans la refonte de la navigation connectée** : `NavEspaceServeur`
  (ex-`BottomNavServeur`) pose le même `.catch` sur la feuille que sur le
  point, avec un repli neutre (`FEUILLE_NEUTRE` : aucune création, aucune porte
  de rôle) et une trace `console.error`. Gardé par
  `src/__tests__/nav-espace-serveur.test.tsx` (« la feuille JETTE… »), cassé
  une fois : sans le `.catch`, le test tombe. L'enjeu avait grandi : la même
  lecture alimente désormais aussi le rail bureau, et lit les titres de talks.
  Énoncé d'origine :

- Relevé par la passe simplification du lot 6. Dans `BottomNavServeur`, le
  signal du point porte un `.catch(() => false)` — « la barre n'a pas le droit
  d'emporter chaque écran avec elle » — mais la branche jumelle du même
  `Promise.all`, `getFeuilleDonnees` (trois lectures DB), est **sans filet** et
  le précédait : une base injoignable emporte quand même chaque écran des deux
  layouts, point ou pas. Correctif : un repli neutre pour la feuille ➕ (elle
  sait déjà se rendre sans éditions), même geste que le point. **Effort : S.**

### Accord photo : trois états fondus en deux, et l'écran relance après un refus (2026-08-17)

Relevé par la relecture sécurité/RGPD du lot « un point, pas un compteur ». La
tâche « À faire » est corrigée ; **l'écran d'arrivée porte encore le défaut**.

- `couverte` vaut `Boolean(reg_public)` pour une inscrite
  (`src/lib/tremplin-photos.ts`), et la page de la photo affiche « En attente de
  son accord » — alors que `registration.public = false` recouvre **trois**
  situations : jamais répondu, a refusé, **a retiré son accord** (RGPD art. 7-3).
  L'orga lit « en attente » et relance : sollicitation après retrait. Même
  chose sur `photos/page.tsx` (« elle n'est publiée qu'une fois l'accord de
  chaque personne recueilli »).
- **La donnée existe déjà** : `setRegistrationVisibility` journalise `accorde` /
  `retire` dans `tremplin_consent_log`, et `ConsentJournal` sait le lire. Trois
  états : « Elle a choisi de rester privée » si un `retire` est journalisé,
  « En attente de sa réponse » si le journal est vide, « Accord donné » sinon.
  Seules les personnes identifiées en **texte libre** demanderaient une colonne
  (leur `consentement` est un booléen sans journal). **Effort : S** côté
  inscrites, **M** avec le texte libre et l'écran de retrait côté participante.
- Ce lot est le préalable annoncé par le libellé « N photos restent privées » :
  il le **précisera** (« 2 photos privées à leur demande »), il ne le
  contredira pas.

### Une adresse e-mail peut s'afficher comme nom de personne sur une photo (2026-08-17)

- `TAG_SELECT` (`src/lib/tremplin-photos.ts`) fait
  `COALESCE(r.participante_nom, ru.name, ru.email, u.name, u.email, pp.nom_libre)` :
  un compte sans `name` **affiche son adresse** dans un sous-titre de liste.
  Écran orga uniquement, donc pas d'exposition publique — mais c'est le motif
  que `chargerEditionEntrees` évite explicitement pour les libellés de tâches,
  et la liste « À faire » **pointe maintenant cet écran** comme destination
  assumée du détail.
- Correctif : replier sur le repère non nominatif que `mapTag` a déjà en
  dernier recours plutôt que sur l'e-mail — `COALESCE(…, u.name, pp.nom_libre,
  'Personne n° ' || pp.id)`. Sur un écran scopé à l'édition, `Personne n° 12`
  identifie aussi bien. **Effort : S.**


### Dates de talk : le jour n'est pas validé contre son mois (2026-08-07)

- `buildTalkDate` (`src/lib/talk-date.ts`) borne l'année et le mois (1-12)
  mais accepte tout jour 1-31 : **« 2026-02-30 » ou « 2026-04-31 » se
  sauvegardent** depuis le formulaire de talk. En aval, chaque surface ment à
  sa façon : `formatTalkDate` affiche « 30 février 2026 » tel quel, et les
  chemins passés par `Intl` (via `new Date`) font ROULER la date (« 2 mars »).
  Le futur fil (conception v2, lot N2) devra s'en protéger (repli sur la date
  brute), mais le vrai correctif est amont : valider jour × mois ×
  bissextile dans `buildTalkDate`, décider du sort des dates déjà stockées, et
  couvrir `talk-date.test.ts` (aucun test n'existe sur ce cas). **S.**

### Agenda public : deux restes du P2 de l'audit UX (2026-08-18)

Relevés en §5 de `docs/audit-ux-agenda-2026-08.md`, laissés de côté par le lot 1
pour qu'il reste une PR lisible. Aucun n'est visible d'une visiteuse, les deux
coûtent une ligne à corriger :

- **`talkType` traverse le DTO sans jamais s'afficher.** `ScenePublique` le
  porte, et **aucun consommateur ne le lit** (vérifié le 21/08). `SceneCard` ne
  le rend pas (« une seule cible par carte », choix documenté). Soit on le sert —
  le badge de type existe déjà sur la carte de l'annuaire, et c'est la divergence
  la plus gênante entre les deux pages sœurs — soit on le retire du DTO
  (minimisation, comme la ville l'est déjà côté annuaire). Décider, plutôt que
  transporter. **S.**

  > **`lienConf` était cité ici, à tort depuis le lot 3 : il est retiré de cette
  > entrée le 21/08.** Il ne « traverse » plus rien — il porte l'`url` d'un
  > `Event` et l'`url` d'une `VirtualLocation` (`agenda-jsonld.ts`), et l'`URL:`
  > de chaque évènement du flux iCalendar (`agenda-ics.ts`). Le retirer du DTO,
  > remède que cette entrée proposait, **casserait ces trois usages**. La seule
  > question qui reste sur lui est celle de la CARTE : `SceneCard` ne l'offre
  > pas, et c'est le choix « une seule cible par carte ». Rien à solder.
- **Le jour répété à l'identique sous une même tranche.** Sur la capture de prod,
  six cartes portaient « JEUDI 19 » sous le même en-tête « NOVEMBRE 2026 ». Le
  raisonnement de `libelleJourScene` (ne pas répéter le mois sous son en-tête)
  s'arrête une marche trop tôt : sous une même tranche, un même jour mériterait
  de se dire une fois. Cas fréquent (une conférence rassemble plusieurs
  speakeuses le même jour), et il s'aggrave avec le volume. **S.**

### Deux champs de recherche jumeaux, deux formes tapées à la main (2026-08-18)

Relevé par la passe UX du lot 1 de l'agenda. `AgendaFiltres` et
`SpeakeusesFilter` portent le même champ, écrit deux fois : `rounded-full` +
loupe SVG + `placeholder-gray-light` + `py-2.5` d'un côté, `rounded-lg` sans
icône + `py-2` de l'autre. C'est exactement par là qu'a commencé la dette des
liens de prose (82 occurrences en 12 variantes), et c'est déjà ce qui a produit
un défaut : le libellé indicatif de l'agenda vivait en opacité, alors que
l'annuaire tenait la règle. Une forme partagée (classe exportée ou composant
`ChampRecherche`) réglerait la famille.

**La divergence penche du bon côté sur un point** : l'étiquette de l'agenda est
VISIBLE, celle de l'annuaire est `sr-only`. C'est la forme de l'agenda qu'il faut
propager, pas l'inverse. **S.**

### Une page d'année publie huit repères de navigation (2026-08-18)

`/agenda/2025` annonce un repère par MOIS (`TranchePeriode` rend une `<section
aria-labelledby>` par tranche), plus le titre, la liste et les autres années :
onze régions sur un écran qui n'a qu'un sujet. La liste des repères sert à
SAUTER ; elle devient ici une seconde table des matières. `axe` reste vert
(`landmark-*` est en `best-practice`), donc rien ne le signale.

La règle est écrite (`docs/principes-conception-ui.md` : « un groupe visuel n'est
pas un repère de navigation ») et le correctif connu : un `<div>` dont la liste
porte son nom par `aria-labelledby`. Ça touche `TranchePeriode`, donc les deux
surfaces de l'agenda ET « Mon agenda » : à faire d'un coup, avec la garde qui va
avec. **S.**

### Une panne de base rend un 404 sur une page d'année (2026-08-18)

`/agenda/[annee]` attrape l'échec de lecture, se retrouve avec zéro scène, et
appelle `notFound()`. Une base injoignable répond donc « cette année n'existe
pas » — sur une archive réelle, citée et indexée. `docs/principes-tests.md` §6
explique pourquoi `/speakeuses/[id]` laisse au contraire remonter un 500 : un 404
invite les moteurs à désindexer.

Préexistant (lot 2), mais le lot 1 rend ces pages citables, donc l'enjeu monte.
Correctif : distinguer « année vide » (404, juste) de « lecture impossible »
(page servie avec son mot d'attente, comme l'annuaire). **S.**

### Gestes destructifs (reliquat des lots #224/#231)

- **3 modales Radix encore codées à la main** (`RetirerFicheRow`,
  `RefuseSuggestionButton`, `InviteButton`) : même chrome que
  `ConfirmSubmitButton` recopié au caractère près, divergence sur
  `AlertDialog.Portal`, chacune re-documente le même piège. **S/M.**
- **Deux familles de « zone danger » dupliquées** : le bloc talks ×2
  (`talks/[id]` et `conference/[occId]`, identiques) ET un gabarit admin
  `<section aria-label="Zone danger">` recopié 3-4× (contenus, conférences,
  retrait participante). Le seuil de 3 est atteint côté admin : un composant
  `ZoneDanger` est justifié. Sept dispositions et trois noms pour la même
  famille de geste ; §10 des principes dit QUEL filet, pas encore OÙ. **M.**
- **Deux actions destructives sans confirmation** : « Délier » un provider
  (`mon-espace/connexions`) et « Mettre en retrait » (`ModerationPanel`, où
  le refus, lui, est confirmé — asymétrie visible dans le même fichier).
  Réversibles, mais effet public immédiat. **S.**
- **Déclencheurs destructifs de trois couleurs** (`danger` rouge, `ghost`
  orange, `ghost` cyan indistinct des liens « Modifier ») + cibles tactiles
  sous 44 px hors `min-h-[44px]` manuel. **S.**
- **Édition de conférence du référentiel** : palier 2 sans périmètre chiffré
  (« les talks reliés gardent leur libellé » — combien ?) alors que §10
  l'exige ; le critère de palier 3 pourrait l'attraper (occurrences d'AUTRES
  membres déliées). §10 ne tranche pas : à faire. **S.**
- **`DeleteAccountButton` : repli un-clic si le compte n'a ni nom ni
  e-mail** (`accepted = []` → non gaté), et le serveur a le MÊME trou
  (`attendus.length > 0 && …`). Inatteignable en pratique (l'e-mail vient
  d'OAuth ou du lien magique) ; un mot-clé fixe (« SUPPRIMER ») fermerait les
  deux côtés d'un coup. **S.**

### Restes de la migration « sujet → talk » (#158)

- **[décision produit] Confirmation d'une proposition backfillée** :
  `source='tremplin'` exclut le talk de l'annuaire et n'est jamais effacé
  (l'UPDATE d'édition ne touche pas `source`) — une speakeuse qui complète ce
  talk ne le verra jamais publié, sans explication. Trancher : « éditer =
  confirmer » ou bouton explicite. **S** une fois tranché.
- **returnTo / auto-pitch** : « Ajouter un talk » depuis le picker éjecte vers
  l'espace général sans auto-désigner le talk créé. **S.**
- **Avertir avant « Aucun » sur une inscription publique** : l'auto-save du
  picker vide aussitôt le titre en galerie ; `PitchedTalkPicker` ne reçoit
  même pas `registration.public` (à faire descendre d'abord). **S.**
- **Nommage DTO mi-chemin** : `RegistrationDetails.talkTitre` (admin) vs
  `.sujet` (`PublicFinalist`/`PublicAward`, `CoachCoachee`). À aligner d'un
  bloc ou assumer. **S.**

### `ouvert_a_toutes` : la phase CONTRACT reste à faire

> Ajoutée 2026-08-01, avec la migration 051 (audience d'un atelier).

`audience` est désormais la seule source de « qui voit cet atelier ». La colonne
booléenne `ouvert_a_toutes` reste en base, tenue en MIROIR par `setAtelierAudience`,
parce que la règle expand/contract du projet fait passer la migration AVANT la
livraison du code : l'ancien code la lit encore le temps de la bascule.

Une fois la livraison en prod depuis quelques jours, une migration `ALTER TABLE
tremplin_ateliers DROP COLUMN ouvert_a_toutes` la retire. Liste EXHAUSTIVE de ce
qui tombe avec elle (recensée à l'outil, cf. le recalage ci-dessous) :

- l'écriture miroir de `setAtelierAudience` (`tremplin-ateliers.ts:316`) et celle
  de `createAtelier` (`:515`) ;
- la colonne dans `COLS` (`:235`) et le champ de `AtelierRow` (`:203`) — `mapRow`
  ne la mappe déjà pas, donc chaque `getAteliersByEdition` lit pour rien ;
- la colonne dans `db/schema.sql` et `db/sync-to-latest.sql` ;
- le test d'intégration dédié (« la colonne miroir `ouvert_a_toutes` suit
  l'audience »), écrit exprès en un seul bloc pour être supprimé d'un tenant ;
- les deux autres tests lecteurs : `tremplin-phase3-seed.integration.test.ts`
  (`:49`, `:57`, `:79`) et `migration-atelier-ouvert.integration.test.ts` (qui
  rejoue la migration 031 — à retirer avec elle).

**S**, pas XS : sept endroits, dont deux tests.

> **Recalage 2026-08-01.** Cette entrée disait « plus aucun code ne la lit »,
> vérifié en `grep ouvertAToutes` — en camelCase, alors que la colonne est en
> snake_case. Trois lectures vivantes restaient, dont une **règle d'accès** :
> `getSharedDocumentsVisiblesPour` filtrait l'onglet « Documents » sur
> `ouvert_a_toutes`, donc sans branche `audience = 'phase'` — les supports du
> coaching de la phase 3 avaient disparu de cet onglet pour les inscrites qui les
> voyaient dans l'espace de l'édition. Corrigé (la requête dérive maintenant de
> `audience`, confrontée au prédicat par un test d'intégration sur les trois
> audiences) ; `getOpenAteliersByEdition`, morte en prod, a été supprimée. Leçon
> pour les prochaines phases CONTRACT : vérifier le nom SQL, pas le nom TypeScript.

### Sous-groupes : `coach_user_id` et `libelle` restent à retirer

> Ajoutée 2026-08-01, avec la migration 052 (plusieurs coachs, plus de nom).

Deux colonnes de `tremplin_atelier_sous_groupes` ne servent plus qu'à la bascule :

- **`coach_user_id`** est remplacée par la table de liaison
  `tremplin_sous_groupe_coachs` (une, plusieurs, ou aucune coach). Elle reste en
  base, recalculée depuis la liaison par `synchroniserMiroirCoach` — UN seul
  point de vérité, appelé par tous les writers — parce que la règle
  expand/contract fait passer la migration AVANT la livraison du code, et qu'un
  retour arrière la relirait.
- **`libelle`** n'est plus ni lue ni écrite : un sous-groupe se désigne par ses
  membres (`libelleSousGroupe`). Elle devient facultative en 052 et garde les
  anciens noms saisis (« Binôme 1 »…), au cas où l'un d'eux porte une
  information que l'orga voudrait relire en base.

Une fois la livraison en prod depuis quelques jours, une migration retire les
deux colonnes, avec `synchroniserMiroirCoach` et ses deux appels, et la colonne
dans `schema.sql`. Attention en la jouant : la reprise de la 052 est gardée par
« ce sous-groupe n'a aucune coach reprise », et c'est le miroir tenu à jour qui
garantit qu'un rejeu ne ressuscite pas une coach retirée. **XS.**

### Une coach héritée peut rester hors du nouveau modèle

> Ajoutée 2026-08-01, avec la migration 052.

`tremplin_atelier_coachs` est une table d'AUTORISATION : une ligne y ouvre
l'espace coach de l'atelier (noms de toutes ses participantes, supports, dépôt de
documents). Des sous-groupes portaient un `coach_user_id` dont la coach n'était
PAS inscrite sur l'atelier — l'ancien modèle le permettait, et il n'accordait
rien. La migration ne l'y inscrit donc pas d'office : élargir l'accès à des
données personnelles est une décision d'orga, pas de script.

Ces coachs ne sont pas reprises, et la page du sous-groupe les NOMME avec le
geste à faire (`SousGroupe.coachHeriteNom`). Quand l'orga aura tranché sur chaque
cas, ce champ, sa jointure et le message qui va avec pourront partir avec la
colonne `coach_user_id`. Requête d'audit :

```sql
SELECT sg.atelier_id, sg.coach_user_id, u.name, u.is_coach
  FROM tremplin_atelier_sous_groupes sg
  JOIN users u ON u.id = sg.coach_user_id
 WHERE sg.coach_user_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM tremplin_sous_groupe_coachs c
                    WHERE c.sous_groupe_id = sg.id);
```

**XS**, une fois la décision prise.

### Deux écrans montrent la fiche, et l'aperçu public porte trois sorties d'édition

> Ajoutée 2026-08-01, repérée en revue UX du lot « Ma fiche ».

Depuis que « Ma fiche » (`/mon-espace/profil`) rend la fiche avec un lien par
partie, `/speakeuses/[id]` en vue propriétaire cumule « Modifier mes infos »,
« Ajouter un talk » et un « Modifier » par carte de talk. Les rôles se
brouillent : deux pages d'édition concurrentes.

Cible : `/mon-espace/profil` = la fiche que je tiens ; `/speakeuses/[id]` =
l'adresse que je partage, FIDÈLE à ce que voient les visiteuses (donc sans
`talksBase`), avec un bandeau de statut et UNE sortie, « Modifier ma fiche ». Au
passage, le vocabulaire a quatre libellés pour deux destinations (« Voir ma fiche
publique », « Prévisualiser ma fiche », « Ton aperçu », « Modifier mes infos ») —
à réduire à deux. **S.**

### `TalkCard` : N liens « Modifier » de même intitulé sur un même écran

> Ajoutée 2026-08-01, même revue.

`TalkCard` rend un lien « Modifier » sans nommer son talk. Sur « Ma fiche », ces
liens côtoient désormais des rangées-liens dont l'intitulé est unique : même
verbe, deux langages, et N intitulés identiques pour des destinations
différentes (RGAA 6.1 / WCAG 2.4.4).

`TalkCard` sait déjà rendre la carte entière cliquable (`manageHref`) : l'intitulé
devient alors le titre du talk. À défaut, « Modifier le talk « X » ». **XS.**

> Précédent à copier : `src/app/actualites/ActualitesListe.tsx` (revue RGAA du
> 2026-08-01) applique la variante `sr-only` aux quatre intitulés de la liste.
> Les trois de la carte (« Lire la suite », « En savoir plus », « Voir ») ont leur
> complément calculé au bord, dans le DTO (`toCarte`), parce que c'est là que la
> destination se décide ; « Modifier » le porte en clair dans la vue, son
> intitulé ne dépendant de rien.

### Les onglets « Écrire / Aperçu » de l'éditeur promettent un clavier absent

> Ajoutée 2026-08-01, repérée en revue RGAA de `/actualites` (même défaut, autre
> écran).

`src/app/admin/contenus/[type]/[slug]/Editeur.tsx:241` rend `role="tablist"` +
deux `role="tab"` sans `aria-controls`, sans `role="tabpanel"` sur la zone
pilotée, et sans navigation aux flèches ni tabindex baladeur. Le rôle ARIA
annonce « onglet 1 sur 2 » et promet un clavier qui n'existe pas (RGAA 7.1 / 7.3).

Ici, contrairement aux filtres d'`/actualites` — démotés en boutons
`aria-pressed`, cf. commit de la revue —, c'est **bien** un motif d'onglets
(deux vues d'un même contenu) : le correctif est de **compléter** le motif
(`aria-controls` + `tabpanel` étiqueté + flèches), pas de le démoter. **S.**

### Le groupe de cases d'`InlineActionForm` rate la cible tactile et le focus

> Ajoutée 2026-08-01, repérée en revue RGAA du lot sous-groupes.

`kind: "checkboxes"` (`src/components/InlineActionForm.tsx`) rend des cases
natives sans dimension (~16 px, rangées à 20 px, `gap-1`), sans `focus-visible`
sur l'`input`, et le `fieldset` porte `border-navy-lighter` — 1,26:1 sur `bg-navy`,
c'est-à-dire invisible. Loin des 44 px de la checklist COGA, et sous les 24 px de
WCAG 2.5.8.

`src/components/CheckboxGrid.tsx` résout exactement ça dans ce dépôt
(`min-h-[44px]`, `border-field-border`, `focus-visible:ring-2`) : il n'y a qu'à
aligner le markup. Le lot sous-groupes est passé aux interrupteurs
(`SettingToggle`) donc ne l'emploie plus, mais la page photos, elle, l'utilise.
**XS.**

### Le focus se perd en réordonnant le programme

> Ajoutée 2026-08-01, avec la vue « Programme » par phase.

Monter ou descendre une séance rafraîchit la route : le DOM se réordonne et le
bouton cliqué n'est plus au même endroit, donc le focus retombe en haut de page.
Au clavier, réordonner cinq séances demande de retrouver sa place cinq fois.

Ce n'est pas silencieux — chaque déplacement s'annonce (`role="status"` :
« Réussir ses slides déplacée. ») — mais ce n'est pas confortable.

La correction demande de rendre au focus la séance qu'on vient de déplacer après
le rafraîchissement, donc un peu d'état client dans la rangée (l'id visé avant
l'aller-retour, remis au point après). À faire quand on touchera à
`InlineActionForm` : le motif servirait à tout formulaire d'action qui réordonne.
**S.**

### Revue croisée du 2026-08-16 — le reste

Même relecture que les P0 4-7. Ce qui suit est réel mais coûte moins :
personne ne perd de donnée, et rien n'est faux en public.

- **`getProfilesDueForReminder` est la seule requête d'envoi à laisser passer
  les adresses `.invalid`.** `src/lib/profiles.ts:461` garde uniquement
  `u.email IS NOT NULL`, là où ses quatre sœurs excluent les remplaçantes de
  migration (`profiles.ts:502`, `profiles.ts:708`, `comptes-inactifs.ts:60`,
  `brevo-contacts.ts:164`). Dès qu'une orga publie une fiche migrée dont
  l'adresse est la forme documentée `…@a-completer.invalid`
  (`docs/exploitation.md:172`), le cron quotidien poste cette adresse à Brevo
  tous les 180 jours ; `.invalid` étant réservé par la RFC 2606, chaque envoi
  est un rebond dur inscrit contre l'expéditeur partagé qui porte aussi les
  liens de connexion. Une condition, une ligne. **Effort : XS.**

- ~~**Les échecs de suppression de la passe de conservation sont muets, et le
  compte est réaverti 90 jours plus tard.**~~ **RÉSOLU le 2026-08-16**, avec le
  P0-6 : la suppression pouvant désormais échouer sur une panne du
  sous-traitant, une nouvelle cause d'échec ne pouvait pas atterrir dans un
  compteur muet. Le rapport porte `aSupprimer` (les dus) et
  `suppressionsEchouees` (les ratés), et les deux « restant à » se calculent
  APRÈS la boucle, sur ce qui a été fait (dus − faits) au lieu du seul plafond :
  un jour où tout échoue ne se lit plus comme un jour sans personne à supprimer.
  Le texte d'origine, pour mémoire :
  `src/lib/passe-conservation.ts:107`.
  La boucle d'avertissement compte ses échecs (`avertissementsEchoues`, ligne
  92) ; la boucle de suppression ne fait qu'un `console.error`, et
  `restantASupprimer` est calculé AVANT la boucle (simple troncature). Un jour
  où 40 suppressions échouent rend donc `{supprimes: 0, restantASupprimer: 0}`,
  strictement identique à un jour sans personne à supprimer. À J+90,
  `suppression_annoncee_le` dépasse `VALIDITE_AVERTISSEMENT_JOURS`, le compte
  repasse dans `comptesAAvertir` et reçoit un SECOND « ton compte va être
  supprimé le … » pour une suppression qui a échoué soixante fois en silence.

- ~~**`refuseConferenceProposition` n'a pas la garde d'état de son jumeau.**~~
  **SOLDÉ le 2026-08-21** (lot arbitrage des conférences) : la clause
  `AND statut = 'en_attente'` est posée, la fonction rend un booléen, et
  l'écran dit « déjà traitée » au lieu d'annoncer un succès qui n'a rien
  écrit. Vérifié par mutation (garde retirée → le test d'intégration tombe).

- **`previewImportAction` n'a aucune borne de cadence**, alors que chaque appel
  écrit et lit tout le répertoire. `src/app/mon-espace/talks/importer/actions.ts:98-110` :
  `ensureProfileId` (un `INSERT … ON CONFLICT DO UPDATE`, donc une version de
  ligne à chaque fois), `getRegistreIndex()` (jointure complète
  `conferences × conference_editions`, sans `LIMIT`), `getTalksByProfileId`, et
  l'analyse de 400 Ko. `confirmImportAction` est plafonnée à 3/h
  (`actions.ts:153`) ; le chemin de lecture ne l'est pas. Authentification
  requise et aucune corruption, d'où la priorité basse. **Effort : XS.**

- **`uploadImageDepuisUrl` ne borne les 4 Mo qu'après avoir tout mis en
  mémoire**, et son commentaire promet l'inverse. `src/lib/media.ts:171` : le
  contrôle `content-length` qui précède est consultatif et absent d'une réponse
  `chunked` (`Number(null)` → `0`, qui passe). Une réponse `*.licdn.com`
  découpée qui pousse 200 Mo dans la fenêtre de 8 s est entièrement allouée par
  `arrayBuffer()` avant d'être refusée. L'URL vient du provider et passe la
  liste blanche : ce n'est pas pilotable de l'extérieur, donc robustesse plutôt
  que sécurité. Correctif : lire le flux avec un compteur d'octets et
  interrompre au-delà de `MAX_SIZE` — et corriger le commentaire des lignes
  160-161, qui affirme aujourd'hui que « la borne d'après vaut toujours » alors
  qu'elle ne vaut qu'une fois la mémoire engagée. **Effort : S.**

- **Le focus est perdu après une relance individuelle réussie.**
  `src/app/speakeuses/[id]/ModerationPanel.tsx:180` : au succès, tout le
  `<form>` — dont le bouton qui porte le focus — est démonté
  (`relancable && relance.status !== "success"`) sans que rien ne reprenne le
  focus. Une orga qui tabule jusqu'à « Relancer par e-mail » et valide au
  clavier retombe sur `body` ; la tabulation suivante repart du haut du
  document (WCAG 2.4.3 / 3.2.2). C'est le défaut que `src/components/SettingToggle.tsx`
  documente longuement pour l'avoir corrigé. **Effort : XS.**

- ~~**Les mentions légales annoncent un maximum de conservation que le code
  dépasse par construction.**~~ **SOLDÉ le 2026-10-15** (PR des adhésions) :
  la phrase dit désormais « hors adhésion en cours : une adhésion à jour
  suspend ce compte à rebours », gardée par
  `src/__tests__/mentions-legales-adhesions.test.tsx`. Historique : `src/app/mentions-legales/page.tsx:332` affirme
  « La conservation maximale est donc de {DUREE_INACTIVITE_JOURS +
  PREAVIS_SUPPRESSION_JOURS} jour(s) après le dernier signe de vie », alors que
  `CONDITIONS_DORMANT` (`comptes-inactifs.ts:69`) suspend le compteur tant
  qu'une adhésion est active — exemption assumée et écrite dans
  `docs/conception-conservation-comptes.md:119`. Une adhérente qui renouvelle
  chaque année par HelloAsso sans jamais visiter le site est supprimée environ
  1125 jours après son dernier signe de vie, pas 760. Le plafond quotidien
  `LOT_CONSERVATION = 200` décale en plus la cohorte de migration de quelques
  jours. Comme c'est la publication de cette règle qui justifie la politique,
  une mention qui surestime est pire que pas de mention : soit une réserve
  (« hors adhésion en cours »), soit énoncer le déclencheur plutôt qu'une borne
  ferme. **Effort : XS.**

### Nettoyages code (un commit `chore:` chacun ou groupés)

- **Message éphémère + région vivante, recopié trois fois (2026-10-14).**
  `src/components/PartagerFiche.tsx`, `src/app/admin/diffusion/CopierHtml.tsx`
  et `src/app/kit-de-communication/PaletteCouleurs.tsx` portent chacun leur
  état `message`, leur minuterie de 4 s et leur `role="status"`. Un hook
  partagé (`useMessageEphemere`) les tiendrait ensemble — y compris le
  « vider puis écrire » que seule la palette fait, sans lequel un même message
  répété reste muet. Hors du lot kit : il touche deux écrans sans rapport. **S.**
<!-- RÉSOLU le 01/08 : « ouvert à toutes » avait deux définitions (toutes les
     inscrites vs la cohorte de phase). Le lot audience (#257) a posé le choix
     unique et exclusif, et la répartition en sous-groupes s'y est branchée —
     `getCohorteAtelier` répond désormais pour la visibilité, les présences ET
     la couverture. -->
- **La page « Participantes » d'un atelier re-dérive `nature` à la main**
  (`presences/page.tsx` : `estSousGroupes` branché 4 fois) alors que
  `atelier-etat.ts` est le module qui possède cette table de décision. Le
  titre de la page et la rangée de la fiche disent la même chose par
  coïncidence. Cible : la page consomme `atelierEtat` (ou une capacité
  `pointePresences`), comme la fiche. **S.**
- **`MessagesFlash` à généraliser** : le composant existe (01/08) et sert la
  liste des ateliers et le retrait d'atelier ; quatre pages rendent encore le
  couple `role="alert"` / `role="status"` à la main (`[edition]/page.tsx`,
  `[edition]/retrait`, `participantes/[registration]/retrait`,
  `admin/tremplins/page.tsx` — cette dernière a déjà dérivé avec un
  `break-words`). **XS** chacune.


- `inputCls` : déplacé dans `[edition]/styles.ts` ✔ mais le ré-export
  d'`AdminDialog` demeure et deux formes d'import coexistent (5 modales
  importent encore via `AdminDialog`). **XS.**
- Dernière date ISO brute affichée :
  `participantes/[registration]/page.tsx` (date d'atelier) — `<DateFr>` est
  utilisé partout ailleurs. **XS.**
- Espace insécable : la règle CLAUDE.md n'est tenue que dans `src/data` (seul
  périmètre scanné par `french-spelling.test.ts`). Dans `src/app` et
  `src/components`, ~1 470 occurrences de `` ` : ` `` contre une poignée
  d'insécables — les pages écrites depuis la refonte des ateliers sont
  correctes, le reste non. Chantier à mener d'un coup (codemod + extension du
  test au-delà de `src/data`), pas fichier par fichier. **M.**
- `isHttpUrl` : le helper vit toujours dans `cfp-import.ts` ; 8 occurrences
  de la regex `/^https?:\/\//` hors tests. Relocaliser en util neutre puis
  dédupliquer. **S.**
- Transactions main-roulées (5 sites) : `tremplin-import.ts`,
  `tremplin-photos.ts` ×2, `tremplin-registrations.ts` ×2 (qui utilise déjà
  `withTransaction` ailleurs — incohérence interne). **S.**
- `LienRetour` : 10 fichiers l'importent, **23** recopies à la main restent
  (quasi toutes sous `admin/tremplins/**`). Le gabarit `SousPage` envisagé
  n'existe pas. **S.**
- **`optionalText` a la mauvaise polarité** (tracé PR #233) : le défaut ne
  replie pas les blancs alors que les champs d'UNE ligne sont majoritaires —
  13 champs concernés (`talk-form`, `conference-form`, `contenu-form`,
  `tremplin-form`) contre 4 passés en `oneLineText`. Faire replier
  `optionalText` et nommer l'exception (`texteMultiligne(max)`) pour
  bio/description/contenu/chapo. Touche 5 modules → sa propre PR. **S/M.**
- **Bandeau « résumé d'erreurs » dupliqué** quasi au caractère entre
  `ProfileForm`, `TalkForm` et `OccurrenceForm` (tracé PR #233) : extraire le
  bandeau (les trois jeux de clés restent disjoints, c'est normal). **S.**
- **`border-navy-lighter` résiduel sur des champs** (contour ~1,26:1,
  invisible ; tracé PR #233) : `connexion/page.tsx`,
  `connexion/deja-un-compte/page.tsx`, `ModerationPanel.tsx`, + les copies
  locales d'`inputClass` dans `ContactSpeakeuseForm` et `ContactForm` →
  importer `inputClass` de `ChampTexte`. **XS.**
- **Le JWT fige `name` à la connexion** (tracé PR #233) : après saisie du
  nom, `AccountMenu`/`Header` affichent « Compte » jusqu'à la reconnexion.
  Rafraîchir `token.name` dans le callback `jwt`, ou `unstable_update` après
  écriture. **S.**

### Répertoire des conférences : ce que le lot d'arbitrage laisse ouvert (2026-08-22)

- **Aucune trace d'une écriture orga sur une donnée de membre.**
  `conference_propositions` ne porte ni `updated_at` ni `corrige_par` : quand
  une orga corrige « DevoxxFR » en « Devoxx France », la correction est
  inattribuable, et rien ne le DIT à l'autrice (elle le voit, le libellé de sa
  saisie étant renommé avec, mais aucune notification ne part). Relevé par la
  passe sécurité du lot, hors de son périmètre. **Effort : S.**
- **L'année corrigée par l'orga reste réversible par la membre** (sonde de la
  re-revue du 2026-08-22). Le nom est cohérent des deux côtés depuis le lot (la
  correction renomme aussi `talk_occurrences.conference`) ; l'année non, parce
  que la porte membre la recalcule depuis SA date. L'orga corrige 2024 → 2025,
  la membre revient ajouter un lien, sa clé `(nom, 2024)` ne retrouve plus la
  ligne, et `updateConferenceProposition` réécrit `annee: 2024` — sans signal
  d'aucun côté. À deux saisies, la porte membre refuse et
  `soumettreProposition` ouvre une SECONDE ligne en file au même nom : le
  doublon que l'écran existe pour empêcher, déclenché par la correction.
  Parade : côté membre, retrouver la proposition par le `proposition_id` que sa
  saisie tient déjà, au lieu de la clé `(nom, année)`. **Effort : S.**
- **`conference_propositions` n'a aucun index** hors sa clé primaire, et le
  résumé de la file est lu à chaque rendu de page connectée (trois parcours
  séquentiels plus un tri). Sans commune mesure avec la lecture intégrale
  d'avant, mais un index `(statut, created_at)` rendrait le coût vraiment borné.
  Migration, donc hors du geste courant. **Effort : XS.**
- **L'arbitrage ramène toujours en page 1 de la file.** Reporter `?page`
  demanderait de le faire voyager par la page de l'item. Rare en pratique (la
  file est triée par ancienneté, on arbitre depuis le début). **Effort : XS.**
- **Fusionner deux marques déjà créées.** Le lot empêche le doublon
  d'APPARAÎTRE (l'écran d'arbitrage dit « ressemble à … » avant de valider) ;
  il ne défait pas ceux qui sont déjà au répertoire. Fusionner demande de
  déplacer les éditions, les occurrences et le logo, puis de retirer la marque
  vide. **Effort : M.** Point de bascule : le premier doublon constaté en prod
  (l'écran d'arbitrage le rend visible, donc il se constatera).
- **Une saisie qui tape le NOM EXACT d'une conférence du répertoire ouvre
  quand même une proposition.** La porte membre (`soumettreProposition`) ne
  consulte pas le répertoire : elle ne connaît que la file. Sans dégât — la
  validation retombe sur la conférence existante et rattache — mais c'est une
  ligne d'arbitrage pour rien, et la file en compte déjà 113 pour de vraies
  raisons. Le rapprochement existe désormais et il est pur
  (`src/lib/proposition-rapprochement.ts`) : le brancher côté saisie
  choisirait la conférence au lieu d'ouvrir une proposition. **Effort : S.**
- **Ramassage des propositions à zéro saisie** (item déjà inscrit plus haut,
  effet de bord assumé du correctif du 2026-08-16) : la file le DIT maintenant
  (« aucune saisie derrière »), donc l'orga peut écarter à la main. Le
  ramassage automatique reste à écrire. **Effort : XS.**

### Schéma / SQL

- **`tremplin_registrations.statut` dormant** (`en_attente` écrit, jamais lu ;
  les compteurs publics ne filtrent pas → une `refusee` compterait comme
  inscrite le jour où un workflow de sélection existera). Brancher ou retirer.
  **S.**
- **Le statut d'une édition redit des dates qu'elle porte déjà (2026-08-17).**
  L'entrée précédente disait « 5 statuts dont 2 paires quasi redondantes
  (`ouvert`/`en_cours`, `clos`/`archive`) ». Le diagnostic était à côté : ce ne
  sont pas des paires qui se ressemblent, c'est **une source manuelle qui
  double une source calculable**. Signalé par Cateline (« ouvrir au public
  c'est pas logique : on a des dates d'ouverture et de fermeture »), vérifié
  dans le schéma.

  | Statut | Son libellé | La date qui le dit déjà |
  |---|---|---|
  | `ouvert` | « Inscriptions ouvertes » | `inscriptions_debut` / `inscriptions_fin` |
  | `en_cours` | « En cours » | entre l'ouverture et `finale_date` |
  | `clos` | « Finale passée » | `finale_date` |

  **Le dépôt applique DÉJÀ la règle sur le champ voisin**, et le dit en
  commentaire : « fenêtre d'inscriptions : l'état "ouvertes" est dérivé de la
  date du jour ». Et le moteur de tâches se contredit lui-même — pour savoir si
  la finale est passée, il calcule `finaleDate < aujourd'hui` et **ignore le
  statut**. La date fait donc déjà foi dans le code pendant qu'un champ manuel
  prétend dire la même chose à l'écran : c'est un état à tenir à jour à la main
  pour rien, et une occasion de dérive à chaque édition.

  **Ce qui n'est PAS dérivable, et reste une vraie décision** : `preparation`
  (annoncer ou pas — on n'annonce pas une édition avant de le décider) et
  `archive` (la retirer des hubs). Deux valeurs, pas cinq.

  **Conception esquissée**, pour que ce soit un lot prêt à prendre :

  1. `EditionStatut` tombe à `preparation | publiee | archive`. Les libellés
     « Inscriptions ouvertes », « En cours », « Finale passée » deviennent une
     **phase dérivée** (`phaseEdition(edition, aujourdhui)`) dans
     `tremplin-statut.ts`, à côté de `estPasse` et `finEffective` qui font déjà
     ce travail.
  2. La visibilité publique ne tient qu'à **trois lectures** de
     `statut === "preparation"` — `app/tremplin/[conf]/[annee]/page.tsx:68`,
     `.../montee-sur-scene/page.tsx:64`, `app/tremplin/[conf]/page.tsx:25`.
     C'est le périmètre risqué, et il est petit : une erreur y publie ou
     dépublie une édition à tort, donc chacune se garde en E2E avant de bouger.
  3. Migration en deux phases : EXPAND (ajouter `publiee`, replier
     `ouvert`/`en_cours`/`clos` dessus, garder la colonne), puis CONTRACT quand
     plus rien ne lit les anciennes valeurs. Jamais en une fois — le dépôt a
     déjà `ouvert_a_toutes` en attente de CONTRACT, la mécanique est connue.
  4. **Effet de bord souhaité** : la tâche « Ouvrir au public l'édition X »
     disparaît. Elle n'existe que parce qu'on demande à la main ce que les
     dates disent déjà — et c'est elle qui, aujourd'hui, colle un compteur
     permanent sur chaque écran pendant les mois de préparation d'une édition.

  **Pourquoi ce n'est pas fait tout de suite** : ça touche des pages publiques,
  ça demande une conception validée (pas un refactor à la volée), et le lot 4
  (l'onglet « À faire ») peut partir sans, **sans cas particulier** — la règle
  du compteur reste « une ligne compte si un geste de la personne la referme »,
  et « Ouvrir au public » la satisfait tant que la tâche existe. Le compteur
  s'améliorera tout seul le jour où ce lot passe. **M**, à remettre en tête de
  file une fois le badge livré.
- **`CONF_DEDICATED_PAGE` en dur** (2ᵉ registre des conférences). La
  convention « nom sans année » est posée (libellés, `nomConference`) ; reste
  ce mapping et le rabot legacy de `tremplin-nom.ts`. **S.**
- **4 colonnes mortes sur `tremplin_registrations`** (`bio`, `site_web`,
  `photo_url`, `participante_linkedin` — `participante_role` est ENCORE
  affichée côté orga, ne pas la dropper). Toujours écrites (seed,
  `deleteAccount` les vide) et assertées par des tests d'intégration (churn
  à prévoir). Migration destructive à confirmer explicitement : elles portent
  des données prod (finalistes T1). **S** + décision.
- **Le seed des séances de phase 3 n'amorce QU'UNE fois** (`sync-to-latest.sql`,
  garde `NOT EXISTS … a.phase = 'montee_sur_scene'`, posée le 01/08 pour qu'une
  séance supprimée exprès ne revienne pas). Conséquence à connaître : une séance
  AJOUTÉE plus tard au bloc `VALUES` ne s'appliquera jamais à l'édition 2026.
  Le commentaire SQL et `seed-ateliers-idempotent.test.ts` le disent ; à
  rouvrir seulement si un seed doit un jour entretenir un programme vivant
  (il faudrait alors une identité stable, `seed_key` + tombstones). **S.**
- **Les blocs 048 et 049 se repèrent encore par TITRE** (mutable). Ce sont des
  `UPDATE`/`DELETE` : un titre périmé les rend inopérants, pas multiplicateurs
  — bien moins dangereux que le seed, mais même fragilité. Seul le test
  « 049 cible les mêmes titres que le seed » les tient ensemble. **S.**
- **README des migrations en retard** : 5 paires de numéros dupliqués
  (010/011/012/032/044), le README n'en signale que 3 et son « ordre sûr »
  s'arrête à 016 alors qu'on est à 045. Depuis le runner auto, ces fichiers
  sont documentaires — le README doit le dire. **XS.**

### RGPD / process (doc, pas code)

- Pas de purge automatique de `contact_messages` (conservation illimitée,
  intérêt légitime) : cron de purge (rejetés > 12 mois) si la table gonfle ;
  pas de self-service d'effacement pour l'expéditeur (manuel orga). **S.**
- Durée de conservation du journal de consentement à énoncer (une ligne). Les
  `feedback_jury` en texte libre peuvent nommer une personne introuvable par
  requête : paragraphe « revue manuelle » dans `exploitation.md` +
  convention « pas de nom dans les documents partagés ». **S.**
- Noter dans `exploitation.md` que les migrations 033/034 ne sont pas
  rejouables après 035 (backfill `sujet` sans garde d'existence — le runner
  auto ne les joue jamais, le piège ne vaut que pour un rejeu manuel). **XS.**
- Ton de `parseContactMessage` en tutoiement vs formulaire en vouvoiement
  (préexistant). **XS.**

### A11y

- **Mots tronqués et sigles dans la copie AFFICHÉE (2026-08-16).** La règle
  posée le même jour dans `docs/principes-conception-ui.md` (checklist COGA,
  « aucun mot tronqué dans un intitulé ») a été appliquée à la conception en
  cours, **pas au dépôt**. Relevé partiel, trouvé en vérifiant autre chose :

  | Occurrence | Où | Lu par |
  |---|---|---|
  | « Ton article est chez **l'orga**, en relecture » | `mon-espace/articles/[id]` | une speakeuse |
  | « Une **orga** te l'a renvoyé : … » | `mon-espace/articles/[id]` | une speakeuse |
  | « tes profils **CFP** » | carte « Ta prochaine étape » (`prochaine-etape.ts`) | une speakeuse |
  | « Lien de connexion (**visio**) » | fiche atelier | orga, coach |
  | « Tableau de bord **orga** », « Espace **orga** » | profil, `/admin`, fils d'Ariane | orga |
  | « Gérer l'**édition** », « Réglages de l'**édition** » | hub tremplin, fils d'Ariane | orga |

  Cas voisin, même remède : « **édition** » est le mot du SCHÉMA
  (`tremplin_editions`) ; une orga dit « le tremplin ». Corrigé le 2026-08-16
  sur la seule rangée du profil (« Ateliers du tremplin en cours ») — le reste
  de l'espace d'administration parle encore le vocabulaire de la base.

  Les deux premières lignes sont les plus coûteuses : le mot tronqué y est lu
  par des **membres**, à qui personne n'a jamais expliqué le vocabulaire de la
  maison — plus grave que le cas d'`/admin` qui a fait naître la règle.
  « CFP » est un sigle dans le SEUL CTA de la page, devant le public qui a le
  moins de chances de le connaître (cf. `docs/conception-profil-et-a-faire.md`
  §6 V4 et Q9).

  Le relevé ci-dessus est **partiel** : il vient d'une lecture de passage, pas
  d'un balayage. Reste à faire — passer la copie affichée au peigne (`src/app`,
  `src/components`, `src/data`), une proposition par occurrence, et se demander
  si un test de cliquet est tenable (une liste fermée de mots interdits dans
  les chaînes affichées, sur le modèle de `lien-texte.test.ts`). **M.**

  > **Soldé pour « orga » et « asso » le 2026-08-16** (PR de suite de la revue
  > RGAA). Le balayage a été fait par l'AST et non par `grep` — un commentaire
  > parle du code, une chaîne parle à quelqu'un : `src/__tests__/copie-affichee.ts`
  > extrait la copie, `mots-entiers.test.ts` la juge et **échoue à la première
  > réapparition**. 43 phrases corrigées, dont une sur `/connexion` — une page
  > publique, lue par quelqu'un qui n'a pas de compte.
  >
  > Reste ouvert : les **sigles** (« CFP », « visio »), et « édition » là où une
  > orga dit « tremplin ». Le cliquet est écrit pour qu'on y ajoute une ligne
  > par mot le jour où la formulation de remplacement est tranchée. Limite
  > assumée du cliquet : il ne juge que la PROSE (un texte contenant une
  > espace), donc une étiquette d'un seul mot — `nb(n, "orga")` dans
  > `/admin/diffusion` — lui échappe ; c'est le prix à payer pour qu'il ne
  > demande jamais d'exception sur une valeur en base (`type = 'asso'`).

- **Typographie condamnée : 80 occurrences hors coquille d'app (2026-08-16).**
  Le tout-capitale (qui efface la silhouette du mot) et les tailles sous 12 px
  ont été corrigés sur `SegmentLabel`, puis la revue a montré que la règle ne
  tenait qu'à cet endroit : `SegmentLabel` n'est appelé que 7 fois, et la forme
  survivait plus de 80 fois ailleurs, dont ~29 sur des `h2`/`h3`.

  `src/__tests__/typographie-lisible.test.ts` gèle la liste : la coquille d'app
  (profil, `/admin`, pied, `Completude`) en est sortie, **aucun nouveau fichier
  ne peut y entrer**, et la liste ne peut que raccourcir (une entrée périmée
  fait échouer la CI). Reste à reprendre, par ordre d'exposition :

  | Lot | Fichiers | Note |
  |---|---|---|
  | Espace organisatrices | `admin/tremplins/**`, `admin/messages`, `admin/diffusion`… | ~20 fichiers, même motif `text-xs uppercase tracking-wider text-gray-light` |
  | Espace membre | `mon-espace/fiche`, `talks`, `documents`, `tremplin/**` | lu par des membres |
  | Composants partagés | `SpeakeuseCard`, `TalkCard`, `MotifBadge`, `EcheanceCard`, `ChipGroup`… | un correctif ici en solde plusieurs écrans |
  | Pages publiques | `tremplin/**`, `devfest-toulouse`, `partenaires` | la casse y est un parti pris de MARQUE : à trancher avec Cateline, pas à corriger d'office |

  Les deux entrées `Avatar` et `ConferenceLogo` ne sont pas de la copie mais la
  taille d'un glyphe dans une pastille ronde : elles restent dans la liste pour
  que le motif n'ait aucune exception à connaître. **M.**

- **« Mon compte » nomme deux ensembles emboîtés (2026-08-16).** Sur
  `/mon-espace/profil`, le segment « Mon compte » contient la rangée
  « Réglages » ; sur `/mon-espace/reglages`, un segment « Mon compte » contient
  « Mes connexions » et « Supprimer mon compte ». Deux taps, deux fois le même
  intitulé, sur deux ensembles différents : on peut croire avoir tourné en rond.

  Relevé par la revue RGAA/COGA, **volontairement laissé ouvert** : chacune des
  formulations essayées (« Mon accès », « Ma session », « Mes identifiants »)
  fabriquait un mot que personne n'emploie — exactement l'erreur que la même
  revue condamne par ailleurs (« Mes pages »). Corriger demanderait de trancher
  d'abord ce que contient chaque groupe, pas de renommer. **S**, à traiter avec
  l'étape B (l'onglet « À faire »), qui rebat de toute façon les rangées du
  profil.

- ~~**Espace au-dessus des étiquettes de segment (2026-08-16).**~~ **Soldé le
  même jour.** Le diagnostic était juste (deux appels sur trois passaient
  `mt-2` / `mt-0`, l'étiquette se retrouvant à égale distance des deux
  groupes), mais le remède visé — corriger les appels — laissait la faute
  possible. `SegmentLabel` n'a **plus de prop `className`** : l'espacement
  (`mt-8 -mb-1`) appartient au composant, aucun appelant ne peut l'annuler. Une
  règle qu'un appelant peut annuler n'est pas une règle.

- Admin : texte d'aide des dates d'inscriptions non relié
  (`InlineActionForm` sait faire `hint`/`aria-describedby`, le champ ne le
  passe pas) ; paire début/fin sans `fieldset/legend` (le composant n'en pose
  que pour `checkboxes`). Le « pas de h3 par participante » est dissous par le
  split en sous-pages. **S.**
- **Barre d'actions collante du profil** (`ProfileForm`, `sticky bottom-3`) :
  recouvre le champ sous la flottaison pendant le défilement (WCAG 2.4.11).
  `scroll-padding-bottom` mesuré sans effet ici — vraie sortie : barre non
  flottante ou réserve de hauteur en fin de formulaire (tracé PR #233). **S.**
- **Changement d'étape du stepper profil muet au lecteur d'écran** dans
  certains cas (WCAG 4.1.3) : `role="status"` sur le compteur, mais le focus
  reste sur « Suivant » et le panneau entier est échangé (tracé PR #233).
  **S.**
- **10 `<textarea>` encore câblés à la main** alors que `ChampTexte` sait
  rendre une zone de texte (`multiligne`) — bio de `ProfileForm` et
  description de `TalkForm` en tête (~26 lignes de câblage chacun). **Blocage
  réel identifié par #233** : la primitive masque `hint` en présence
  d'`error`, donc le compteur de caractères disparaîtrait pile quand l'erreur
  « trop long » se déclenche. Faire cohabiter `hint` et `error` dans
  `ChampTexte`, puis migrer. `field-sizing: content` en simplification
  lointaine (support Safari iOS). **M** / très basse.

### Perf / infra

- Lighthouse CI : budgets par métrique en place (`runs: 3`) mais tout est en
  `warn` — promouvoir perf + budgets en `error` une fois la ligne de base
  confirmée. **XS.**
- `SessionProvider` enveloppe toute l'app sans session initiale → un fetch
  `/api/auth/session` par page, même statique. Tradeoff à peser. **Basse.**
- 8 JSON-LD inline (pas 6) → CSP `script-src 'unsafe-inline'` (voir Accepté) ;
  composant `<JsonLd>` + hashes le jour venu (seul `speaker-jsonld.ts`,
  constructeur d'objet, existe). **M.**
- Tableau de bord `/admin` : jusqu'à ~25 requêtes (7 × éditions actives) pour
  dériver « À faire » → agrégats dédiés ou cache court. **Chantier.**
- Préambules admin : getters mono-ligne au lieu de `getXByEdition().find()` —
  différé (churn de tests > gain). `tremplin_photo_personnes(photo_id)` sans
  index simple — table minuscule, **très basse**.
- **[⚠️ EXPLOITATION, hors repo] Endpoint Neon `-pooler` + région Vercel** :
  vérifier en prod que `DATABASE_URL` contient `-pooler` ET que la région des
  fonctions = région Neon (UE), sinon ~100-150 ms d'aller-retour par requête.
  Plus fort levier de perf généralisée que n'importe quel correctif de code.
- Garde `server-only` : `db.ts` ne l'importe pas ; `tremplin-editions.ts`
  ré-exporte `tremplin-statut` tout en chargeant `pg` (invite l'import client
  qu'il faut interdire ; l'échec serait bruyant au build, d'où P2). **S.**

### Tests

- **`e2e/annuaire.spec.ts` « ouvrir une carte mène à la fiche de la bonne
  personne » rougit en suite complète parallèle, à creuser (2026-10-15).**
  Une fois sur une suite locale de 442 tests (bureau seulement), sur une base
  vierge ; vert rejoué seul (14/14 avec `parcours-import`). Constaté sur la
  branche de la navigation connectée, qui ne touche ni la liste ni ses cartes.
  Hypothèse NON vérifiée : une fiche publiée par un parcours jetable en
  parallèle (même famille que la course ISR de `/partenaires` plus haut).
  **XS** pour trancher en répétant (`--repeat-each`) sur `main`.
- ~~**Six tests rouges en local sous Node 26 (2026-10-14).**~~ SOLDÉ le
  2026-10-15. Deux mécanismes, la version de Node n'était que le révélateur.
  (1) Node ≥ 25 pose une clé `localStorage` sur le global (`undefined` sans
  `--localstorage-file`) ;
  Vitest n'installe pas une clé de jsdom déjà présente sur le global, donc
  `completude-component.test.tsx` lisait celui de Node : `vitest.config.ts`
  passe `--no-experimental-webstorage` aux workers (flag accepté dès Node 22.4).
  (2) `api-media-avatar` et `api-media-contenu-image` comparaient par égalité
  profonde le fichier envoyé et celui que la route reçoit, une RECONSTRUCTION
  de `formData()` : Node 26 y voit `lastModified` (horodaté à la
  reconstruction), Node 22 n'y voyait PAS les octets. Les deux comparent
  désormais nom, type et octets (`contenuFichier`, `test-helpers.ts`) ;
  mutation : octets substitués à taille égale, mauvais dossier, argument en
  trop → rouges sous Node 22 et 26 (l'ancienne assertion laissait passer
  le premier sous Node 22). Registre de `docs/principes-tests.md`.
- **`reaction-row.test.tsx` vu une fois rouge sous charge, à vérifier
  (2026-10-15).** Passe seul. Sans lien avec les deux causes ci-dessus (ni
  `localStorage` ni `File`) ; ses seules attentes asynchrones sont deux
  `findByRole("alert")` au délai par défaut (1 s). Hypothèse NON vérifiée :
  délai dépassé sous charge. Reproduire avant de toucher. **P3, XS.**
- ~~**Le décor E2E est daté de 2026 et périme (2026-10-14).**~~ SOLDÉ le
  2026-10-14 (PR #366) : toutes les dates de l'édition en cours de
  `db/seed-preview.sql` (ateliers, finale, conférence, inscriptions) sont
  relatives à `CURRENT_DATE`, et `src/__tests__/seed-preview-dates.test.ts`
  refuse toute date littérale future sans marqueur. Les échéances de fiches et
  les candidatures étaient déjà relatives (`now()`). L'ANNÉE l'est aussi depuis
  la PR #368 (item P2 soldé le même jour).
- Élaguer les assertions regex-sur-SQL des tests mockés doublés par du vrai
  SQL ; quelques fonctions restantes sans couverture SQL réelle, faible
  risque (`getTalkSuggestions`, parties de `users`). Au fil de l'eau. **S.**
- `vi.setSystemTime` sur les tests à horloge réelle (le hero « Inscriptions
  ouvertes » est intestable au niveau page ; `aujourdhuiParis` recalcule
  « now » deux fois → flaky à minuit pile). **S.**
- Boot jsdom pour des tests node purs : 19/198 fichiers portent le pragma
  `@vitest-environment node`, pas de `environmentMatchGlobs`/projects —
  ~65 % du wall-time reste du boot jsdom. **S.**
- Résiduel connu : ~~scan axe des pages connectées (nécessite l'auth en E2E)~~
  **RÉSOLU le 2026-08-09** — il ne tenait qu'à l'absence de session et de base
  en CI. Les deux sont là (`e2e/session.ts`, service Postgres + `npm run e2e:db`)
  et les portes axe ET débordement traversent `/mon-espace` comme `/admin`, sur
  les deux tailles d'écran ; l'espace orga, le plus dense du produit, était
  conforme sans qu'on l'ait jamais mesuré. Reste :
  audit RGAA manuel (clavier, lecteur d'écran) ; harnais de charge HTTP (k6,
  manuel, hors CI) ; branches défensives `(rowCount ?? 0)` inatteignables.

### Duplication d'édition (détonation : phase 2)

- **`addRecompense` non transactionnelle** (tape `pool` directement, pas de
  paramètre `db: Queryable`) : prérequis bloquant de la copie du catalogue de
  récompenses (§7.1 du doc de conception). Détonation à l'ouverture de la
  phase 2. **S.**
- `ConfLienField` après erreur : changer de conférence ne re-préremplit pas le
  site (préexistant, impact faible). Questions produit différées : copie des
  coachs et des documents généraux (§7). Invariant RGPD : `duplicateEdition`
  recopie en **liste blanche** — à maintenir en revue quand `EditionInput`
  s'étend.

### Docs collatérales

- `docs/conception-suppression-edition.md` décrit encore `DeleteEditionDialog`
  (supprimé le 07-26) comme vivant, alors que son propre en-tête se déclare
  périmé. À tailler avec P0-1. **XS.**

## ✅ Accepté — avec justification (ne pas rouvrir sans raison)

- **Pas de table `conferences` normalisée pour le Tremplin** (dénormalisation
  par édition) : correct à 1-2 éditions/an ; l'identité d'URL est verrouillée.
  Points de bascule : éditer une conf pour toutes ses éditions, ou > 3-4
  confs partenaires. (Le registre `conferences`/`conference_editions` des
  talks est un autre domaine, déjà en place.)
- **Pattern redirect `?ok=/?err=` pour les toggles un-clic** : PRG sans JS
  client, messages centralisés. Les cas à saisie sont migrés (ActionState).
- **Découpage `src/lib/tremplin-*`** : modules cohésifs, dépendances dans le
  bon sens. `tremplin-form.ts` gros mais cohésif — ne pas scinder.
  **Rouverture proposée le 2026-10-16** pour `tremplin-ateliers.ts`
  (1 495 lignes), au nom de la lecture : décision de Cateline attendue
  (`docs/audit-reprise-humaine.md` §5, D).
- **`editionStatutAffiche`** (dates dérivées priment, statut manuel en
  secours) : bon modèle, pur, testé. La dette est le nombre d'états manuels
  (P2), pas le mécanisme.
- **Pas de rate-limit sur les envois d'e-mail orga** : derrière
  `requireOrgaId` ; revoir si le nombre d'orgas grossit.
- **Runner de migrations : automatique en prod, manuel en preview**
  (requalifié 07-30). Le runner n'exécute QUE `sync-to-latest.sql`
  (idempotent, une requête tout-ou-rien) ; les fichiers `db/migrations/NNN`
  sont l'historique. Le garde-fou central est le test de drift
  `db-schema-drift.test.ts` (schema.sql ↔ sync-to-latest.sql, PGlite).
- **Admin en sous-pages mono-fonction** (tranché de fait en juillet) : hub
  `NavRow` + une page par geste, `InlineActionForm` sans rechargement. Le
  menu « ⋯ » est écarté.
- **`/speakeuses` sans ISR de page** (post-incident 07-23) : l'ISR pré-génère
  au build et fige un annuaire vide si la base est injoignable. La voie est
  le cache de DONNÉE (P1), pas le retour à `revalidate`.
- **CSP `'unsafe-inline'`** : 8 scripts JSON-LD inline, plusieurs sur pages
  ISR où les nonces cassent le cache → hashes ou composant partagé le jour
  venu.
- **Péremption ISR aux bornes de minuit** : ≤ 5 min d'affichage périmé,
  cosmétique.
- **pg-mem + PGlite plutôt qu'un vrai Postgres en CI** : divergences connues
  et compensées ; le bon compromis avec la règle « pas de base en CI ».
- **Cast `useActionState` d'`AdminDialog`** : limite d'inférence TS,
  documentée sur place.
- **Exports « test-only » RGPD** (`setPhotoPersons`, `getConsentLog`…) :
  leviers RGPD délibérés sans UI — ne pas supprimer.
- **Galerie finalistes T1 appauvrie** (décision 2026-07-11) : pas de
  backfill ; les cartes se re-remplissent au rattachement des fiches.
- **Notif de modération de profil hors digest** : e-mail immédiat assumé
  (colonne `moderation_notified_at` réservée, non câblée).
- **`npm audit`** : 4 modérées connues (chaîne `next → postcss`), non
  corrigeables sans downgrade cassant.
- **Plafond d'import à 200 propositions/lot** (relevé de 20 le 2026-08-16,
  mesuré sur le fichier réel : 154 confs distinctes, un portfolio doit passer
  en UN lot) : au pire un compte authentifié peut déposer 600 propositions/h
  dans la file orga (3 imports/h × 200) contre 60 avant — accepté pour une
  communauté petite où tout est attribuable et arbitrable en masse par
  l'écartement. Points de bascule : un abus réel constaté, ou une file orga
  qui dépasse ce que la page affiche confortablement (elle liste tout, sans
  pagination) → pagination + plafond quotidien par compte.
- **Lot d'import de 200 propositions sous `maxDuration = 60`** : au pire
  ~30 s de résolution Notist (cache d'instance froid à la confirmation) puis
  ~800 allers-retours SQL séquentiels. Marge réelle mesurable seulement en
  prod ; si des 504 apparaissent sur de gros lots, batcher les écritures. Le
  design encaisse une coupure en plein vol : rejouer le même fichier reprend
  où c'était (dédoublonnage + propositions réutilisées), seul un jeton de
  quota (3/h) est perdu.

## Ordre suggéré — au 2026-08-21

> Cette section est un **index de P0/P1** : elle périme à chaque solde. Un solde
> se répercute ici et dans l'en-tête, sinon il crée une contradiction au lieu
> d'en lever une (constaté le 08-21 : elle donnait encore P0-1 et P0-8 comme
> chantiers à ouvrir, tous deux soldés).

1. **P0-3 alerting** (S-M) — le SEUL P0 encore ouvert, et le seul point du
   produit où un incident passe inaperçu : le journal existe depuis le 08-09,
   l'alerte manque. Commence par une **décision** : alerte Vercel sur les logs
   error-level, ou Sentry free tier côté serveur. La poser avant d'écrire quoi
   que ce soit.
2. **Bloc détonation 2ᵉ édition** : garde minimum des blocs 2026 + sitemap +
   lien recherche, et faire trancher les 2 décisions produit (CTA
   d'inscription, affichage des dates) — AVANT d'ouvrir quoi que ce soit.
3. **Annuaire** : `unstable_cache` sur les lectures de `/speakeuses` (le
   produit principal paie 2 requêtes Neon par hit anonyme).
4. **Robustesse** : test `nouvelleSoumise`, puis squelette `actions.ts`.
5. Le reste au fil de l'eau — les XS/S de nettoyage groupés en `chore:`.

## Pièges connus (ne pas re-déboguer)

- **ISR sur une page à données BDD** : le build pré-génère avec la base du
  moment ; base injoignable → contenu vide FIGÉ en cache (incident prod
  2026-07-23 sur `/speakeuses`). Soit `generateStaticParams` résilient +
  revalidation, soit cache de donnée — jamais d'ISR nue sur une page dont le
  contenu vient de Neon.
- **Brevo bloque par IP** par défaut → incompatible Vercel serverless (401).
  À laisser désactivé. Conditionne tous les e-mails, lien magique compris.
  Détail : `docs/exploitation.md`.
- **`pg` / `pg-connection-string`** : dépréciation `sslmode` (`require`
  traité `verify-full` ; changera en pg v9). Fixer explicitement le moment
  venu.
- **pg-mem** : DATE en objets `Date` (le driver réel renvoie des chaînes via
  le type parser de `db.ts`) ; pas de `to_char`, `= ANY($1)` entiers, CTE
  `WITH … INSERT`, `COUNT(*) FILTER`, `NOT EXISTS` corrélé ;
  `backup.restore()` ne restaure pas une table DROPpée. Dès qu'une de ces
  constructions est en jeu : **PGlite** — ne JAMAIS réécrire le SQL dans le
  test. Contrôle de pertinence : un **red-on-break** sur les requêtes
  filtrées, en plus du cas négatif systématique.
- **Règle de fond tests BDD** : toute fonction qui touche la base a au moins
  un test à vrai SQL (pg-mem si suffisant, PGlite sinon). Le pool mocké sert
  l'orchestration des Server Actions, pas la preuve du SQL.
- **Preview Vercel** : Google exige `AUTH_REDIRECT_PROXY_URL` (+ `AUTH_SECRET`
  identique Preview/Prod) ou le lien magique via `BREVO_API_KEY` ; la base
  est exclusivement `PREVIEW_DATABASE_URL` (jamais de fallback prod). Les
  migrations preview restent manuelles (le runner auto ne couvre que prod).
- **Champs d'édition en double** : les libellés du formulaire « Informations »
  (`[edition]/infos/page.tsx`) recopient ceux d'`EditionChampsCommuns.tsx`
  (modale de création). Un changement de libellé se fait à deux endroits.
  Piste : descripteurs partagés à côté du fragment Zod.
- **Migrations numérotées** : 5 paires de doublons (010/011/012/032/044) ;
  jamais exécutées par le runner auto — historique documentaire. Rejeu manuel
  déconseillé (033/034 non rejouables après 035).

- **TIME sans type parser global** : `db.ts` normalise DATE en chaîne mais pas
  TIME — chaque point de lecture d'`heure_debut`/`heure_fin` doit se souvenir
  d'appeler `hhmm` (3 libs : tremplin-ateliers, mes-ateliers, tremplin-coachs ;
  l'oubli redonne « 18:30:00 », bug corrigé au lot A de la refonte). Piste :
  `types.setTypeParser(TIME, v => v.slice(0,5))` dans `db.ts`, retirer `hhmm`
  des bords ; ou a minima déplacer `hhmm` vers `format.ts`.
- **Inscription refusée = accès conservé à l'espace édition** : la règle
  d'accès (`canViewEditionSpace`, `getEditionsForUser`) ne teste que
  l'EXISTENCE d'une inscription, sans filtrer `statut = 'refusee'`. Antérieur
  à la refonte, plus visible avec l'agrégation « toutes éditions » (onglet
  Documents, agenda). Décision produit à trancher, puis encoder la règle en
  UN endroit avec un test qui la fige.
- **`<main>` imbriqués (motif global, ~40 pages)** : le layout racine fournit
  déjà `<main id="main-content">` ; beaucoup de pages rendent un second
  `<main>` dedans (HTML invalide, double landmark, RGAA 8.2).
  `ListPageTemplate`, les pages de la coquille et les tableaux de bord admin
  sont passés en `<div>` ; reste à balayer les autres pages (chercher
  `<main className="py-10`).
- **Focus invisible en contrastes forcés** : le patron du site
  `focus-visible:outline-none` + `ring` (box-shadow) disparaît sous Windows
  High Contrast (les box-shadows y sont supprimés). Piste globale : outline
  transparent (`focus-visible:outline-2 focus-visible:outline-transparent`)
  en plus du ring — l'outline redevient visible en forced-colors.

## Historique

### Soldé entre le 2026-07-03 et le 2026-07-30 (vérifié dans le code)

Les 4 P0 de juillet (redirect RGPD `/tremplin/participantes`, mentions
légales Tremplin, test de drift des schémas, test de `db.ts`) ; E2E des
gardes d'accès (`e2e/auth.spec.ts`) ; les 3 actions redirect à saisie et
l'échec d'e-mail d'invitation (pattern `ActionState`) ; split de la page
admin d'édition en hub + sous-pages (214 lignes, `HiddenIds` supprimé) et
bascules sans rechargement ; couverture SQL réelle des modules `profiles`,
`talks`, `cfp-suggestions`, Tremplin et `users` (PGlite, lots 1-4 de l'audit
tests du 07-09) ; repli des vues Sessionize du moissonneur ; migration
« sujet → talk pitché » + retrait de la colonne `sujet` (033-035) et ses
gardes RGPD recentrées ; PR perf 07-20 rounds 1-3 (Promise.all, preconnect,
lazy avatars, Zod et Radix hors bundle anonyme, `React.cache`, budgets
Lighthouse en warn, code mort supprimé) — SAUF l'ISR `/speakeuses`, annulée
(voir Recalages) ; contact modéré (digest, rate-limit durable) ; duplication
d'édition (raccord conf/lieu compris) ; paliers de suppression §10
(`plierConfirmation` partagé client/serveur, `DeleteEditionDialog` supprimé,
palier 3 sur l'édition en préparation et le retrait de participante,
libellés normalisés, emphase inversée des ~20 modales, `aria-disabled`) ;
contour `border-field-border` de `ChampTexte` (#232) ; conférences par
`ChampTexte` (#227) ; provenance du journal de consentement (migration 037) ;
migration de schéma automatique au déploiement prod (#193) ;
`isUniqueViolation()` (9 sites) ; `INDEXNOW_KEY` configurée.

Fusionné le 07-30 avec cette revue : PR #233 (nom de compte condition de
publication — motif de blocage centralisé `raisonBlocageAnnuaire`, garde en
SQL dans `setProfileStatus`, borne de `users.name` aux 4 chemins d'écriture,
fin de l'échec silencieux du stepper, champs longs en `multiligne`, registre
`champs-profil.ts` testé sur le formulaire rendu) ; PR #241 (éditeur
d'article : Markdown, liens, CTA) ; PR #243 (phase 3 du Tremplin 2026,
migration 046). Les items restés ouverts de #233 sont ventilés en P1
(fiches publiées sans nom) et P2 (`optionalText`, bandeau d'erreurs, barre
collante, stepper muet, `border-navy-lighter` résiduel, JWT `name`,
cohabitation `hint`/`error` de `ChampTexte`).

### Audit 2026-06-27 (résumé)

Tout le P0/P1/P2 de juin est en prod (PR #81-#93) : recherche branchée sur
l'annuaire BDD, `npm audit` purgé, gardes des server actions testées, client
Brevo dédupliqué, validation d'env au démarrage, `auth-guards.ts`, clé
IndexNow en env. Décisions conservées : `force-dynamic` gardé sur les pages
par-utilisateur ; CSP reportée ; `profiles.ts` volumineux accepté ;
`next-auth` beta accepté.
- **~~Compteur sur l'onglet « À faire »~~ — LIVRÉ autrement (étape B, 2026-08-18)** :
  un POINT, pas un compteur (D3, tranché par Cateline le 2026-08-17), calculé
  par `desTachesAttendent()` dans `BottomNavServeur` (devenu `NavEspaceServeur` le 2026-10-15). La piste « compteur SQL
  dédié » notée ici a été examinée et **rejetée** par la conception : une
  seconde définition de ce qu'est une tâche divergerait du moteur, et un signal
  qui diverge est pire qu'une absence de signal. Le coût assumé (chargement
  complet pour une orga hors de la page « À faire », mémoïsé par requête) et
  sa porte de sortie sont dans D3, risque 1.

### Suites des revues des lots C/D/F/G (2026-07-31)

Trois revues (qualité, RGAA+RGPD, UX/UI) ont tourné sur les lots C, D, F et G.
Tous les P0 et P1 sont appliqués (PR de la refonte). Restent ouverts, par
décision :

- **Garde-fou typographique à étendre.** `french-spelling.test.ts` scanne
  désormais, en plus de `src/data`, une liste EXPLICITE de fichiers de `src/lib`
  et `src/components` qui produisent de la copie (lecture par AST TypeScript,
  arguments de `console.*` exclus). Le reste du code porte encore une trentaine
  de manquements antérieurs à l'espace insécable — surtout les e-mails
  (`digest-email`, `moderation-email`, `tremplin-email`), les messages de
  formulaire (`profile-form`, `tremplin-form`, `contenu-form`) et quelques
  composants (`ClearableInput`, `PitchedTalkPicker`). À reprendre par paquets, en
  ajoutant chaque fichier à `FICHIERS_COPIE` au fur et à mesure. Question de
  fond à trancher au passage : l'insécable a-t-elle un sens dans un e-mail en
  texte brut ?
- **Filtre de phase perdu au retour.** La liste des participantes est un hub :
  on ouvre une fiche, on revient, et les chips repartent sur « Toutes » (l'état
  vit dans `useState`, ni dans l'URL ni mémorisé). Piste : `?phase=` en
  `searchParams` + `router.replace(…, { scroll: false })`, ce qui rendrait aussi
  la vue partageable.
- **`aria-pressed` sur une sélection exclusive : TRANCHÉ (2026-08-02), plus une
  dette.** L'item demandait de convertir les filtres exclusifs en `tablist` (avec
  navigation aux flèches) ou en `radiogroup`. Décision inverse, prise en revue
  RGAA d'`/actualites` : ces motifs promettent un clavier (flèches, tabindex
  baladeur, `tabpanel` associé) que des filtres de liste n'ont pas, et l'annonce
  « onglet 2 sur 5 » devient un mensonge. Le motif maison est donc
  `aria-pressed` dans un `role="group"` étiqueté, désormais uniforme sur les
  QUATRE surfaces (`RosterFilter`, chips de participantes, catégories et statut
  d'`/actualites`). Il n'est plus en prose mais **dans le code** : `FilterGroup`
  possède le `role` et l'intitulé, `LiveStatus` la région d'annonce, et
  `FilterChip` renvoie vers eux. Ne pas rouvrir sans changer aussi la
  déclaration d'accessibilité (`/mentions-legales`).
- **Repère « Aujourd'hui » et mois collant dans l'agenda des ateliers.** L'agenda
  personnel (`/mon-espace/agenda`) a un en-tête de mois collant et groupe par
  jour ; la liste admin des ateliers a des mois simples et une colonne de date.
  Les deux surfaces gagneraient le même gabarit (§2.4 demande aussi un filet
  « Aujourd'hui »). Le cockpit portant déjà « prochain rendez-vous », ce n'est pas
  urgent.
- **Lot G partiellement livré.** §8 demande, en plus du récit : le découpage de
  la page publique d'édition en actes (elle fait ~20 écrans sur mobile) et la FAQ
  en accordéon (aujourd'hui cinq cartes dépliées). Le récit, la durée
  d'accompagnement chiffrée et le retour de la fenêtre de candidature sont
  livrés ; la mise en scène reste à faire.
- **Pas d'appel à l'action de candidature sur la page d'édition.** Le kicker dit
  « Candidatures ouvertes jusqu'au 17 avril » quand la fenêtre est ouverte, mais
  il n'existe aucune URL de candidature dans le référentiel (la FAQ renvoie à
  « reste à l'affût »). Décider où mènent les candidatures, puis poser le bouton.
- **Bloc de faits partagé entre le cockpit et la fiche atelier.** Le cockpit rend
  quand / heures / lieu / nature / qui en `metaLine` jointe par « · », la fiche en
  `<dl>` étiquetée (`FaitsAtelier`). Même notion, deux présentations : une variante
  compacte de `FaitsAtelier` les réunirait, à faire quand le cockpit repassera en
  revue.
- **Images déposées AVANT la mesure : taille toujours inconnue.** La migration
  065 enregistre `image_width`/`image_height` au dépôt, ce qui réserve la place
  de la photo en tête d'article (le titre ne saute plus). Les images déjà en
  base, elles, n'ont pas été mesurées : leur article garde l'ancien
  comportement. Aucune migration ne peut les rattraper (mesurer suppose de
  décoder le fichier), mais rien ne bloque : rouvrir l'article et redéposer la
  photo la mesure. À traiter au fil de l'eau, ou par un script ponctuel qui
  téléchargerait chaque `image_url` pour la mesurer si le lot devenait gênant.
