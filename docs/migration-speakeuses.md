# Migration de l'annuaire speakeuses (statique → base)

> **Statut : exécutée.** La cohorte migrée vit en base (`speaker_profiles.migrated
> = true`, invitations idempotentes via `invited_at`) ; les fiches suivent le flow
> normal. Le suffixe `.invalid` marque les comptes migrés **sans adresse connue**
> (jamais invitables — leur sort est un sujet à part, cf. `docs/dette-technique.md`).
> Ce document reste la trace de la procédure. ⚠️ L'ancien annuaire statique
> (`speakeuses.ts`) n'a **jamais été versionné** : fiches d'origine et e-mails
> sont des données personnelles, livrées **hors git** — aucune référence de code
> à chercher dans le dépôt. Recalé le 2026-08-21 (dette P0-1).

But : reprendre les fiches speakeuses existantes (issues de l'ancien annuaire
statique, hors git) en base comme **profils en brouillon** (invisibles),
marqués `migrated = true`, pour que chacune puisse ensuite **se connecter et
reprendre la main** sur ses données, puis **soumettre** sa fiche à validation.

> Les fiches migrées **ne sont pas publiées d'office** : elles suivent le flow
> normal (brouillon → la speakeuse relit et soumet → l'orga valide → visible).
> Le flag `migrated` sert uniquement à cibler les invitations, indépendamment du
> statut.

> ⚠️ **Aucune donnée personnelle dans le repo.** Les e-mails et infos perso
> vivent uniquement en base (Neon, UE) et dans un fichier local **hors git**.
> Ce document ne contient que des modèles et placeholders.

## Comment une speakeuse « reprend la main » sur sa fiche

On pré-crée pour chaque speakeuse :

1. une ligne `users` (son **e-mail de contact** + nom),
2. un `speaker_profiles` lié, en statut `brouillon` (invisible) avec `migrated = true`,
3. ses `talks`.

À sa **première connexion avec le même e-mail**, Auth.js relie automatiquement
son compte OAuth au compte pré-créé (`allowDangerousEmailAccountLinking`) : elle
récupère sa fiche et peut la compléter / corriger.

**La condition = l'e-mail de connexion doit être identique à l'e-mail pré-créé.**

## Le point bloquant : beaucoup d'e-mails ne sont pas Gmail

(outlook.fr, fastmail.com, yahoo.fr, domaines pro…)

| Méthode de connexion | Marche pour… | Limite |
| --- | --- | --- |
| **Google** | comptes Google (gmail, ou Workspace sur domaine pro) | inutilisable pour outlook/yahoo/fastmail sans compte Google |
| **LinkedIn** | si l'e-mail LinkedIn == e-mail de contact | souvent vrai en pro, mais pas garanti |
| **Lien magique (e-mail)** | **n'importe quel e-mail** | demande un envoi d'e-mails (Brevo, gratuit 300/j) |

➡️ **Recommandation : activer le lien magique (e-mail)** pour la migration. C'est
le seul moyen fiable de garantir que chaque speakeuse, quel que soit son
fournisseur, puisse réclamer sa fiche. On garde Google + LinkedIn en plus.
Coût : 0 € (Brevo free). Pas besoin de compte bancaire.

## Périmètre

On migre **uniquement les speakeuses déjà présentes dans l'annuaire**
(l'annuaire statique d'origine, hors git). Les autres lignes du tableau d'e-mails (inscriptions
Tremplin, participantes non listées, etc.) **ne sont pas ajoutées**. Le rattachement
se fait par **correspondance de nom** entre l'annuaire et les e-mails fournis ;
une ligne sans speakeuse correspondante dans l'annuaire est ignorée.

## Étapes (exécutées — gardées comme trace de la procédure)

1. Mapper l'annuaire statique (hors git) → champs profil (nom, titre/poste, bio,
   linkedin, website, instagram, talks). Les `tags` libres ne correspondent pas
   au vocabulaire contrôlé (secteurs/sujets) : on laisse ces deux champs **vides**,
   à compléter par la speakeuse. Ne migrer que les fiches de l'annuaire (cf. Périmètre).
2. Constituer un fichier local **hors git** associant chaque fiche à son e-mail.
3. Générer le SQL de seed (users + speaker_profiles en `brouillon`, `migrated = true`,
   + talks) et l'exécuter dans Neon.
4. (Optionnel) Retirer la liste statique une fois l'annuaire branché sur la base.
5. Envoyer les invitations depuis `/admin` (bouton « Inviter N speakeuses »).
   Cible : `migrated = true`, jamais invitée (`invited_at` vide), e-mail valide.
   **Idempotent** (chaque envoi réussi pose `invited_at`) et **best-effort** par
   destinataire. Procédure d'envoi et pièges : `docs/exploitation.md`.

## Lien magique (Brevo) — déjà prêt

La config Brevo existe déjà (formulaire de contact) : même `BREVO_API_KEY`, même
expéditeur validé `contact@techspeakher.fr`. Le lien magique **réutilise** cette
config et s'active **dès que `BREVO_API_KEY` est présent** — donc déjà OK en prod.

- Rien à configurer en plus. (Option : `AUTH_EMAIL_FROM` pour un expéditeur dédié,
  à valider dans Brevo.)
- Aucune table à créer : les jetons utilisent `verification_token` (déjà au schéma).
- ⚠️ Le **preview Vercel est protégé par authentification** : le lien magique
  n'est réellement utilisable par les speakeuses **qu'une fois la branche mergée
  sur `main` (prod)**.

## Mail d'invitation

Le contenu **vit dans le code** (source unique) : `src/lib/invitation-email.ts`
(`buildInvitationEmail`). Il dit : fiche **pré-remplie** depuis les infos
publiques, **pas encore visible**, à relire/compléter puis publier ; possibilité
de demander le retrait ; garanties RGPD (hébergement UE, e-mail/téléphone jamais
affichés). Un **encart orga** (modération des fiches) est ajouté automatiquement
pour les comptes `is_orga`. Pour relire ou modifier le texte, éditer ce fichier
(et son test `src/__tests__/invitation-email.test.ts`).
