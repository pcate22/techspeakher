# Revue UX + RGAA globale — 2026-07-03

> Trois passes indépendantes sur TOUTE la plateforme (espace admin, espace
> membre + pages publiques, audit technique RGAA/WCAG), à la demande de
> l'orga. 33 constats. Les « corrigés » l'ont été le jour même (branche
> lot 3) ; le reste est priorisé P1 (avant la 2ᵉ édition) / P2.
>
> Socle jugé très bon par l'audit : skip link, `lang="fr"`, landmarks et
> nav nommées, `sr-only` « (nouvelle fenêtre) » systématique, focus-visible
> partout, pas de tabindex positif, contrastes des tokens principaux
> conformes (gray-light sur navy 9.08:1), AdminDialog (`<dialog>` natif)
> exemplaire, ContactForm = modèle de formulaire accessible du dépôt.

## 1. Corrigés dans ce lot

Bugs réels :

- **`restoredValue(...) ?? défaut` n'appliquait JAMAIS le défaut** (hors
  erreur, la fonction renvoie `""`) : la modale « Modifier l'édition »
  s'ouvrait vide — un « Enregistrer » effaçait dates/description et
  repassait l'édition « En préparation » (invisible du public) ; la fiche
  récompense et la carte galerie affichaient des champs vides et
  réécrivaient du vide en base ; « Moment » d'une photo démarrait sur
  Podium. Corrigé partout (restauration sur erreur uniquement) + test.
- **`AlertDialog.Action` autour du submit** (DeleteTalkButton,
  RefuseSuggestionButton) : fermer démonte le formulaire et React annule
  la soumission — suppression/refus « confirmés » sans effet. Aligné sur
  le pattern documenté d'InviteButton.
- **Dates hors calendrier** (« 2026-02-31 ») acceptées par la regex du
  suivi de récompense → crash Postgres ; vraie validation calendaire.
- **Focus Radix** : `Button` ne transmettait pas `ref` → autofocus sur
  « Annuler » et restitution du focus cassés sur toutes les confirmations.

Consentement / RGPD :

- Le consentement « Me rendre visible » **sous-déclarait** ce que la
  galerie publie (rôle, bio, site, LinkedIn en plus de nom/sujet/photo) :
  textes exacts partout (espace membre + carte admin).
- **Succès honnête pour une non-finaliste** : « ton accord est enregistré,
  tu apparaîtras dès que ta place de finaliste sera confirmée » (la
  galerie ne liste que les finalistes).

Prévisibilité / wording :

- Compteur participantes : les entrées en phase 2 sont comptées, plus de
  cadratin ; carte « Présences » toujours visible avec un état vide qui
  explique le préalable (cocher les membres) ; « Qui participe » annonce
  le lien avec le pointage.
- Modale « Ajouter un atelier » : plus de champ coachs en texte libre (ça
  fabriquait du legacy à re-saisir) — les coachs s'ajoutent sur la fiche.
- Invitation en échec : le message le DIT (« l'e-mail n'est pas parti :
  préviens-la directement ») au lieu d'une négation par omission.
- Fil d'Ariane « Admin » → « Espace orga » ; « vois les logs » /
  « BREVO_API_KEY » → « préviens l'équipe technique » ; micro-langage
  d'enchaînement unifié (« À la suivante ! ») ; accord des statuts de
  récompense (Planifiée / Réalisée) ; « Supprimer mon profil » →
  « Supprimer mon compte » (c'est le compte qui est supprimé) ;
  vouvoiement du parcours organisateur (contact speakeuse) ; état vide
  utile (« Le programme n'est pas encore publié… ») ; carte galerie
  renommée et remontée à côté de la visibilité.
- « Mes talks » : ancre réelle `/mon-espace#talks` (l'ancien `?tab=talks`
  n'était lu nulle part — atterrissage en haut de page sans feedback).

RGAA :

- Badges ✓●★🏆 de la liste des participantes : équivalent textuel sr-only
  (ils portaient seuls des statuts invisibles au lecteur d'écran).
- Enregistrement à la volée : annonce sr-only « Chaque modification
  s'enregistre automatiquement », pas de vol de focus sur erreur.
- `text-gray-light/60` (3.8:1, sous le seuil) → `/70` (4.7:1).
- Champs requis d'InlineActionForm : « (obligatoire) » sr-only.

## 2. P1 — faits (2026-07-03, même branche)

1. ✅ **Champ « Prénom et nom »** à l'étape 1 du profil : remplit
   `users.name` (self-service, vide = inchangé) — la cohorte lien-magique
   a enfin un nom sur sa fiche et dans l'annuaire.
2. ✅ **Erreurs du wizard visibles** : récapitulatif `role=alert` + retour
   automatique à la première étape fautive ; « Étape x sur 5 : Nom »
   annoncé (`role=status`) ; « (terminée) » sr-only dans StepIndicator ;
   note « rien n'est enregistré avant le bouton final » + garde
   `beforeunload` quand une saisie est en cours (la navigation interne
   reste non bloquée : limite App Router, voir P2).
3. ✅ **SearchBar (⌘K)** refondue sur `<dialog>` natif (page inerte, Échap,
   focus restitué) ; options cliquables sans boutons imbriqués, listbox
   permanente (aria-controls valide), nombre de résultats annoncé.
4. ✅ **Vocabulaire podium/récompense** : le champ historique s'appelle
   « Podium (affiché au palmarès) », badge 🏆 = « au podium » — l'entité
   « récompense » garde son mot. (Le branchement de la page publique sur
   la BDD reste lié à la décision produit, cf. docs/recompenses-tremplin.md.)
5. ✅ **Plus de « ressaut »** des contrôles à la volée : champs re-clés sur
   le dernier choix (le reset post-action de React retombe dessus).
6. ✅ **Pourcentage de la checklist** (retour orga) : il ne mesure plus que
   le CONTENU du formulaire — fiche complète non soumise = 100 % + phrase
   « Dernière étape : le soumettre à l'annuaire » (avant : 80 %, illisible).

## 3. P2 — faits (2026-07-03, même branche)

- ✅ `aria-invalid` + `aria-describedby` reliant chaque erreur à son champ
  (TalkForm, ProfileForm, formulaire de contact speakeuse) ; astérisque du
  titre de talk doublé d'un « (obligatoire) » sr-only.
- ✅ Focus non perdu : fermeture du bandeau Nouveautés → contenu principal ;
  « Envoyer un autre message » → premier champ du formulaire.
- ✅ États vides : « Pas encore de talk sur sa fiche. » (fiche publique),
  « Rien pour le moment : dépose le premier support… » (espace coach).
- ✅ Feedback visible après un geste sur un talk : bannière « Talk ajouté /
  mis à jour / supprimé ✓ » dans la section Mes talks (`?ok=…#talks`).
- ✅ Garde de navigation INTERNE du wizard : clic sur un lien pendant une
  saisie → modale « Quitter sans enregistrer ? » (Rester / Quitter) ;
  `beforeunload` couvre fermeture et rechargement.

Reste (mineur) : `aria-describedby` générique d'InlineActionForm (erreur
globale de formulaire, pas par champ — acceptable, formulaires courts).
