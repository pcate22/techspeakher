# Récompenses du Tremplin & source de la fiche publique — conception

> 2026-07-03. Deux constats orga sur la fiche participante : (1) « Sa fiche
> publique » duplique des données qui appartiennent à la speakeuse ; (2) il
> manque une vraie table des récompenses, attribuables et suivies dans le
> temps — sachant qu'une gagnante déjà retenue via le CFP voit son lot
> transmis à la suivante.

## 1. Fiche publique : la speakeuse est la source

**Constat exact.** Aujourd'hui bio / site / photo de la galerie vivent sur
l'INSCRIPTION (saisie orga) parce que les 8 finalistes historiques n'avaient
pas de compte. Dès qu'une participante est rattachée à un compte avec profil
speakeuse, c'est une duplication qui divergera.

**Cible** :

- inscription rattachée **avec profil speakeuse** → la galerie lit bio,
  site et photo du PROFIL (la speakeuse en garde la main dans son espace) ;
  la carte admin devient lecture seule avec un lien « voir sa fiche
  speakeuse », et seule la récompense/le podium reste côté édition ;
- inscription **sans compte** (ou sans profil) → la saisie orga actuelle
  reste le secours ;
- transition douce : au rattachement, si les champs édition sont vides on
  n'affiche que le profil ; s'ils divergent, le profil PRIME (bandeau admin
  « remplacé par sa fiche speakeuse »).

## 2. Modèle des récompenses (validé le 2026-07-03)

Décisions orga :

- l'attribution est **libre** : n'importe quelle participante de l'édition,
  pas seulement la suivante du podium ; le **motif** trace le pourquoi
  (« 1ʳᵉ déjà retenue via le CFP → transmis ») ;
- les récompenses ne se limitent **pas au podium** : coaching pour toutes
  celles prises au CFP DevFest, présentation en meetup proposée à toutes
  celles qui le veulent (pas seulement les gagnantes) → le rang de podium
  est OPTIONNEL, et plusieurs récompenses peuvent coexister par édition ;
- il faut **suivre l'organisation des événements** qui en découlent
  (le meetup a-t-il été calé ? quand ?) → statut de suivi + date.

Séparer donc deux notions aujourd'hui confondues dans `recompense TEXT` :

- **le podium** (mérite, immuable) : 1ʳᵉ / 2ᵉ / 3ᵉ de la soirée — reste sur
  l'inscription (colonne actuelle) et s'affiche tel quel au palmarès public ;
- **la récompense** (attribuable, réattribuable, suivie) : nouvelle table.

```sql
CREATE TABLE tremplin_recompenses (
  id            SERIAL PRIMARY KEY,
  edition_id    INTEGER NOT NULL REFERENCES tremplin_editions(id) ON DELETE CASCADE,
  intitule      TEXT NOT NULL,             -- « Une présentation au DevFest Toulouse »
  detail        TEXT,                      -- « Salle communauté »
  rang          INTEGER,                   -- lot du podium (1, 2, 3…) ou NULL (meetup, coaching CFP…)
  beneficiaire_registration_id INTEGER REFERENCES tremplin_registrations(id) ON DELETE SET NULL,
  motif         TEXT,                      -- « 1ʳᵉ déjà retenue via le CFP → transmis »
  statut        TEXT NOT NULL DEFAULT 'a_organiser'
                CHECK (statut IN ('a_organiser', 'planifiee', 'realisee')),
  evenement_le  DATE,                      -- date de l'événement, une fois calé
  attribuee_le  TIMESTAMPTZ                -- date d'attribution à la bénéficiaire
);
```

- Pas d'`UNIQUE (edition_id, rang)` : un même rang peut ouvrir plusieurs
  récompenses, et la plupart n'ont pas de rang du tout.
- **Cas DevFest 2026** : Ada (1ʳᵉ au podium, retenue aussi via le CFP) ;
  la récompense « présentation au DevFest » a pour bénéficiaire Grace (2ᵉ),
  motif tracé. S'y ajoutent des lignes « coaching CFP » et « talk en meetup »
  au fil de l'eau, sans rang.
- **Suivi dans le temps** : qui a bénéficié de quoi, quand, pourquoi, et où
  en est l'organisation — par édition, requêtable sur plusieurs années
  (statistiques, redevabilité partenaires).
- **Reprise 2026** : pas de migration de données ; l'orga saisit les
  récompenses réelles via l'UI (2 minutes).

## 3. UI

- Tableau de bord édition : nouvelle section « Récompenses » (une ligne par
  récompense : intitulé, bénéficiaire, statut de suivi) + modale « Ajouter
  une récompense » ; le reste se gère sur une **fiche récompense** profonde
  (pattern des fiches participante/atelier) : attribution via un sélecteur
  des participantes + motif, suivi (statut, date de l'événement), suppression.
- Fiche participante : « Bénéficie de : … » le cas échéant.
- Page publique : INCHANGÉE pour l'instant (palmarès au mérite + prix
  statiques). Reste ouvert : afficher « présentera au DevFest » sur la
  bénéficiaire, et brancher la section prix sur la BDD — à trancher avec
  le chantier « blocs éditoriaux 2026 » (P1).

## 4. Révision 2026-07-05 : classement, récompense théorique, récompenses réelles

> Retour orga : « il faut distinguer qui est 1ère / 2ᵉ / 3ᵉ **versus** les
> récompenses, sinon on perd le podium. Les récompenses doivent avoir qui les
> gagne, et si on les transmet à une autre, le savoir aussi — les 2
> informations. Pour chaque speakeuse : le classement, la récompense théorique
> assignée au classement, et les récompenses réellement attribuées (on peut en
> assigner plusieurs à chaque fois). » **À garder de côté avant décision, pas
> encore implémenté.**

### Le point de vigilance

La section 2 a bien séparé « podium » et « récompense », mais l'implémentation
a tendance à les reconfondre (le palmarès porte « 1ᵉʳ prix » comme s'il ne
faisait qu'un avec le lot). On formalise donc **trois notions distinctes**,
lisibles séparément **pour chaque speakeuse** :

1. **Le classement (podium).** Son rang à la soirée : 1ᵉʳ / 2ᵉ / 3ᵉ (ou aucun).
   C'est un **mérite immuable**, jamais transféré. C'est LUI le podium public.
   → reste porté par l'inscription.

2. **La récompense théorique du classement (le barème).** Le lot *nominalement*
   attaché à un rang pour cette édition : 1ᵉʳ → « une présentation au DevFest »,
   2ᵉ → « un talk en meetup », etc. C'est une **règle de l'édition**, pas une
   attribution : elle dit ce que le rang « donne droit », indépendamment de qui
   en profite vraiment.

3. **Les récompenses réellement attribuées.** Ce qu'une speakeuse **reçoit
   effectivement** — potentiellement **plusieurs**, potentiellement sans lien
   avec son rang (coaching CFP, meetup ouvert à d'autres…). Chaque attribution
   porte **qui la reçoit** et, en cas de transfert, **d'où elle vient**.

### Le transfert, dans les deux sens

Cas concret DevFest 2026 : la 1ᵉʳ est déjà retenue via le CFP, donc « sa »
présentation DevFest (récompense théorique du rang 1) est **transmise** à la
2ᵉ. Il faut garder **les deux informations** :

- côté récompense : *théoriquement due au rang 1 / à la 1ᵉʳ*, **réellement
  attribuée à** la 2ᵉ, avec le motif ;
- lisible **des deux côtés** : sur la fiche de la 1ᵉʳ (« récompense du 1ᵉʳ prix
  transmise à … »), et sur celle de la bénéficiaire (« reçue, transmise depuis
  le 1ᵉʳ prix »).

### Modèle cible (esquisse, à valider)

- **Classement** — porté par l'inscription (rang de podium), inchangé.
- **Barème (récompense théorique par rang)** — une récompense de l'édition PEUT
  déclarer le rang qu'elle récompense *nominalement* (`rang` existe déjà). Le
  barème est donc l'ensemble des récompenses ayant un `rang` : « ce à quoi ce
  rang donne droit ». Rien de neuf en base ; on l'affiche comme barème.
- **Attribution réelle + transfert** — sur `tremplin_recompenses`, on distingue
  l'**origine théorique** (le rang / la lauréate à qui elle revenait) de la
  **bénéficiaire réelle** (`beneficiaire_registration_id`, déjà là). Aujourd'hui
  le lien théorique n'est tracé qu'en texte libre (`motif`). Pour rendre le
  transfert *requêtable des deux côtés*, deux options :
  - **(a) minimal** : garder `rang` comme origine théorique + `motif` en clair
    (déjà en base) ; l'UI affiche « due au rang N, attribuée à … ». Pas de
    migration.
  - **(b) explicite** : ajouter `origine_registration_id` (la lauréate à qui la
    récompense revenait avant transfert) → jointure propre pour afficher le
    transfert sur les DEUX fiches, sans parser le motif. Migration `0NN`.
  Recommandation : **(b)** si on veut l'afficher proprement des deux côtés
  (c'est l'intention de « les 2 informations ») ; **(a)** si on se contente du
  motif pour l'instant.

### Vue « pour chaque speakeuse »

Fiche participante (et éventuellement public, à trancher) :

```
Grace — 2ᵉ prix (classement)
  Récompense théorique du 2ᵉ : un talk en meetup
  Récompenses attribuées :
    • Une présentation au DevFest 2026  (transmise depuis le 1ᵉʳ prix)
    • Un talk en meetup
```

> **Personas fictifs** : « Ada » (1ʳᵉ), « Grace » (2ᵉ) illustrent les exemples.
> Jamais de vraie personne dans un doc versionné (RGPD).

> **Conception technique + revue** : ces choix ont été affinés et passés au
> crible (sécurité, RGPD, UX, a11y, KISS) dans
> `docs/conception-technique-recompenses.md`. La revue a **simplifié** deux
> points ci-dessous — voir la note sur chacun.

### Décisions à trancher → tranchées le 2026-07-05 (voir ci-dessous)

- **Origine du transfert** : ~~option (b) colonne explicite~~ → **révisé** : la
  revue KISS montre que l'origine est **dérivable** (la lauréate du rang), donc
  **pas de colonne `origine_registration_id`** ; on la retrouve par jointure
  (`classement = rang`). Cf. conception technique §3.3.
- **Barème** : ✅ « récompense théorique associée au rang » (les récompenses
  avec `rang` FONT le barème public).
- **Public** : ✅ classement + barème + attribution/transfert sont PUBLICS ;
  suivi opérationnel (statut, date, type) interne. **Révisé (RGPD)** : le motif
  **texte libre** ne devient PAS public (fuite de nom/donnée sensible) — la
  raison du transfert est **énumérée** (sans nom) ; les noms viennent des
  champs structurés gatés par consentement. Cf. conception technique §3.4 / §4.

> Lien avec la conception D (phases) : tout ceci vit en **phase 2** (la soirée
> et le jury — gagnantes, classement, récompenses). La revue de D intègrera
> cette distinction classement / récompenses.

### Décisions 2026-07-05 (tranchées par l'orga)

> « On associe la récompense théorique au rang et c'est **public**. Puis en
> termes de **suivi interne**, on a les récompenses réelles avec les décisions
> tracées et leur suivi (ateliers, coaching, meetup, conférences…). »

Le partage **public / interne** est donc arrêté. La ligne n'est PAS « réel =
interne » : le **résultat visible** (qui présente quoi, où, et pourquoi) est
**public**, transfert compris ; seule la **logistique de suivi** reste interne.

> Précision orga (2026-07-05) : « On peut montrer **le transfert** aussi. Car
> ce sera public que Grace sera dans la salle des communautés à la place de
> Ada, parce que Ada est prise directement via son CFP par la
> conférence. »

**Public — le mérite, le barème et le transfert.**
- **Le classement** (podium) : qui est 1ᵉʳ / 2ᵉ / 3ᵉ (nom si consenti).
- **La récompense théorique du rang** (barème) : le lot *nominalement* associé
  à chaque rang de l'édition (« 1ᵉʳ prix — une présentation au DevFest 2026 »).
- **L'attribution réelle et le transfert**, avec son **motif** : « présentée
  par Grace (2ᵉ) à la place de Ada (1ᵉʳ), déjà prise via son CFP ». Qui
  monte réellement sur scène et pourquoi est une information publique.

**Interne (orga) — la logistique et son suivi.**
- Le **suivi opérationnel** de chaque récompense/action : statut (à organiser /
  planifié / réalisé) + date, par **type** : atelier, coaching, meetup,
  conférence… (nouvelle dimension).
- Les actions **hors barème** non destinées à l'affichage (coaching des prises
  au CFP, créneaux meetup proposés au fil de l'eau) tant qu'elles ne sont pas
  un fait public à annoncer.
- Requêtable dans le temps (redevabilité partenaires, statistiques).

### Conséquences sur le modèle et l'UI

1. **Barème public par rang.** Une récompense qui porte un `rang` EST le barème
   théorique de ce rang (public). Le palmarès public affiche, pour chaque
   gagnante, `classement` + l'intitulé théorique de son rang. Avant la finale,
   « Ce qu'il y a à gagner » = ce même barème (rang → lot).
2. **Attribution + transfert = public ; suivi = interne.** Le public affiche,
   pour une récompense de barème, à qui elle est réellement attribuée et le
   motif du transfert (« Grace, à la place de Ada — prise via son CFP »).
   Ce qui quitte le public, c'est le **suivi opérationnel** (statut à
   organiser/planifié/réalisé, dates, type d'action) et les actions hors barème
   non annoncées. La liste publique actuelle « Attribuée à … » reste donc
   pertinente, enrichie du motif de transfert ; les colonnes de suivi ne s'y
   affichent pas.
3. **Transfert des deux côtés** : on adopte l'option **(b)** — `origine_registration_id`
   explicite sur `tremplin_recompenses` (la lauréate à qui la récompense
   revenait avant transfert), en plus de `beneficiaire_registration_id` et du
   `motif`. Permet d'afficher le transfert sur la fiche de l'origine ET de la
   bénéficiaire sans parser de texte.
4. **Type de récompense/action** : ajouter une catégorie (`type` :
   `atelier` | `coaching` | `meetup` | `conference` | `autre`) pour le suivi
   interne et les stats. `rang` reste optionnel (une action de suivi n'a pas de
   rang ; une ligne de barème en a un).

### Vue « pour chaque speakeuse » (mise à jour)

- **Public** (palmarès) : classement + barème + transfert visible.
  ```
  1ᵉʳ prix — Ada · Une présentation au DevFest 2026
             (présentée par Grace, 2ᵉ — Ada est prise via son CFP)
  2ᵉ prix — Grace · Un talk en meetup
  ```
- **Interne** (fiche orga) : en plus, le suivi opérationnel (masqué du public).
  ```
  Présentation DevFest 2026 — bénéficiaire Grace, origine 1ᵉʳ prix (Ada)
    type : conférence · statut : planifiée · le 19/11
  Talk en meetup — bénéficiaire Grace
    type : meetup · statut : réalisé · le 12/09
  Coaching CFP — bénéficiaires : (les prises au CFP) · type : coaching · en cours
  ```

### Reste ouvert (D)

Les arbitrages de la conception D (phases) restent à donner : une phase par
inscription ou plusieurs, `phase` sur atelier (colonne vs dérivée), phase 2 vue
agrégée ou espace jury, libellés. Les récompenses (ci-dessus) sont le cœur de la
phase 2 ; on peut implémenter les deux ensemble.
