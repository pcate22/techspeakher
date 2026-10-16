# Revue avant PR — les quatre passes

> Doc **transversal et durable**, à lire avant d'ouvrir une pull request. La
> version courte (quoi lancer, dans quel ordre) tient dans `CLAUDE.md` §Git ;
> ici vivent la méthode, les raisons, et les précédents qui les ont imposées.
>
> Voisins : `docs/principes-tests.md` (ce que les tests ne sauront pas faire),
> `docs/principes-conception-ui.md` (le référentiel de la 4ᵉ passe).
>
> Écrit le **2026-08-16**.

## Les quatre passes, et la question de chacune

| Passe | Question | Quand |
|---|---|---|
| `/simplify` | **Est-ce bien écrit ?** | toujours, **en premier** |
| `/code-review` | **Est-ce juste ?** | toujours |
| `/security-review` | **Est-ce exposé ?** | auth, Server Actions, RGPD, données personnelles |
| UX/UI + RGAA + wording | **Est-ce vivable ?** | dès qu'un texte ou un pixel change |

Quatre questions distinctes, et aucune ne couvre les autres :

- sauter la première fait passer du code juste, mais mal posé — il coûte à
  chaque lecture ensuite ;
- sauter la quatrième fait passer du code juste, sûr et propre que quelqu'un
  n'arrivera pas à utiliser. Aucune des trois autres ne regarde un écran, et
  c'est précisément ce que `principes-tests.md` range dans « ce que les tests ne
  sauront pas faire ».

La CI (`test` + `type-check` + `lint` + E2E) reste le garde-fou dur. Les revues
attrapent en amont ce qu'elle ne voit pas : la logique, l'altitude, l'écran.

**Ce que les quatre passes attrapent TARD : ce qui était déjà là.** La dette de la
zone traversée et les tests qui gardaient déjà la fonction touchée se traitent
**en écrivant** (`CLAUDE.md` §Toucher à du code existant, `principes-tests.md`
§9) : arrivé en revue, la correction coûte un aller-retour au lieu d'un geste.
Mais **rien n'est hors périmètre parce que la ligne n'a pas changé** — une passe
qui voit un test hérité faux, ou de la dette, dans un fichier qu'elle ouvre le
signale. Le précédent du 08-17 est exactement ça : l'assertion trop faible vivait
dans un fichier que le commit éditait, 25 lignes sous le hunk qu'il venait de
soigner.

**Corriger ou justifier chaque finding avant d'ouvrir la PR**, et dire dans le
corps de la PR ce que chaque passe a trouvé — y compris « aucun finding ».

Le corps de la PR dit aussi trois choses que les passes ne voient pas : la
**dette soldée** (avec ses numéros), les **tests hérités re-jugés** (avec la
mutation faite) et le **ménage des docs de passation**
(`docs/clore-une-session.md`). « Rien croisé » est une réponse valable ; le
silence, non.

## Pourquoi `/simplify` passe en PREMIER

Pour que la revue de correction juge la **forme définitive**. L'inverse ferait
valider un code qu'on réécrit ensuite.

C'est aussi la seule des quatre qui **applique** ses correctifs au lieu de
rapporter des findings — d'où la règle qui suit.

**Et si `/simplify` a touché à du sensible, REJOUER `/code-review` (et
`/security-review`) sur ses seuls correctifs.** Jamais inverser l'ordre :
rejouer coûte un périmètre étroit (`git diff <commit-simplify>`), inverser coûte
une revue sur une forme périmée.

« Sensible » = une garde d'autorisation, une **décision de branchement** (quel
chemin s'exécute), une écriture ou un effacement, du RGPD, des données
personnelles, un Server Action. Un nettoyage de confort — nommage, doublon de
style, commentaire — n'appelle rien.

> **Le précédent qui a imposé la règle (2026-08-16, PR #330).** `/simplify`
> avait ajouté une garde d'exhaustivité de type sur les attributs Brevo,
> correcte en soi. Son commentaire promettait « un attribut ajouté devient une
> erreur de compilation » — mais une des TROIS tables d'attributs restait un
> littéral sans lien de type. Un attribut ajouté compilait donc, n'était jamais
> créé chez le sous-traitant, et rendait un compte **insupprimable**. La revue
> rejouée l'a vu ; personne d'autre ne le pouvait, puisque ce correctif
> n'existait pas quand la revue de correction est passée.

## Les revues se lancent en AGENTS AUTONOMES, en parallèle

**Autorisation permanente du dépôt : aucune validation à demander.** C'est le
mode natif de ces passes.

- **un agent par angle** — réemploi, simplification, efficacité, altitude ;
  sécurité à part ; UX/UI, RGAA et wording quand un écran change ;
- **lancés en un seul envoi**, pour qu'ils tournent ensemble ;
- **chacun avec son référentiel nommé** dans son ordre de mission, un périmètre
  étroit, et la consigne de **ne rien modifier** ;
- puis **dédoublonner les findings et appliquer soi-même**.

Pourquoi c'est écrit noir sur blanc : une revue menée en ligne, par la tête qui
vient d'écrire le code, relit le diff avec les yeux de qui l'a produit — **elle
confirme, elle ne cherche pas**. Des relecteurs séparés, chacun aveugle aux
autres, trouvent ce qu'on ne pense pas à chercher.

Ce que le dépôt a mesuré (2026-08-16, tout le même jour) :

| Ce qui a été lancé | Ce que ça a trouvé |
|---|---|
| relecture croisée à 5 sur les mergés de juillet | **quatre** défauts à conséquence sur les données (dette P0 4-7) |
| `/code-review` en agents | `BREVO_LIST_COMPTES` vide rendait un compte **insupprimable** |
| efficacité **et** altitude, séparément | le même défaut, vu de deux angles : un SDK réseau entré dans le graphe des pages publiques |
| sécurité en agent | l'adresse e-mail fuyait dans les journaux, sur le chemin de l'effacement RGPD — la même revue menée en ligne l'avait manquée |
| UX/UI + RGAA + wording, sur **une seule phrase** à l'écran | six défauts, dont un **500 sur URL forgée** que la revue sécurité n'avait pas vu |

**Un rapport VIDE est une réponse valable.** Le dire, plutôt que d'inventer un
finding pour justifier la passe.

## La 4ᵉ passe : ce que chaque angle regarde

Référentiel commun : `docs/principes-conception-ui.md`. Les règles de fond
(typographie, forme positive, RGAA) vivent dans `CLAUDE.md` §Conventions — on ne
les recopie pas ici, on les applique.

### UX/UI

La règle d'or (une page = un rôle, un CTA principal maxi), le hub-and-spoke, et
le §10 pour les gestes destructifs.

Surtout, **le cap** : charge cognitive minimale et inclusion réelle. Notre
public est sur téléphone, dans des contextes variés, **parfois neuro-atypique**.
Loi de Hick — chaque option coprésente ralentit la décision. Mémoire de travail
limitée — ce qui est visible PÈSE, même inutilisé.

> Un écran qui « marche » et fatigue est un écran à refaire.

### RGAA

Juger **ce que vit une personne** au lecteur d'écran ou au clavier, jamais la
présence d'attributs. Deux pièges que le dépôt a payés :

- **une région vive n'annonce que ce qu'on y insère APRÈS son montage** : un
  message présent dans le HTML initial reste MUET (`ConfirmationBanner` existe
  pour ça) — et deux fois le même message sur la même URL n'annonce rien non
  plus, faute de mutation ;
- **le focus après une action** : le perdre renvoie au haut du document
  (`SettingToggle` documente la mesure).

### Wording

Forme positive, insécables, aucun cadratin, ton naturel — le détail est dans
`CLAUDE.md` §Langue et ton.

Le point de méthode propre à la passe : **vérifier sur les CARACTÈRES du
fichier**, pas à l'œil. `french-spelling.test.ts` ne scanne que `src/data` plus
une liste blanche explicite : une faute dans `src/app` ou `src/components` ne
sera rattrapée par personne. Quand la passe en trouve une, **ajouter le fichier
à la liste** vaut mieux que corriger la phrase : sinon la suivante repasse.
