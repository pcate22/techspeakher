# Parcours d'une participante au Tremplin — conception

> 2026-07-03, validé par l'orga (choix notés en fin de section). Besoin :
> distinguer, sur une édition, (1) celles qui se sont inscrites au départ
> (elles étaient 12 ou 13), (2) parmi elles celles qui sont réellement venues
> aux ateliers, (3) celles ajoutées après la finale, jusqu'à la conférence.

## 1. Les trois phases d'une édition

```
Phase 1                        Phase 2              Phase 3
Accompagnement CFP et pitch    Finale du tremplin   Accompagnement montée sur scène
inscriptions + ateliers        soirée, finalistes,  coaching des prises au CFP,
de préparation                 podium               préparation DevFest / meetups
```

Chaque inscription porte sa **phase d'entrée** (à quel moment elle a rejoint
le parcours) ; finalistes et podium restent ce qu'ils sont
(`finale_presente`, `recompense`). La **présence** se pointe atelier par
atelier, avec un état neutre tant que l'information n'est pas disponible.

## 2. Modèle (migration 019)

```sql
ALTER TABLE tremplin_registrations ADD COLUMN phase_entree TEXT NOT NULL
  DEFAULT 'cfp_et_pitch'
  CHECK (phase_entree IN ('cfp_et_pitch', 'finale', 'montee_sur_scene'));

ALTER TABLE tremplin_atelier_membres ADD COLUMN presence TEXT NOT NULL
  DEFAULT 'non_renseignee'
  CHECK (presence IN ('non_renseignee', 'presente', 'absente'));
```

- `phase_entree` : pré-remplie à l'ajout selon l'état de l'édition (édition
  en cours après la finale → `montee_sur_scene`), modifiable sur la fiche.
- `presence` : TRI-ÉTAT — « non renseignée » par défaut (on ne devine pas),
  « présente » / « absente » quand l'orga pointe. Se pointe sur la fiche de
  l'atelier, pour ses membres (un atelier « ouvert à toutes » se compose
  d'abord).
- « Venue aux ateliers » (compteur) = présente à AU MOINS un atelier — dérivé,
  pas de colonne.
- Reprise 2026 : l'orga ressaisit les inscrites non finalistes via le
  sélecteur / l'e-mail (historique complet) ; les 8 importées restent en
  phase 1.

## 3. UI

- **Fiche participante** : carte « Parcours » — sélecteur de la phase
  d'entrée (libellés complets : « Phase 1 · Accompagnement CFP et pitch »,
  « Phase 2 · Finale du tremplin », « Phase 3 · Accompagnement montée sur
  scène »).
- **Fiche atelier** : carte « Présences » — une ligne par membre avec
  Présente / Absente / Non renseignée, un seul bouton « Enregistrer les
  présences » pour la carte.
- **Tableau de bord** : compteur enrichi (« 13 en phase 1 · 9 venues aux
  ateliers · 8 finalistes · 3 en phase 3 »).
- **Rien côté public** : distinctions internes (stats, suivi) ; la galerie
  reste pilotée par le seul consentement.

## 4. Doctrine UX : des modales PRÉVISIBLES

Question orga : « comment l'utilisatrice sait ce qu'il va se passer ? »
Constat : certaines modales restaient ouvertes après un succès (saisie à la
chaîne), d'autres se fermaient — sans que rien ne l'annonce. Règles :

1. **Une modale se ferme TOUJOURS au succès** (comportement standard,
   attendu) ; le résultat est visible immédiatement sur la page derrière
   (liste rafraîchie).
2. La saisie en série est un **second bouton explicite** « … et enchaîner »
   (ex. « Inviter et enchaîner ») : le libellé annonce le comportement — la
   modale reste alors ouverte, message de confirmation + focus sur le
   premier champ.
3. Les libellés des boutons annoncent l'effet (« Inviter », « Retirer
   définitivement »…) ; les confirmations destructives annoncent la
   conséquence avant d'agir (modale titre = question, description =
   conséquence).
4. L'état neutre existe quand l'information n'existe pas (« non
   renseignée ») : l'interface ne devine jamais à la place de l'orga.
5. Les **commandes discrètes** (cases à cocher, sélecteurs) s'enregistrent
   **à la volée** au changement — pas de bouton « Enregistrer » qui ne
   change rien d'autre que lui-même (retour orga : imprévisible). La
   confirmation est vocale/visuelle (« Sélection enregistrée. ») et la page
   se rafraîchit derrière. Les **saisies libres** (texte, liens, dates)
   gardent un bouton : on ne soumet pas au milieu d'une frappe.
