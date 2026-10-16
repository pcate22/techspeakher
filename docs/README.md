# Bienvenue dans le code de Tech Speak'Her

> Page d'accueil pour une personne qui découvre le dépôt. Écrite le
> 2026-10-16, à partir de `docs/audit-reprise-humaine.md`.

Ce dépôt contient le site [techspeakher.fr](https://techspeakher.fr) et sa
plateforme : l'annuaire des speakeuses, leur espace connecté, l'espace des
organisatrices et le Tremplin, qui accompagne des femmes vers leur première
conférence.

La plupart du code est écrit avec des sessions Claude (une IA), et beaucoup
de docs sont écrits pour elles. Vous n'avez pas besoin de Claude pour lire,
lancer ou modifier le code.

## Par où commencer

1. [`README.md`](../README.md) à la racine : lancer le site.
2. [`CONTRIBUTING.md`](../CONTRIBUTING.md) : proposer un changement.
3. [`architecture.md`](./architecture.md) : la carte technique (rôles,
   modèle de données, sécurité).
4. Le [glossaire](#glossaire) en bas de cette page.

## Où est quoi

| Je cherche | Où regarder |
|---|---|
| une page du site | `src/app/` suit les URL : `/speakeuses` est dans `src/app/speakeuses/page.tsx` |
| ce que fait un formulaire ou un bouton (Server Action) | le fichier `actions.ts` du dossier de la page |
| la logique métier et les requêtes SQL | `src/lib/`, un fichier par sujet (`profiles.ts`, `talks.ts`, `tremplin-*.ts`…) |
| un composant d'interface | `src/components/` ; les briques sont décrites dans [`design-system.md`](./design-system.md) |
| un texte fixe du site (FAQ, charte, actualités…) | `src/data/` |
| une URL ou une adresse e-mail du site | `src/constants/site.ts` |
| les couleurs | `src/app/globals.css` |
| le schéma de la base | `db/schema.sql` ; chaque évolution a sa migration dans `db/migrations/` |
| qui a le droit d'aller où | `src/proxy.ts`, puis `src/lib/auth-guards.ts` dans chaque page |
| les tests | `src/__tests__/` (Vitest) et `e2e/` (Playwright) |

## Les trois niveaux de démarrage

- **Lancer les tests** : `npm install`, puis `npm run test`. Aucune
  configuration, aucune base à installer.
- **Voir le site avec des données fictives** : un Postgres sur votre machine
  et une commande qui pose des personnes inventées. La recette est dans le
  [démarrage rapide du README](../README.md#démarrage-rapide).
- **Se connecter** (espace membre, admin) : il faut configurer la connexion
  Google ou LinkedIn pour `localhost`, ou une clé Brevo pour le lien magique.
  Pas à pas : [`plateforme-setup.md`](./plateforme-setup.md) §3 et §4.

## Les docs, rangés par statut

**À jour, à consulter selon le besoin.**

- [`architecture.md`](./architecture.md) : la carte technique.
- [`exploitation.md`](./exploitation.md) : mise en production, base, e-mails, tâches courantes.
- [`plateforme-setup.md`](./plateforme-setup.md) : les comptes à créer (Neon, Google, LinkedIn, Vercel).
- [`design-system.md`](./design-system.md) : les briques d'interface.
- [`conception-synchro-contacts.md`](./conception-synchro-contacts.md) : qui écrit quoi entre la plateforme, Brevo et HelloAsso.
- [`roadmap.md`](./roadmap.md) : ce qu'on fait ensuite.
- [`dette-technique.md`](./dette-technique.md) : ce qui reste à réparer, par priorité.
- [`audit-reprise-humaine.md`](./audit-reprise-humaine.md) : ce qui freine une nouvelle venue, et le plan.
- [`google-ad-grants.md`](./google-ad-grants.md) : conformité du site pour Google Ad Grants.
- [`diffuser-actualites-rss.md`](./diffuser-actualites-rss.md) : brancher le flux RSS des actualités.
- [`brouillons-articles/`](./brouillons-articles/README.md) : textes en attente de relecture.

**La méthode de travail.** Écrite pour les sessions Claude ; utile à tout le
monde pour comprendre les choix, sans obligation pour une humaine
(voir `CONTRIBUTING.md`).

- [`CLAUDE.md`](../CLAUDE.md) et [`AGENTS.md`](../AGENTS.md) : les règles des sessions.
- [`principes-conception-ui.md`](./principes-conception-ui.md) : comment on conçoit un écran.
- [`principes-tests.md`](./principes-tests.md) : comment on écrit un test, et les erreurs déjà faites.
- [`revue-avant-pr.md`](./revue-avant-pr.md) et [`clore-une-session.md`](./clore-une-session.md) : relire avant d'ouvrir une PR, tenir les docs à jour.

**Traces de conception.** Le raisonnement d'une fonctionnalité au moment où
on l'a conçue. Le code a pu changer depuis : le code et `architecture.md`
font foi.

- *Tremplin* : `plateforme-conception-fonctionnelle`, `plateforme-conception-technique`,
  `tremplin-implementation`, `tremplin-edition-publique`, `tremplin-duplication-edition`,
  `parcours-participante`, `conception-phases-tremplin`, `conception-deux-temps-edition-publique`,
  `conception-sous-groupes-ateliers`, `conception-suppression-edition`, `espace-coach`,
  `photos-tremplin`, `recompenses-tremplin`, `conception-technique-recompenses`,
  `conception-autorisation-diffusion`, `implementation-autorisation-diffusion`,
  `conception-talk-pitche-migration`, `refonte-ux-fiches-tremplin`, `ux-admin-edition`,
  `conception-technique-hub-tremplin`, `conception-personne-et-toutes`, `conception-champ-personne`,
  `audit-ux-mobile-2026-07`.
- *Annuaire, talks et conférences* : `migration-speakeuses`, `faisabilite-import-talks`,
  `conception-registre-conferences`, `implementation-registre-conferences`,
  `conception-talk-conference-edition`, `conception-talk-multi-conferences`,
  `conception-logos-conferences`, `conception-conference-lieu`,
  `conception-arbitrage-conferences`, `audit-ux-agenda-2026-08`.
- *Espace connecté* : `conception-fil-communaute-espace`, `conception-espace-fil-navigation`,
  `conception-lot-n1-navigation`, `conception-lot-n2-fil`, `conception-lot-n3-articles`,
  `conception-lot-n4-reactions`, `conception-profil-et-a-faire`,
  `conception-technique-profil-et-a-faire`, `revue-conception-a-faire-2026-08`,
  `audit-ux-profil-orga-2026-08`, `audit-menu-compte`, `conception-cadence-rappels`,
  `conception-relance-brouillons`.
- *Espace des organisatrices* : `conception-tableau-de-bord-orga`,
  `conception-technique-tableaux-de-bord`, `conception-audit-orga-lot-a`.
- *Contenus et recherche* : `conception-articles`, `implementation-articles`,
  `conception-recherche-contenus`, `implementation-recherche-contenus`.
- *Comptes, RGPD, adhésions* : `conception-conservation-comptes`, `conception-adhesions-helloasso`.
- *Revues et audits passés* : `revue-ux-rgaa`, `audit-e2e-parcours-2026-08`.

Tous ces fichiers sont dans `docs/`, avec l'extension `.md`.

## Glossaire

| Mot | Sens |
|---|---|
| **Speakeuse** | Une femme qui prend la parole en conférence. Dans le code : une personne qui a une fiche dans l'annuaire. |
| **Fiche** | Le profil public d'une speakeuse dans l'annuaire (`speaker_profiles`). Elle passe de `brouillon` à `en_attente` (relue par une orga) puis `publie`. |
| **Membre** | Une personne connectée, avec son espace (`/mon-espace`). À ne pas confondre avec une adhérente de l'association. |
| **Adhésion** | La cotisation à l'association, payée sur HelloAsso et recopiée dans la plateforme (`user_memberships`). |
| **Orga** | Une organisatrice : elle a accès à `/admin` (`users.is_orga`). |
| **Coach** | Une personne qui accompagne les participantes du Tremplin (`users.is_coach`). |
| **Talk** | Un sujet de conférence écrit par une speakeuse (`speaker_talks`). |
| **Occurrence** | Une fois où un talk a été donné : une conférence, une date, un lieu (`talk_occurrences`). Un talk sans occurrence est un sujet proposé. |
| **Conférence, édition de conférence** | Un événement (DevFest Toulouse) et son passage d'une année donnée (DevFest Toulouse 2026). Tables `conferences` et `conference_editions`. |
| **Tremplin** | Le dispositif d'accompagnement vers une première conférence : ateliers, finale devant un jury, récompenses. |
| **Édition (du Tremplin)** | Un Tremplin lié à une conférence partenaire et une année. Page publique `/tremplin/[conf]/[annee]`. |
| **Phase** | Les trois temps d'une édition : avant la soirée (CFP et pitch), la soirée et le jury (finale), après la soirée (montée sur scène). |
| **Atelier** | Une séance d'une édition, en visio ou sur place, avec ses membres et leurs présences. |
| **Participante, inscription** | Une femme inscrite à une édition (`tremplin_registrations`). |
| **Talk pitché** | Le talk qu'une participante présente pendant le Tremplin. |
| **CFP** | *Call for papers* : l'appel à propositions d'une conférence. |
| **Décor** | Le jeu de données fictives (`db/seed-preview.sql`) : des personnes inventées, pour les tests et pour découvrir le site en local. |
| **Session Claude** | Une conversation avec l'IA Claude qui écrit du code dans ce dépôt. |

## À savoir en lisant le code

- Les numéros `#123` ou « PR #123 » dans les docs et les commentaires
  renvoient à l'**ancien dépôt**, privé. Le dépôt public commence par un seul
  commit le 16/10/2026 : `git blame` ne remonte pas plus loin.
- Les commentaires expliquent souvent le pourquoi en détail. Certains
  racontent aussi quand et comment un problème a été trouvé (une date,
  « revue du … ») : c'est de l'histoire, le pourquoi suffit.
- Les noms de fonctions mêlent français et anglais (`createEditionAction`,
  `deplacerAtelierAction`). C'est connu et assumé : le glossaire aide à s'y
  retrouver.
- Next.js 16 diffère des versions précédentes : avant d'écrire du code qui
  touche au framework, lisez le guide concerné dans
  `node_modules/next/dist/docs/`.
