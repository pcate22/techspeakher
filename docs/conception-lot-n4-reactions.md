# Lot N4 — Les réactions sur les cartes du fil (conception détaillée)

> Statut : **VALIDÉE par Cateline le 2026-08-08** (« Puis go avec toutes
> les revues ») sur la maquette une-ligne — les cinq questions du §7 sont
> tranchées dans le sens des propositions.
> Cadre : `docs/conception-espace-fil-navigation.md` §8 (point 1) —
> « l'encouragement, le mot de la mission. […] compteur nominatif
> (« Léa et 4 autres »), ZÉRO texte donc zéro modération. »
> Revue de conception passée le 2026-08-08 (20 findings corrigés ici).

## 1. Le rôle du lot

Le fil (lot N2) montre des faits ; le Bravo est la première **réponse** de la
communauté à un fait : Léa monte sur scène, Salomé rejoint l'annuaire, Nawel
publie un article — et les copines applaudissent. Un geste, pas un texte :
l'encouragement sans la charge de modération.

- **Un applaudissement est nominatif** (doctrine §8 : « un applaudissement
  anonyme ne vaut rien ») : la carte dit « Léa M. et 4 autres », sur une
  ligne, à côté du bouton.
- **Une réaction va à une PERSONNE, pour son geste** (retours de Cateline sur
  le fil réel, 2026-08-08) : seules les cartes INCARNÉES en portent une — une
  scène, une arrivée dans l'annuaire, l'article d'une membre. Une actualité
  signée Tech Speak'Her n'a personne à féliciter : **aucune rangée** sur sa
  carte, et le SQL la refuse (`auteur_user_id` requis). Même raison pour
  écarter la réaction sous l'article : on salue quelqu'un, pas un texte.
- **UN geste, TROIS mots** (« objectif : se motiver » — un mot faux démotive
  plus qu'il n'encourage) : **Bravo 👏** sur une scène (elle a fait la chose
  difficile), **Bienvenue 👋** sur une arrivée dans l'annuaire (elle n'a rien
  accompli : on l'accueille), **Merci 💜** sur l'article d'une membre (elle a
  partagé pour les autres). Le mot se DÉRIVE du type de carte : rien de plus
  en base. **Écartés** : « J'aime » et « Intéressant », qui jugent le contenu
  (et depuis le fil, personne ne l'a lu) — et « Intéressant » sonne tiède en
  français.
- **Interne à l'espace connecté** : le fil est déjà réservé aux connectées ;
  les bravos aussi — rien n'en sort sur le site public. `reactions.ts` refuse
  de servir hors session (garde dans la lib, pas seulement dans la page),
  et un test le prouve.
- **Zéro texte libre** : donc zéro signalement, zéro file de modération.

## 2. Les données

### 2.1 La table `fil_reactions`

Migrations `db/migrations/063_bravos.sql` + `064_fil_reactions.sql` (le nom
juste et son préfixe de domaine, comme `tremplin_*`, plus la purge des
réactions posées sur une actualité de l'asso — retours de Cateline) **et**
`db/schema.sql` **et** `db/sync-to-latest.sql` (idempotent).

```sql
CREATE TABLE IF NOT EXISTS fil_reactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- LA cible : exactement une des trois sources du fil (les cartes sont
  -- dérivées, jamais stockées — on référence la ligne source, et la
  -- suppression de la source emporte ses bravos, gratuitement).
  occurrence_id INTEGER REFERENCES talk_occurrences(id) ON DELETE CASCADE,
  profile_id INTEGER REFERENCES speaker_profiles(id) ON DELETE CASCADE,
  contenu_id INTEGER REFERENCES contenus(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fil_reactions_cible_ck CHECK (
    (occurrence_id IS NOT NULL)::int + (profile_id IS NOT NULL)::int
      + (contenu_id IS NOT NULL)::int = 1
  )
);
-- Un bravo par membre et par carte. La CIBLE d'abord : le même index sert
-- l'unicité, la lecture du fil (filtre par cible) et les cascades FK —
-- trois usages, trois objets, zéro doublon.
CREATE UNIQUE INDEX IF NOT EXISTS fil_reactions_occurrence_uq
  ON fil_reactions (occurrence_id, user_id) WHERE occurrence_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fil_reactions_profile_uq
  ON fil_reactions (profile_id, user_id) WHERE profile_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fil_reactions_contenu_uq
  ON fil_reactions (contenu_id, user_id) WHERE contenu_id IS NOT NULL;
```

### 2.2 RGPD (base légale, retrait, cascades)

- **Donnée nouvelle** : « {membre} a applaudi {carte} », datée
  (`created_at` sert la datation RGPD, jamais l'affichage). Visible des
  seules connectées, dans le fil. Base : intérêt légitime de l'association
  (vie communautaire interne), geste volontaire et **retirable à tout
  moment** — et ce retrait marche VRAIMENT toujours : la branche RETRAIT du
  toggle est SANS borne de visibilité (voir §4) ; seule la POSE est bornée
  aux cartes visibles.
- **Retrait rétroactif = purge** (doc mère §9 : « fiche retirée = cartes,
  bravos et byline retirés ») : retirer sa fiche **supprime** les bravos
  reçus sur sa fiche et sur ses scènes ; dépublier un contenu (retour
  brouillon) **supprime** les bravos du contenu. Une re-publication repart
  de zéro — rien ne dort en base en attendant.
- **Compte supprimé** : ses bravos DONNÉS partent (CASCADE `user_id`) ;
  les bravos reçus sur sa fiche et ses scènes partent avec elles (CASCADE) ;
  ceux des articles jamais publiés partent avec la purge du lot N3. Les
  bravos sur son article PUBLIÉ (qui survit, signé — cession N3)
  **restent** : chaque bravo est la donnée de sa DONNEUSE, vivante — rien
  du compte supprimé n'y figure.
- **Droit d'accès** : « tout ce que j'ai applaudi, daté » = une requête sur
  `user_id` — à servir manuellement si demandé (volume association). Même
  voie pour le retrait d'un bravo dont la carte a QUITTÉ le fil (plus de
  bouton à l'écran, mais le retrait SQL marche toujours) : servi sur
  demande, en attendant une éventuelle vue « mes bravos ».
- **Modération orga** : masquer ou refuser une fiche purge ses bravos comme
  le retrait volontaire (même helper) — quitter « publié » ne laisse jamais
  rien dormir en base. Les DEUX autres sorties du fil purgent aussi
  (revue post-merge du 2026-08-08) : la re-soumission d'une fiche publiée
  (`submitForValidation`) et l'édition d'un contenu qui efface sa
  destination (`updateContenu`, le miroir `CONTENU_AU_FIL` décide).
- **Nom affiché** : le nom du COMPTE, vivant (jamais de snapshot : rien
  n'est public, rien n'est cédé).

## 3. Le geste et l'affichage

- Sous chaque carte du fil, **UNE seule ligne**, compacte (retour Cateline
  du 2026-08-08, le modèle des réseaux) : le bouton **Bravo** (👏
  décoratif, `aria-hidden`) puis le compteur nominatif court, SANS verbe —
  le bouton d'à côté dit déjà le geste : « Toi, Salomé D. et 3 autres »,
  « Léa M. », rien si zéro (jamais « 0 bravo »). Le compteur se tronque à
  l'ellipse plutôt que de passer à la ligne ; un complément `sr-only`
  (« ont applaudi ») garde la phrase entière pour le lecteur d'écran.
- **Le libellé visible reste « Bravo », toujours** : l'état pressé est
  porté par `aria-pressed` et, visuellement, par **une coche ✓ qui
  s'ajoute** (décorative, `aria-hidden`) et la graisse — **jamais la
  couleur seule** (RGAA 3.2 : la couleur renforce, elle ne porte pas).
  Le nom accessible COMMENCE par le libellé visible (WCAG 2.5.3) :
  « Bravo » + complément `sr-only` « — Léa Marchand, sur scène ».
- **Le compteur dit l'état en texte** quand on a applaudi : il commence
  par « Toi, … » — le TEXTE porte l'information, la coche et la couleur la
  renforcent.
- Le nom cité (après « Toi ») est celui du **premier** bravo (ordre par
  `id` croissant) : déterministe, et re-applaudir ne fait gagner aucune
  place. Une donneuse sans nom de compte est sautée dans la citation
  (repli : « 3 membres » si personne n'a de nom).
- **Re-tap = retrait** du sien. Formulaire natif (Server Action) qui porte
  l'**intention** vue à l'écran (`applaudir` ou `retirer`) : un
  double-submit rejoue la même intention — idempotent, jamais un
  applaudissement qui s'annule lui-même.
- **Sa propre carte se lit sans bouton** : on s'applaudit entre copines,
  jamais soi-même (proposition, Q1). Le compteur, lui, s'affiche — c'est là
  que la speakeuse REÇOIT l'encouragement.
- La carte reste UN lien (RGAA) : la rangée bravo vit HORS du lien (même
  patron que « Modifier » sur `CarteActualite` : au-dessus de la couche
  cliquable), avec une marge autour de la rangée (un tap raté ne doit pas
  naviguer).
- **Aucune notification** : la speakeuse voit ses bravos sur ses cartes dans
  le fil (et c'est tout, jusqu'à la messagerie du lot N5).

## 4. La mécanique (Server Action + lib)

- `bravoAction(formData)` : identité de **session** ; entrées validées
  (type dans la liste fermée `scene|venue|asso`, id entier positif,
  intention `applaudir|retirer`).
  - **Applaudir** : la cible doit être une carte que le fil peut montrer,
    re-vérifiée en SQL avec les **règles EXACTES des trois sources,
    partagées** — B1 extrait les fragments WHERE existants au lieu de les
    réécrire : scènes (`SELECT_SCENES` de `agenda-public.ts` : fiche
    publiée, talk hors tremplin, date passée, nom présent), venues
    (`fil-communaute.ts` : `published_at` posé, nom présent), contenus
    (`filtreDestination` de `contenus.ts` : publié avec destination).
    L'INSERT embarque la vérification (`INSERT … SELECT … WHERE EXISTS`,
    pas de TOCTOU) avec `ON CONFLICT` sur l'index partiel de la cible
    (prédicat répété). Et jamais sa propre carte : propriétaire re-borné en
    SQL — `profile → "userId"`, `occurrence → talk → profil → "userId"`,
    `contenu → auteur_user_id` (NULL = actu de l'asso : sans propriétaire,
    applaudissable par toutes).
  - **Retirer** : `DELETE` borné à `user_id = session` + la cible — SANS
    borne de visibilité : son bravo se retire toujours (§2.2).
  - **Réponse UNIFORME** : cible inexistante, invisible, ou sa propre
    carte → exactement le même retour silencieux (zéro ligne écrite, même
    état rendu). Aucune différence observable : l'action ne dit jamais
    « ça existe mais tu ne peux pas » — pas d'oracle des brouillons.
- `src/lib/bravos.ts` : `poserBravo(userId, cible)`, `retirerBravo(userId,
  cible)`, `getBravosPourFil(cartes, userId)` — prend les `CarteFil`
  fusionnées (type + id structurés, jamais de clé string à re-parser), UNE
  requête pour tout le fil (`count`, première donneuse nommée par
  `array_agg(u.name ORDER BY b.id)`, `bool_or(user_id = $me)`). C'est **un
  aller-retour de plus** après `fusionnerFil` — assumé, c'est le prix des
  cartes dérivées. La lib exige la session (garde interne) : aucun composant
  public ne peut la réutiliser par accident.
- **Purges du retrait rétroactif** (§2.2) : le retrait de fiche
  (`retirerFiche`) supprime les bravos de la fiche et de ses occurrences ;
  `setStatut` vers `brouillon` supprime les bravos du contenu.
- **Anti-abus** : l'unicité borne l'état (un bravo par carte et par
  membre) ; le **débit** est borné par `src/lib/rate-limit.ts` sur LES DEUX
  branches — pose (30/min) et retrait (60/min, large : la borne arrête un
  script, jamais une main, et le retrait d'une humaine passe toujours).
- **Borne de la pose, au niveau SOURCE (assumé)** : « une carte que le fil
  peut montrer » = les règles de visibilité des trois sources, PAS
  l'appartenance à la fenêtre des 20 cartes du moment (un contrôle
  d'appartenance au top-20 serait fragile et coûteux pour rien : la cible
  reste une donnée déjà visible des connectées).
- **Jamais un throw vers la page** : `reactionAction` attrape tout échec base
  (table absente en preview, connexion) et le rend en état d'erreur — le
  bouton revient en arrière, l'alerte le dit, le fil reste le fil du
  lot N2.
- **Et ce que l'action ne peut PAS attraper** : un appel qui n'arrive jamais
  jusqu'à elle — réseau coupé, ou nouvelle version livrée pendant qu'on
  lisait le fil (l'identifiant de Server Action de la page ouverte n'existe
  plus dans le déploiement courant). La promesse rejette alors CÔTÉ CLIENT,
  React relance l'erreur au rendu, et elle remontait jusqu'à `app/error.tsx`
  — tout l'écran remplacé par « Oups », pour un bouton.
  `reagir` (dans `ReactionRow.tsx`) l'attrape à l'endroit exact où elle naît
  et la rend en état d'erreur ordinaire : bouton revenu, alerte déjà montée
  qui le dit, focus conservé, re-tap qui réessaie. **Pas** de limite
  d'erreur (`error boundary`) : elle aurait démonté la rangée — focus perdu,
  compteur perdu, et rien pour revenir sans recharger. Une redirection
  (`digest` `NEXT_*`, session expirée) traverse : ce n'est pas un échec.
- Fenêtre de déploiement : lectures repliées `siTableAbsente([])`,
  écritures des purges via `withTransactionSaufTable("fil_reactions", …)` (UNE
  copie de la mécanique « transaction, sinon rejouer sans la purge », bornée
  à LA table bravos — un 42P01 sur une autre relation remonte), et
  `bravoAction` dégrade en état d'erreur — le fil sans bravos reste le fil
  du lot N2.

## 5. Accessibilité (RGAA)

- Bouton : libellé visible « Bravo » stable, `aria-pressed`, complément
  `sr-only` qui nomme la carte (le nom accessible commence par « Bravo »),
  emoji et coche d'état `aria-hidden`, cible 44 px, focus visible.
- **Jamais la couleur seule** (RGAA 3.2) : l'état pressé se voit par la
  coche ✓ et la graisse, et se LIT dans le compteur (« Toi, … avez
  applaudi ») — la couleur ne fait que renforcer.
- Le compteur est du TEXTE dans un `role="status"` `aria-live="polite"`
  (pattern maison `SettingToggle`/`AnnonceListe`) : la mise à jour
  s'annonce, y compris sur sa propre carte (le canal de réception).
- **Erreurs** : refus ou échec → message `role="alert"` près de la rangée,
  et l'UI optimiste qui revient en arrière le DIT (jamais un rollback
  muet).
- Pattern résultat (`useActionState` + `router.refresh()`, principes §4 —
  JAMAIS de PRG sur une micro-action de liste), focus conservé sur le
  bouton. **Avant hydratation**, un tap est mémorisé puis rejoué par React :
  il part. Chaque carte porte son ancre `#carte-{cle}` comme repère (repli
  et lien profond).
- **Le geste demande JS — arbitrage assumé (2026-08-09).** `useActionState`
  reçoit `reagir`, une fonction CLIENTE, et non la référence de Server
  Action : le formulaire perd donc sa cible de POST native
  (`$$FORM_ACTION`), qui était le seul chemin JS désactivé. On l'échange
  contre le filet ci-dessus (§4) : sans lui, un appel qui n'atteint pas le
  serveur remplaçait TOUT le fil par « Oups » — vu en production le jour du
  lot. Une panne observée pèse plus qu'un repli théorique, pour un bouton
  d'encouragement dans un espace connecté. À reprendre si React expose un
  moyen propre de garder la cible native en enveloppant l'action.

## 6. Étapes (TDD, une PR, après validation)

1. **B1 — le schéma et la lib** : migration 063 **+ `schema.sql` +
   `sync-to-latest.sql`**, fragments SQL de visibilité extraits des trois
   sources (partagés, pas copiés), `bravos.ts`, intégration PGlite
   (intention idempotente, unicité, bornes de visibilité et de propriété,
   purges du retrait, cascades, réponse uniforme).
2. **B2 — la rangée sur la carte** : `BravoRow` (bouton + compteur +
   statut/alerte), action avec rate-limit, fil branché, ancres de carte,
   états (zéro, un, plusieurs, pressé, sa propre carte, erreur).
3. **B3 — revues** (correction exigeante + sécurité : donnée perso +
   Server Action), CI, merge.

## 7. Questions à trancher (avec propositions)

- **Q1 — s'applaudir soi-même** : proposition NON (bouton absent de sa
  propre carte, borne serveur). Elle voit le compteur, elle reçoit.
- **Q2 — la liste complète de qui a applaudi** : proposition PAS en v1 — le
  libellé nominatif suffit (« Léa M. et 4 autres ») ; une feuille listant
  les prénoms viendra si le besoin se montre.
- **Q3 — prévenir la speakeuse applaudie** : proposition PAS de
  notification en v1 — elle le voit sur sa carte dans le fil ; la
  messagerie (N5) portera les vraies notifications.
- **Q4 — quelles cartes, quels mots** : les cartes INCARNÉES seulement
  (scène → « Bravo », venue → « Bienvenue », article de membre → « Merci »)
  — **corrigé le 2026-08-08** sur le fil réel : l'actualité de l'association
  en est écartée, elle n'a personne à féliciter.
- **Q5 — retrait de fiche = bravos perdus** (conséquence du « retrait
  rétroactif » de la doc mère §9, assumée ici) : retirer sa fiche supprime
  les bravos reçus ; une re-publication repart de zéro. OK ?
