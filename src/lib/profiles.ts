import { cache } from "react";
import { REGLAGES_DEFAUT } from "@/lib/reglages";
import { pool, withTransaction, withTransactionSaufTable, type Queryable } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { CFP_SYNC_MODES } from "@/lib/cfp-consentement";
import {
  cadenceValide,
  seuilsCadence,
  sqlRappelPermis,
  type CadenceRappel,
} from "@/lib/cadence-rappels";
import { nomAffiche, STATUTS_RETIRABLES } from "@/lib/profile-status";
import { adhesionAJourSql } from "@/lib/adhesion";
import { sqlDansListe } from "@/lib/sql-liste";

export type ProfileStatus =
  | "brouillon"
  | "en_attente"
  | "publie"
  | "refuse"
  | "masque"
  /** Hors annuaire faute d'adhésion à jour (migration 074) : revient seule à
   *  l'adhésion. Cf. docs/conception-adhesions-helloasso.md. */
  | "en_pause";

export interface SpeakerProfile {
  id: number;
  userId: number;
  /** Identifiant d'URL lisible « nom-prenom » (façon LinkedIn), UNIQUE. `null`
   *  tant qu'aucun nom n'existe (cohorte lien-magique) : la fiche reste alors
   *  joignable par son id numérique, qui redirige vers le slug dès qu'il existe. */
  slug: string | null;
  /** Nom du compte (Google/LinkedIn) — lu sur users, non éditable ici. */
  name: string | null;
  /** LE nom affiché partout (name réel, sinon titre du profil, sinon libellé
   *  générique) — calculé au bord, jamais recomposé par un écran : `??` sur
   *  `name` laissait passer `""` et `"   "` (dette P1). */
  nomAffiche: string;
  /** Photo du compte (Google/LinkedIn) — lue sur users. */
  image: string | null;
  titreProfil: string | null;
  poste: string | null;
  entreprise: string | null;
  bio: string | null;
  website: string | null;
  linkedin: string | null;
  instagram: string | null;
  /** Profil public Sessionize (lien sortant ; pas d'import auto). */
  sessionizeUrl: string | null;
  /** Profil public Conference Hall (lien sortant ; pas d'import auto). */
  conferenceHallUrl: string | null;
  /** Ville de résidence (niveau ville, pas d'adresse). */
  ville: string | null;
  /** Code postal de résidence (Base Adresse Nationale). */
  codePostal: string | null;
  /** Code INSEE de la commune de résidence (identifiant stable). */
  codeInsee: string | null;
  /** Région de résidence dérivée de la commune (≠ `regions`, zones d'intervention). */
  regionResidence: string | null;
  /** Zones où elle se déplace (voir REGIONS). */
  regions: string[];
  /** Langues d'intervention (voir LANGUES). */
  langues: string[];
  secteurs: string[];
  sujets: string[];
  /** Accepte d'être contactée par e-mail (relais via formulaire, e-mail masqué). */
  contactEmailOk: boolean;
  /** Attestation d'appartenance à la communauté (femme ou personne non binaire).
   *  Nom de champ historique conservé (contrat BDD) ; le libellé affiché porte le sens. */
  isWoman: boolean;
  status: ProfileStatus;
  publishedAt: string | null;
  updatedAt: string | null;
  /** Date de soumission à la validation (pour la file de modération). */
  submittedAt: string | null;
  validatedBy: number | null;
  validatedAt: string | null;
  /** Motif renseigné par l'orga en cas de refus (expliqué à la speakeuse). */
  refusMotif: string | null;
  /** Consentement au moissonneur CFP (révocable dans le profil). */
  cfpSyncMode: CfpSyncMode;
}

/** 'aucun' : jamais moissonnée ; 'suggestions' : propositions à confirmer ;
 *  'auto' : réservé (pas encore exposé dans l'UI). */
export type CfpSyncMode = "aucun" | "suggestions" | "auto";

function estCfpSyncMode(v: unknown): v is CfpSyncMode {
  return (CFP_SYNC_MODES as readonly unknown[]).includes(v);
}

/**
 * Vue PUBLIQUE d'une speakeuse (annuaire) : uniquement les champs affichés.
 * Sert à ne pas sérialiser de métadonnées internes (userId, statut, validation…)
 * vers le client public.
 */
export type PublicSpeaker = {
  id: number;
  /** Slug d'URL (partage) : la carte de l'annuaire pointe vers `/speakeuses/{slug}`.
   *  Public par nature (il EST l'URL de la fiche), donc autorisé dans le DTO. */
  slug: string | null;
  name: string | null;
  /** LE nom affiché de la carte (jamais vide) — calculé au bord ; `name` reste
   *  là pour la recherche plein-texte, qui veut le vrai nom ou rien. */
  nomAffiche: string;
  image: string | null;
  titreProfil: string | null;
  poste: string | null;
  entreprise: string | null;
  /** Zones et langues : servent les filtres de l'annuaire. La VILLE n'y est
   *  volontairement PAS (minimisation : elle ne s'affiche que sur la fiche,
   *  pas besoin de l'exposer en masse dans le payload de la liste). */
  regions: string[];
  langues: string[];
  secteurs: string[];
  sujets: string[];
};

/**
 * Projette un profil complet vers sa vue publique. Liste de champs EXPLICITE
 * (pas de spread) : c'est la frontière qui garantit qu'aucune métadonnée interne
 * (userId, statut, validation, e-mail…) ne part vers le client de l'annuaire.
 */
export function toPublicSpeaker(p: SpeakerProfile): PublicSpeaker {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    nomAffiche: p.nomAffiche,
    image: p.image,
    titreProfil: p.titreProfil,
    poste: p.poste,
    entreprise: p.entreprise,
    regions: p.regions,
    langues: p.langues,
    secteurs: p.secteurs,
    sujets: p.sujets,
  };
}

/** Champs éditables par la membre (pas de statut ni d'id : gérés à part). */
export interface ProfileInput {
  /** Slug d'URL personnalisé. `null` = auto-dérivé du nom côté action (l'unicité
   *  n'est pas gérée ici : le format est validé par `normalizeProfileSlug`, et
   *  l'action résout le slug définitif avant l'écriture). */
  slug: string | null;
  titreProfil: string | null;
  poste: string | null;
  entreprise: string | null;
  bio: string | null;
  website: string | null;
  linkedin: string | null;
  instagram: string | null;
  sessionizeUrl: string | null;
  conferenceHallUrl: string | null;
  ville: string | null;
  codePostal: string | null;
  codeInsee: string | null;
  regionResidence: string | null;
  regions: string[];
  langues: string[];
  secteurs: string[];
  sujets: string[];
  contactEmailOk: boolean;
  isWoman: boolean;
  cfpSyncMode: CfpSyncMode;
}

/**
 * La fiche EXISTANTE ramenée à ce qui s'écrit. Socle de l'enregistrement par
 * section (lot I) : on repart des colonnes déjà en base, et la section ne
 * repose que les siennes par-dessus — les autres ne bougent pas d'un octet.
 */
export function profilVersInput(p: SpeakerProfile): ProfileInput {
  return {
    slug: p.slug,
    titreProfil: p.titreProfil,
    poste: p.poste,
    entreprise: p.entreprise,
    bio: p.bio,
    website: p.website,
    linkedin: p.linkedin,
    instagram: p.instagram,
    sessionizeUrl: p.sessionizeUrl,
    conferenceHallUrl: p.conferenceHallUrl,
    ville: p.ville,
    codePostal: p.codePostal,
    codeInsee: p.codeInsee,
    regionResidence: p.regionResidence,
    regions: p.regions,
    langues: p.langues,
    secteurs: p.secteurs,
    sujets: p.sujets,
    contactEmailOk: p.contactEmailOk,
    isWoman: p.isWoman,
    cfpSyncMode: p.cfpSyncMode,
  };
}

export interface ProfileRow {
  id: number;
  userId: number;
  slug: string | null;
  name: string | null;
  image: string | null;
  titre_profil: string | null;
  poste: string | null;
  entreprise: string | null;
  bio: string | null;
  website: string | null;
  linkedin: string | null;
  instagram: string | null;
  sessionize_url: string | null;
  conference_hall_url: string | null;
  ville: string | null;
  code_postal: string | null;
  code_insee: string | null;
  region_residence: string | null;
  regions: string[] | null;
  langues: string[] | null;
  secteurs: string[] | null;
  sujets: string[] | null;
  contact_email_ok: boolean | null;
  is_woman: boolean | null;
  status: ProfileStatus;
  published_at: string | null;
  updated_at: string | null;
  submitted_at: string | null;
  validated_by: number | null;
  validated_at: string | null;
  refus_motif: string | null;
  cfp_sync_mode: string | null;
}

export function mapRow(r: ProfileRow): SpeakerProfile {
  return {
    id: r.id,
    userId: r.userId,
    slug: r.slug ?? null,
    name: r.name ?? null,
    nomAffiche: nomAffiche(r.name ?? null, r.titre_profil),
    image: r.image ?? null,
    titreProfil: r.titre_profil,
    poste: r.poste,
    entreprise: r.entreprise,
    bio: r.bio,
    website: r.website,
    linkedin: r.linkedin,
    instagram: r.instagram,
    sessionizeUrl: r.sessionize_url,
    conferenceHallUrl: r.conference_hall_url,
    ville: r.ville,
    codePostal: r.code_postal ?? null,
    codeInsee: r.code_insee ?? null,
    regionResidence: r.region_residence ?? null,
    regions: r.regions ?? [],
    langues: r.langues ?? [],
    secteurs: r.secteurs ?? [],
    sujets: r.sujets ?? [],
    contactEmailOk: r.contact_email_ok === true,
    isWoman: r.is_woman === true,
    status: r.status,
    publishedAt: r.published_at,
    updatedAt: r.updated_at ?? null,
    submittedAt: r.submitted_at ?? null,
    validatedBy: r.validated_by ?? null,
    validatedAt: r.validated_at ?? null,
    refusMotif: r.refus_motif ?? null,
    // Un consentement qu'on ne sait pas lire vaut REFUS : le repli d'avant
    // était `suggestions`, donc une valeur inattendue faisait moissonner la
    // fiche. La base ferme la liste depuis la migration 073, ceci est la
    // ceinture qui va avec.
    cfpSyncMode: estCfpSyncMode(r.cfp_sync_mode) ? r.cfp_sync_mode : "aucun",
  };
}

/**
 * Colonnes du profil + nom/photo du compte, partagées par toutes les lectures
 * de profil complet (mapRow attend ces colonnes). Évite de répéter la liste.
 */
export const PROFILE_COLUMNS = `sp.id, sp."userId", sp.slug, sp.titre_profil, sp.poste, sp.entreprise, sp.bio,
            sp.website, sp.linkedin, sp.instagram, sp.sessionize_url, sp.conference_hall_url,
            sp.ville, sp.code_postal, sp.code_insee, sp.region_residence,
            sp.regions, sp.langues, sp.secteurs, sp.sujets, sp.status,
            sp.published_at, sp.updated_at, sp.submitted_at, sp.validated_by,
            sp.validated_at, sp.refus_motif, sp.contact_email_ok, sp.is_woman,
            sp.cfp_sync_mode, u.name, u.image`;

/**
 * La fiche PUBLIÉE d'un compte, réduite au lien public (byline d'un article,
 * lot N3) : `null` si le compte n'a pas de fiche ou si elle est hors de
 * l'annuaire — le lien se replie, jamais le nom (zéro anonymisation).
 * Mémoïsée par requête, comme ses voisines.
 */
export const getProfilPublicByUserId = cache(async function getProfilPublicByUserId(
  userId: number,
): Promise<{ href: string } | null> {
  const { rows } = await pool.query(
    `SELECT id, slug FROM speaker_profiles WHERE "userId" = $1 AND status = 'publie'`,
    [userId],
  );
  if (rows.length === 0) return null;
  const r = rows[0] as { id: number; slug: string | null };
  return { href: speakeuseHref({ id: r.id, slug: r.slug }) };
});

/** Récupère le profil d'une membre, ou null s'il n'existe pas encore.
 * Mémoïsée PAR REQUÊTE (`React.cache`, comme `getProfileById`) : depuis le
 * lot N1, la barre d'onglets (layout) et la page lisent le même profil — un
 * seul SELECT pour les deux. Hors rendu React (tests, actions), passe-plat. */
export const getProfileByUserId = cache(async function getProfileByUserId(
  userId: number,
): Promise<SpeakerProfile | null> {
  const { rows } = await pool.query(
    `SELECT ${PROFILE_COLUMNS}
       FROM speaker_profiles sp
       JOIN users u ON u.id = sp."userId"
      WHERE "userId" = $1`,
    [userId],
  );
  return rows.length > 0 ? mapRow(rows[0] as ProfileRow) : null;
});

/**
 * Récupère un profil par son id (toutes statuts confondus), avec nom + photo.
 * Sert à la fiche speakeuse (consultée par l'orga pour valider, ou par la
 * propriétaire en aperçu). Mémoïsée par rendu (`React.cache`) : la fiche
 * `generateMetadata` et le corps de page partagent le même SELECT. Hors rendu
 * React (tests, crons), simple passe-plat.
 */
export const getProfileById = cache(async function getProfileById(
  profileId: number,
): Promise<SpeakerProfile | null> {
  const { rows } = await pool.query(
    `SELECT ${PROFILE_COLUMNS}
       FROM speaker_profiles sp
       JOIN users u ON u.id = sp."userId"
      WHERE sp.id = $1`,
    [profileId],
  );
  return rows.length > 0 ? mapRow(rows[0] as ProfileRow) : null;
});

/**
 * Récupère un profil par son slug d'URL, ou null. Mémoïsée par rendu (comme
 * `getProfileById`) pour que `generateMetadata` et le corps de la fiche
 * partagent le même SELECT.
 */
export const getProfileBySlug = cache(async function getProfileBySlug(
  slug: string,
): Promise<SpeakerProfile | null> {
  const { rows } = await pool.query(
    `SELECT ${PROFILE_COLUMNS}
       FROM speaker_profiles sp
       JOIN users u ON u.id = sp."userId"
      WHERE sp.slug = $1`,
    [slug],
  );
  return rows.length > 0 ? mapRow(rows[0] as ProfileRow) : null;
});

/**
 * Résout un « handle » d'URL — id numérique OU slug — vers un profil. Un slug
 * n'est jamais tout-chiffres (réservé aux id, cf. `normalizeProfileSlug`), donc
 * un handle numérique = un id ; tout le reste = un slug. Sert aux pages fiche /
 * contact, qui acceptent les deux formes (l'ancienne URL numérique redirige
 * ensuite vers le slug côté page).
 */
export async function getProfileByHandle(
  handle: string,
): Promise<SpeakerProfile | null> {
  if (/^\d+$/.test(handle)) return getProfileById(Number(handle));
  return getProfileBySlug(handle);
}

/**
 * Lien vers la fiche publique : le slug quand il existe (URL partageable,
 * canonique), sinon l'id numérique (repli, redirige vers le slug dès qu'il
 * existe). Helper partagé par toutes les surfaces qui lient une fiche.
 */
export function speakeuseHref(p: { id: number; slug: string | null }): string {
  return `/speakeuses/${p.slug ?? p.id}`;
}

/**
 * Vrai si le slug est libre (pas déjà porté par une AUTRE fiche). Sert au
 * garde-fou d'unicité côté action avant l'écriture (message clair « déjà pris »
 * plutôt qu'une 500 de contrainte). L'index UNIQUE reste le filet de sécurité.
 */
export async function isSlugAvailable(
  slug: string,
  exceptUserId: number,
): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM speaker_profiles WHERE slug = $1 AND "userId" <> $2 LIMIT 1`,
    [slug, exceptUserId],
  );
  return rows.length === 0;
}

/**
 * Dérive un slug LIBRE à partir d'un texte (le nom en général) : `base`, puis
 * `base-2`…`base-9`, puis repli `base-{userId}` (unique par construction).
 * Utilisé pour l'auto-génération quand la membre n'a pas personnalisé son URL.
 * `null` si le texte ne produit aucun slug (nom vide / symboles seuls).
 */
export async function deriveAvailableSlug(
  texte: string,
  exceptUserId: number,
): Promise<string | null> {
  const racine = slugify(texte);
  if (!racine) return null;
  // Un slug tout en chiffres serait routé vers un id par `getProfileByHandle`
  // (jamais résolu comme slug) : on garantit au moins une lettre en suffixant
  // l'id du compte (cas quasi inexistant : un nom réduit à des chiffres).
  const base = /^\d+$/.test(racine) ? `${racine}-${exceptUserId}` : racine;
  if (await isSlugAvailable(base, exceptUserId)) return base;
  for (let n = 2; n <= 9; n++) {
    const candidat = `${base}-${n}`;
    if (await isSlugAvailable(candidat, exceptUserId)) return candidat;
  }
  return `${base}-${exceptUserId}`;
}

/**
 * Coordonnées de contact d'une speakeuse (pour le relais e-mail public).
 * L'e-mail n'est jamais renvoyé au client : il sert uniquement à l'envoi côté serveur.
 */
export async function getSpeakeuseContact(profileId: number): Promise<{
  name: string | null;
  email: string | null;
  contactEmailOk: boolean;
  status: ProfileStatus;
  slug: string | null;
} | null> {
  const { rows } = await pool.query(
    `SELECT u.name, u.email, sp.contact_email_ok, sp.status, sp.slug
       FROM speaker_profiles sp
       JOIN users u ON u.id = sp."userId"
      WHERE sp.id = $1`,
    [profileId],
  );
  if (rows.length === 0) return null;
  const r = rows[0] as {
    name: string | null;
    email: string | null;
    contact_email_ok: boolean | null;
    status: ProfileStatus;
    slug: string | null;
  };
  return {
    name: r.name ?? null,
    email: r.email ?? null,
    contactEmailOk: r.contact_email_ok === true,
    status: r.status,
    slug: r.slug ?? null,
  };
}

/**
 * Fiches PUBLIÉES à qui envoyer le rappel de mise à jour (cron quotidien).
 *
 * Deux questions distinctes, deux répondants — et les deux conditions valent
 * ensemble (cf. `docs/conception-cadence-rappels.md`) :
 *   - « à partir de quand une fiche mérite un coup de pouce ? » → l'équipe,
 *     via `rappel_fiche_jours` (défaut 180), qui borne `updated_at` ;
 *   - « à quelle fréquence j'accepte d'être rappelée ? » → la speakeuse, via
 *     `rappel_cadence`, qui borne `last_reminder_at` (`sqlRappelPermis`).
 *
 * Sans choix personnel, le défaut de ce flux reste sa valeur d'aujourd'hui :
 * une base où personne n'a rien réglé se comporte exactement comme avant.
 */
export async function getProfilesDueForReminder(
  rappelJours: number = REGLAGES_DEFAUT.rappel_fiche_jours,
): Promise<{ id: number; email: string; name: string | null }[]> {
  const seuils = seuilsCadence(rappelJours);
  const { rows } = await pool.query(
    `SELECT sp.id, u.email, u.name
       FROM speaker_profiles sp
       JOIN users u ON u.id = sp."userId"
      WHERE sp.status = 'publie'
        AND u.email IS NOT NULL
        AND sp.updated_at < $1
        AND ${sqlRappelPermis(2)}`,
    [seuils.defaut, ...seuils.params],
  );
  return (rows as { id: number; email: string; name: string | null }[]).map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name ?? null,
  }));
}

/**
 * Une fiche en sommeil, prête pour la relance : le profil complet (l'e-mail
 * énumère les chantiers restants, qui se dérivent du profil ET du nombre de
 * talks) plus l'adresse d'envoi. L'adresse reste HORS de `SpeakerProfile` :
 * seul l'appelant serveur qui envoie la voit, la fiche sérialisée vers le
 * navigateur ne la porte jamais.
 */
export interface FicheEnSommeil {
  profile: SpeakerProfile;
  email: string;
  talksCount: number;
  lastReminderAt: string | null;
}

/**
 * QUI a le droit de recevoir une relance de brouillon (cf.
 * `docs/conception-relance-brouillons.md`). Ces conditions vivent dans le SQL,
 * pas dans un `if` d'action : une clause `WHERE` ne s'oublie pas dans une
 * branche, alors qu'un garde-fou en tête de fonction, si.
 *
 * L'espacement entre deux rappels vient de `sqlRappelPermis` : c'est la CADENCE
 * choisie par la speakeuse (migration 066), à défaut le délai réglé par
 * l'équipe. `depart` dit où ses quatre seuils se rangent, pour que chaque
 * requête numérote ses propres paramètres sans convention à retenir.
 */
function conditionsRelance(depart: number): string {
  return `sp.status = 'brouillon'
        AND u.email IS NOT NULL
        -- Suffixe des comptes migrés SANS adresse connue : écrire là rebondit.
        AND u.email NOT LIKE '%.invalid'
        -- Migrée jamais invitée : son premier courrier est l'invitation « tu as
        -- la main sur ta fiche ». Une relance lui parlerait d'un brouillon dont
        -- elle ignore l'existence.
        AND NOT (sp.migrated AND sp.invited_at IS NULL)
        -- Cadence de la personne (« Aucun » exclut, y compris le geste manuel de
        -- l'orga) et anti-doublon, quelle que soit l'origine de l'envoi.
        AND ${sqlRappelPermis(depart)}`;
}

/** Colonnes communes aux deux lectures de relance (profil + envoi + talks). */
const RELANCE_COLUMNS = `${PROFILE_COLUMNS}, sp.last_reminder_at, u.email,
            COALESCE(t.n, 0) AS talks_count`;

/**
 * Sources communes. Le compte de talks passe par une table dérivée plutôt que
 * par une sous-requête corrélée (`(SELECT count(*) … WHERE t.x = sp.id)`) : la
 * seconde est refusée par `pg-mem`, donc invérifiable par nos tests
 * d'intégration. Même résultat, une passe d'agrégation, et une clause qu'on
 * peut faire crier.
 */
const RELANCE_FROM = `FROM speaker_profiles sp
       JOIN users u ON u.id = sp."userId"
       LEFT JOIN (SELECT speaker_profile_id, COUNT(*)::int AS n
                    FROM speaker_talks GROUP BY speaker_profile_id) t
              ON t.speaker_profile_id = sp.id`;

function mapFicheEnSommeil(r: ProfileRow & {
  email: string;
  talks_count: number;
  last_reminder_at: string | null;
}): FicheEnSommeil {
  return {
    profile: mapRow(r),
    email: r.email,
    talksCount: r.talks_count ?? 0,
    lastReminderAt: r.last_reminder_at ?? null,
  };
}

/**
 * LE LOT : les brouillons dont rien n'a bougé depuis la fenêtre. Les plus
 * anciens d'abord (ce sont eux qu'on oublie le plus longtemps).
 */
export async function getProfilesEnSommeil(
  jours: number = REGLAGES_DEFAUT.relance_brouillon_jours,
): Promise<FicheEnSommeil[]> {
  // Le délai de l'équipe joue les DEUX rôles : seuil de sommeil (`$1`, sur
  // `updated_at`) et cadence par défaut de qui n'a rien choisi (`$5`). Une seule
  // lecture d'horloge pour les deux, sans quoi la même notion existerait à deux
  // instants différents.
  const seuils = seuilsCadence(jours);
  const { rows } = await pool.query(
    `SELECT ${RELANCE_COLUMNS}
       ${RELANCE_FROM}
      WHERE sp.updated_at < $1
        AND ${conditionsRelance(2)}
      ORDER BY sp.updated_at ASC`,
    [seuils.defaut, ...seuils.params],
  );
  return (rows as Parameters<typeof mapFicheEnSommeil>[0][]).map(mapFicheEnSommeil);
}

/**
 * La MÊME population, réduite à ce qui s'affiche ailleurs : un nom et un lien.
 * Le tableau de bord orga et la liste des fiches n'ont besoin que de ça — leur
 * faire payer `getProfilesEnSommeil` (toutes les colonnes, les adresses, et
 * l'agrégat des talks) à chaque rendu serait du travail jeté, et ferait
 * traverser des adresses e-mail à des écrans qui ne les affichent jamais.
 */
export async function getProfilesEnSommeilBrefs(
  jours: number = REGLAGES_DEFAUT.relance_brouillon_jours,
): Promise<{ id: number; nom: string | null }[]> {
  const seuils = seuilsCadence(jours);
  const { rows } = await pool.query(
    `SELECT sp.id, u.name
       FROM speaker_profiles sp
       JOIN users u ON u.id = sp."userId"
      WHERE sp.updated_at < $1
        AND ${conditionsRelance(2)}
      ORDER BY sp.updated_at ASC`,
    [seuils.defaut, ...seuils.params],
  );
  return (rows as { id: number; name: string | null }[]).map((r) => ({
    id: r.id,
    // Nom REL ou rien : un blanc donnerait « Relancer la fiche de    ».
    nom: r.name?.trim() || null,
  }));
}

/**
 * LE GESTE INDIVIDUEL : la fiche si (et seulement si) elle peut recevoir une
 * relance maintenant, `null` sinon. Volontairement SANS le critère
 * d'ancienneté : devant la fiche, l'orga voit la personne et décide (un mot
 * après un échange en meetup vaut, même sur un brouillon de trois jours). Tout
 * le reste tient — c'est la même clause que le lot.
 */
export async function getFicheARelancer(
  profileId: number,
  jours: number = REGLAGES_DEFAUT.relance_brouillon_jours,
): Promise<FicheEnSommeil | null> {
  const { rows } = await pool.query(
    `SELECT ${RELANCE_COLUMNS}
       ${RELANCE_FROM}
      WHERE sp.id = $1
        AND ${conditionsRelance(2)}`,
    [profileId, ...seuilsCadence(jours).params],
  );
  return rows.length > 0
    ? mapFicheEnSommeil(rows[0] as Parameters<typeof mapFicheEnSommeil>[0])
    : null;
}

/**
 * Suppression RGPD, MOITIÉ BASE — le nom dit ce qu'elle ne fait pas : un compte
 * vit aussi chez le sous-traitant e-mail. La suppression complète est
 * `supprimerCompte` (`src/lib/suppression-compte.ts`), et c'est elle qu'on
 * appelle ; celle-ci n'est directement utile qu'aux tests qui jugent le SQL.
 *
 * Les ON DELETE CASCADE
 * effacent en chaîne speaker_profiles, talks, accounts et sessions. Le tout dans
 * UNE transaction : soit le compte et le ménage des inscriptions partent
 * ensemble, soit rien (jamais un compte supprimé laissant des données perso
 * derrière lui, ni l'inverse).
 *
 * Cas Tremplin : les inscriptions ont un FK `"userId"` en ON DELETE SET NULL
 * (le palmarès nominatif survit à la suppression du compte via le nom figé).
 * Mais une inscription créée par invitation e-mail n'a PAS de nom : le SET NULL
 * violerait le CHECK d'identité et bloquerait TOUTE la suppression (droit à
 * l'effacement cassé). On supprime donc d'abord ces inscriptions anonymes —
 * rien à préserver — puis on nettoie les autres, puis le compte.
 */
export async function effacerCompteEnBase(userId: number): Promise<void> {
  await withTransaction(async (client) => {
    // 1) Inscriptions purement liées au compte (aucun nom saisi par l'orga) :
    //    aucune valeur d'archive publique → suppression pure.
    await client.query(
      `DELETE FROM tremplin_registrations WHERE "userId" = $1 AND participante_nom IS NULL`,
      [userId],
    );
    // 2) Inscriptions PRIVÉES (public = false) conservées pour les compteurs
    //    anonymes : droit à l'effacement → on anonymise entièrement. Le nom
    //    devient un libellé neutre (le CHECK exige userId OU participante_nom,
    //    et userId va passer à NULL).
    await client.query(
      `UPDATE tremplin_registrations
          SET participante_nom = 'Participante (compte supprimé)',
              participante_role = NULL, participante_linkedin = NULL,
              titre_palmares = NULL, bio = NULL, site_web = NULL, photo_url = NULL
        WHERE "userId" = $1 AND "public" = false`,
      [userId],
    );
    // 3) Inscriptions PUBLIQUES (archive d'événement, consentie) : on garde le
    //    STRICT nécessaire au palmarès public (nom figé, titre primé, classement)
    //    et
    //    on efface tout le reste (rôle, LinkedIn, bio, site, photo) — plus
    //    jamais affiché depuis la fiche (minimisation, RGPD).
    await client.query(
      `UPDATE tremplin_registrations
          SET participante_role = NULL, participante_linkedin = NULL,
              bio = NULL, site_web = NULL, photo_url = NULL
        WHERE "userId" = $1 AND "public" = true`,
      [userId],
    );
    // 4) Consentements DE PHASE (migration 055) : supprimer son compte, c'est
    //    retirer son nom. On révoque, on ne conserve pas — contrairement au
    //    palmarès (§3), qui archive un résultat proclamé devant un public.
    //    Appartenir à une cohorte d'accompagnement n'est pas un fait observé de
    //    l'extérieur : sans cette révocation, elle resterait nommée sur la page
    //    « montée sur scène », ou pire, y figurerait en « Participante (compte
    //    supprimé) » après l'anonymisation du §2. L'appartenance elle-même
    //    reste, pour que l'effectif anonyme de la phase tienne.
    // Sous-requête plutôt qu'un `UPDATE … FROM` aliasé : même effet, et la
    // forme reste lisible par pg-mem (les tests d'intégration jouent ce SQL).
    await client.query(
      `UPDATE tremplin_registration_phases
          SET "public" = false, public_consent_at = NULL
        WHERE registration_id IN (
          SELECT id FROM tremplin_registrations WHERE "userId" = $1)`,
      [userId],
    );
    // 5) Articles JAMAIS publiés (lot N3) : la cession de droits, dite à la
    //    soumission, porte sur la PUBLICATION. Un brouillon ou un article en
    //    relecture reste un contenu personnel sans base de conservation →
    //    suppression. L'article PUBLIÉ, lui, survit, signé (auteur_nom figé,
    //    auteur_user_id passe à NULL par le FK) — c'est la cession.
    await client.query(
      `DELETE FROM contenus WHERE auteur_user_id = $1 AND statut <> 'publie'`,
      [userId],
    );
    // La fiche coach part avec le compte (CASCADE) : son consentement à être
    // citée comme accompagnante s'éteint avec elle, sans geste de plus.
    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
  });
}

/**
 * Speakeuses à inviter (migration annuaire) : profils **migrés** jamais invités,
 * avec un e-mail valide (on exclut les adresses placeholder « .invalid »). On
 * cible le flag `migrated` (pas le statut) car les fiches migrées sont en
 * brouillon tant qu'elles ne sont pas validées. `isOrga` ajoute l'encart orga.
 */
export async function getProfilesToInvite(): Promise<
  { id: number; email: string; name: string | null; isOrga: boolean }[]
> {
  const { rows } = await pool.query(
    `SELECT sp.id, u.email, u.name, u.is_orga
       FROM speaker_profiles sp
       JOIN users u ON u.id = sp."userId"
      WHERE sp.migrated = true
        AND sp.invited_at IS NULL
        AND u.email IS NOT NULL
        AND u.email NOT LIKE '%.invalid'`,
  );
  return (
    rows as { id: number; email: string; name: string | null; is_orga: boolean }[]
  ).map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name ?? null,
    isOrga: r.is_orga === true,
  }));
}

/**
 * La cadence de rappel choisie par une membre (`null` = rien de choisi, donc le
 * délai réglé par l'équipe s'applique).
 *
 * Volontairement HORS de `SpeakerProfile` : c'est une préférence, pas une
 * donnée de fiche. L'y mettre l'aurait fait voyager vers le navigateur avec
 * chaque rendu de fiche publique, où n'importe qui aurait pu lire dans le HTML
 * à quelle fréquence cette personne accepte d'être sollicitée. Une donnée
 * absente du DTO ne peut pas fuiter (`docs/principes-tests.md` § 4).
 */
export async function getRappelCadence(userId: number): Promise<CadenceRappel | null> {
  const { rows } = await pool.query(
    `SELECT rappel_cadence FROM speaker_profiles WHERE "userId" = $1`,
    [userId],
  );
  return cadenceValide((rows[0] as { rappel_cadence: string | null } | undefined)?.rappel_cadence);
}

/**
 * Enregistre le choix. L'écriture est BORNÉE au compte de la session par sa
 * clause `WHERE` : même appelée avec un identifiant venu d'ailleurs, elle ne
 * peut toucher la préférence de personne d'autre.
 *
 * Rend VRAI seulement si une ligne a bougé. Sans fiche, il n'y a rien à régler
 * et rien n'est écrit : l'écran doit alors dire que ça n'a pas pris, au lieu
 * d'annoncer « Choix enregistré » pour un enregistrement qui n'a pas eu lieu
 * (la page ne propose le réglage qu'à celles qui ont une fiche, mais l'action
 * reste appelable, et une fiche peut disparaître entre l'affichage et le clic).
 */
export async function setRappelCadence(
  userId: number,
  cadence: CadenceRappel | null,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE speaker_profiles SET rappel_cadence = $2 WHERE "userId" = $1`,
    [userId, cadence],
  );
  return (rowCount ?? 0) > 0;
}

/** Marque des profils comme invités (anti-double-envoi). */
export async function markInvited(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await pool.query(
    `UPDATE speaker_profiles SET invited_at = now() WHERE id = ANY($1)`,
    [ids],
  );
}

/** Marque des profils comme relancés (cron). */
export async function markRemindersSent(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await pool.query(
    // Liste de placeholders plutôt que `= ANY($1)` : c'est CETTE écriture qui
    // ferme la porte au doublon (une fiche marquée sort du lot de relance), et
    // `pg-mem` ne résout pas les paramètres tableau — la garde serait donc
    // invérifiable en test d'intégration, c'est-à-dire silencieuse le jour où
    // elle tombe. Même requête, mêmes paramètres liés, une preuve en plus.
    `UPDATE speaker_profiles SET last_reminder_at = now()
      WHERE id IN (${ids.map((_, i) => `$${i + 1}`).join(", ")})`,
    ids,
  );
}

/** Crée ou met à jour le profil d'une membre (un seul profil par compte). */
export async function upsertProfile(
  userId: number,
  data: ProfileInput,
): Promise<void> {
  await pool.query(
    `INSERT INTO speaker_profiles
       ("userId", titre_profil, poste, entreprise, bio, website, linkedin, instagram, secteurs, sujets, contact_email_ok, is_woman, sessionize_url, conference_hall_url, cfp_sync_mode, ville, regions, langues, code_postal, code_insee, region_residence, slug, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, now())
     ON CONFLICT ("userId") DO UPDATE SET
       titre_profil = EXCLUDED.titre_profil,
       poste        = EXCLUDED.poste,
       entreprise   = EXCLUDED.entreprise,
       bio          = EXCLUDED.bio,
       website      = EXCLUDED.website,
       linkedin     = EXCLUDED.linkedin,
       instagram    = EXCLUDED.instagram,
       secteurs     = EXCLUDED.secteurs,
       sujets       = EXCLUDED.sujets,
       contact_email_ok = EXCLUDED.contact_email_ok,
       is_woman     = EXCLUDED.is_woman,
       sessionize_url      = EXCLUDED.sessionize_url,
       conference_hall_url = EXCLUDED.conference_hall_url,
       cfp_sync_mode       = EXCLUDED.cfp_sync_mode,
       ville        = EXCLUDED.ville,
       code_postal      = EXCLUDED.code_postal,
       code_insee       = EXCLUDED.code_insee,
       region_residence = EXCLUDED.region_residence,
       regions      = EXCLUDED.regions,
       langues      = EXCLUDED.langues,
       slug         = EXCLUDED.slug,
       -- on NE rebloque PAS un profil publié : il reste visible. updated_at
       -- trace la modif (comparée à validated_at) pour info côté orga.
       updated_at   = now()`,
    [
      userId,
      data.titreProfil,
      data.poste,
      data.entreprise,
      data.bio,
      data.website,
      data.linkedin,
      data.instagram,
      data.secteurs,
      data.sujets,
      data.contactEmailOk,
      data.isWoman,
      data.sessionizeUrl,
      data.conferenceHallUrl,
      data.cfpSyncMode,
      data.ville,
      data.regions,
      data.langues,
      data.codePostal,
      data.codeInsee,
      data.regionResidence,
      data.slug,
    ],
  );
}

/**
 * Retourne l'id du profil de la membre, en le créant (vide) si nécessaire.
 * Utile avant d'ajouter un talk (qui référence un profil).
 */
export async function ensureProfileId(userId: number): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO speaker_profiles ("userId")
     VALUES ($1)
     ON CONFLICT ("userId") DO UPDATE SET "userId" = EXCLUDED."userId"
     RETURNING id`, // contact_email_ok prend son DEFAULT false à la création
    [userId],
  );
  return (rows[0] as { id: number }).id;
}

/**
 * Éligibilité à la soumission à l'annuaire. On exige au moins UN moyen de
 * contact : LinkedIn renseigné OU acceptation du contact par e-mail (relais
 * via formulaire, e-mail jamais affiché).
 */
/** Ce qui manque à une fiche pour rejoindre l'annuaire, ou `null` si rien. */
export type BlocageAnnuaire = "nom" | "contact" | "attestation";

/**
 * MOTIF du blocage, source unique de la règle de publication. Un booléen
 * obligeait chaque appelant à re-tester les conditions une par une pour savoir
 * QUOI dire — la vérification du nom était ainsi écrite deux fois dans la même
 * action, à trois lignes d'écart.
 *
 * Le nom du compte en fait partie : sans lui, la fiche s'afficherait sans nom
 * dans un annuaire de personnes.
 */
export function raisonBlocageAnnuaire(
  profile: SpeakerProfile | null,
): BlocageAnnuaire | null {
  if (!profile?.name?.trim()) return "nom";
  if (!profile.linkedin && !profile.contactEmailOk) return "contact";
  if (!profile.isWoman) return "attestation";
  return null;
}

/** Prédicat dérivé du motif : le hub n'affiche « Soumettre » que s'il aboutira. */
export function canSubmitToDirectory(
  profile: SpeakerProfile | null,
): profile is SpeakerProfile {
  return raisonBlocageAnnuaire(profile) === null;
}

/** Rôle orga (modération) — lu sur la table users. */
export async function getIsOrga(userId: number): Promise<boolean> {
  const { rows } = await pool.query(`SELECT is_orga FROM users WHERE id = $1`, [
    userId,
  ]);
  return rows.length > 0 ? (rows[0] as { is_orga: boolean }).is_orga === true : false;
}

/** Rôles du compte lus À LA CONNEXION (JWT) : orga et animateur/coach. */
export async function getUserRoles(
  userId: number,
): Promise<{ isOrga: boolean; isCoach: boolean }> {
  const { rows } = await pool.query(
    `SELECT is_orga, is_coach FROM users WHERE id = $1`,
    [userId],
  );
  if (rows.length === 0) return { isOrga: false, isCoach: false };
  const r = rows[0] as { is_orga: boolean; is_coach: boolean };
  return { isOrga: r.is_orga === true, isCoach: r.is_coach === true };
}

/**
 * Purge les bravos reçus par UNE fiche — sur la fiche et sur ses scènes.
 * Le « retrait rétroactif partout » du lot N4 (conception v2 §9), partagé
 * entre le retrait volontaire (`withdrawOwnProfile`) et la modération orga
 * (`setProfileStatus`) : une fiche qui quitte le fil n'y laisse rien dormir.
 */
async function purgerReactionsDeFiche(q: Queryable, profileId: number): Promise<void> {
  await q.query(
    `DELETE FROM fil_reactions
      WHERE profile_id = $1
         OR occurrence_id IN (
              SELECT id FROM talk_occurrences WHERE speaker_profile_id = $1)`,
    [profileId],
  );
}

/**
 * La membre retire SA fiche de l'annuaire / de la file : elle repasse en
 * `brouillon` (modifiable, à re-soumettre). Depuis `publie`, `en_attente`,
 * `masque` ou `en_pause` uniquement (on ne touche pas un brouillon/refusé). Ne
 * modifie pas la validation orga passée. Renvoie le nombre de lignes affectées.
 */
export async function withdrawOwnProfile(userId: number): Promise<number> {
  // Retrait + purge des bravos dans UNE transaction (promesse RGPD, jamais un
  // best-effort) ; le repli « table des réactions absente » vit dans le helper.
  return withTransactionSaufTable("fil_reactions", async (q, avecPurge) => {
    const res = await q.query(
      `UPDATE speaker_profiles SET status = 'brouillon'
        WHERE "userId" = $1 AND ${sqlDansListe("status", STATUTS_RETIRABLES)}
        RETURNING id`,
      [userId],
    );
    if (avecPurge)
      for (const r of res.rows as { id: number }[]) await purgerReactionsDeFiche(q, r.id);
    return res.rowCount ?? 0;
  });
}

/**
 * Annuaire réservé aux membres (derrière `FLAG_ADHESIONS`, cf.
 * docs/conception-adhesions-helloasso.md) : à la date annoncée par le préavis,
 * une fiche publiée dont la titulaire n'est pas à jour passe `en_pause`.
 *
 * Trois conditions vivent dans le SQL, pas chez l'appelant, parce que c'est le
 * seul point que traverse toute mise en pause :
 * - `annuaire_retrait_le <= maintenant` — **jamais de pause sans préavis
 *   daté** : la colonne n'est posée qu'après l'envoi réussi de l'e-mail ;
 * - pas d'adhésion à jour à cette heure (elle a pu adhérer pendant le préavis) ;
 * - jamais une orga.
 *
 * Quatrième sortie de « publié » : les bravos partent avec elle (lot N4), comme
 * au retrait et à la modération. Rend le nombre de fiches mises en pause.
 */
export async function mettreFichesEnPause(maintenant: Date = new Date()): Promise<number> {
  return withTransactionSaufTable("fil_reactions", async (q, avecPurge) => {
    const res = await q.query(
      `UPDATE speaker_profiles SET status = 'en_pause'
        WHERE status = 'publie'
          AND annuaire_retrait_le IS NOT NULL
          AND annuaire_retrait_le <= $1
          AND "userId" NOT IN (SELECT id FROM users WHERE is_orga = true)
          AND "userId" NOT IN (
                SELECT "userId" FROM user_memberships m
                 WHERE ${adhesionAJourSql("m", "$1")})
        RETURNING id`,
      [maintenant],
    );
    if (avecPurge)
      for (const r of res.rows as { id: number }[]) await purgerReactionsDeFiche(q, r.id);
    return res.rowCount ?? 0;
  });
}

/**
 * La membre soumet son profil à la validation d'une orga. Une fiche PUBLIÉE
 * re-soumise quitte le fil : ses bravos partent avec elle (lot N4 — la
 * TROISIÈME sortie de « publié », même invariant que le retrait et la
 * modération : rien ne dort en base).
 */
export async function submitForValidation(userId: number): Promise<void> {
  await withTransactionSaufTable("fil_reactions", async (q, avecPurge) => {
    const res = await q.query(
      `UPDATE speaker_profiles
          SET status = 'en_attente', submitted_at = now(), updated_at = now()
        WHERE "userId" = $1
        RETURNING id`,
      [userId],
    );
    if (avecPurge)
      for (const r of res.rows as { id: number }[]) await purgerReactionsDeFiche(q, r.id);
  });
}

/** Nombre de speakeuses PUBLIÉES (= visibles dans l'annuaire public). Sert au
 *  chiffre-clé de la home, cohérent avec ce qu'on voit en cliquant vers l'annuaire. */
export async function countPublishedProfiles(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM speaker_profiles WHERE status = 'publie'`,
  );
  return (rows[0] as { n: number }).n;
}

/** Profils en attente de validation (vue orga). */
export async function getPendingProfiles(): Promise<SpeakerProfile[]> {
  const { rows } = await pool.query(
    `SELECT ${PROFILE_COLUMNS}
       FROM speaker_profiles sp
       JOIN users u ON u.id = sp."userId"
      WHERE status = 'en_attente'
      ORDER BY submitted_at`,
  );
  return (rows as ProfileRow[]).map(mapRow);
}

/**
 * Fiches PUBLIÉES dont le nom réel est vide (`btrim` : `??` à l'affichage
 * laissait passer `""` et `"   "`, dette P1 — cohorte migrée d'avant
 * l'invariant #233). Nourrit la tâche orga « nommer-fiche » ; l'affichage,
 * lui, a son repli (`nomAffiche`). Colonnes minimales : le moteur n'a besoin
 * que de quoi désigner la fiche.
 */
export async function getProfilesPubliesSansNom(): Promise<
  { id: number; titreProfil: string | null }[]
> {
  const { rows } = await pool.query(
    `SELECT sp.id, sp.titre_profil
       FROM speaker_profiles sp
       JOIN users u ON u.id = sp."userId"
      WHERE sp.status = 'publie' AND btrim(coalesce(u.name, '')) = ''
      ORDER BY sp.id`,
  );
  return (rows as { id: number; titre_profil: string | null }[]).map((r) => ({
    id: r.id,
    titreProfil: r.titre_profil,
  }));
}

/**
 * Annuaire public : profils publiés, triés par nom. Source de la page
 * /speakeuses (liste + filtres secteurs/sujets), cartes cliquables vers la fiche.
 */
export async function getPublishedAnnuaire(): Promise<SpeakerProfile[]> {
  const { rows } = await pool.query(
    `SELECT ${PROFILE_COLUMNS}
       FROM speaker_profiles sp
       JOIN users u ON u.id = sp."userId"
      WHERE sp.status = 'publie'
      ORDER BY u.name`,
  );
  return (rows as ProfileRow[]).map(mapRow);
}

/**
 * Speakeuses mentionnables (nom + chemin de fiche), tirées de l'annuaire
 * **publié** : mentionner une speakeuse (« @ » dans l'éditeur de contenus) ne
 * peut donc jamais pointer vers une fiche masquée ou inexistante. Projection
 * sœur de `getSpeakerSearchItems`, ici au plus près de l'annuaire (mêmes briques
 * `toPublicSpeaker`/`speakeuseHref`). Une fiche sans nom (brouillon) est écartée.
 * Résilient : panne base → liste vide.
 */
export async function getSpeakerMentionItems(): Promise<{ name: string; href: string }[]> {
  try {
    const profiles = await getPublishedAnnuaire();
    return profiles
      .map((p) => {
        const s = toPublicSpeaker(p);
        return { name: s.name?.trim() ?? "", href: speakeuseHref(s) };
      })
      .filter((m) => m.name !== "");
  } catch {
    return [];
  }
}

/** Profil + nom de l'orga qui a validé (file de modération, liste publiée). */
export interface ModeratedProfile extends SpeakerProfile {
  validatorName: string | null;
}

/**
 * Profils publiés (vue orga) avec le nom de l'orga qui a validé. Triés par date
 * de validation décroissante. La date de dernière modif (updated_at) permet de
 * repérer les fiches changées depuis leur validation.
 */
export async function getPublishedProfiles(): Promise<ModeratedProfile[]> {
  const { rows } = await pool.query(
    `SELECT ${PROFILE_COLUMNS}, v.name AS validator_name
       FROM speaker_profiles sp
       JOIN users u ON u.id = sp."userId"
       LEFT JOIN users v ON v.id = sp.validated_by
      WHERE sp.status = 'publie'
      ORDER BY sp.validated_at DESC NULLS LAST`,
  );
  return (rows as (ProfileRow & { validator_name: string | null })[]).map((r) => ({
    ...mapRow(r),
    validatorName: r.validator_name ?? null,
  }));
}

/**
 * Tous les profils speakeuses (vue orga), pour le suivi global : statut, dernière
 * modif, soumission, validation. Inclut les brouillons (ex. fiches migrées pas
 * encore reprises). Triés par priorité de statut (à traiter d'abord) puis nom.
 */
export async function getAllProfiles(): Promise<SpeakerProfile[]> {
  const { rows } = await pool.query(
    `SELECT ${PROFILE_COLUMNS}
       FROM speaker_profiles sp
       JOIN users u ON u.id = sp."userId"
      ORDER BY
        CASE sp.status
          WHEN 'en_attente' THEN 0
          WHEN 'refuse' THEN 1
          WHEN 'publie' THEN 2
          WHEN 'masque' THEN 3
          WHEN 'en_pause' THEN 3
          ELSE 4
        END,
        u.name`,
  );
  return (rows as ProfileRow[]).map(mapRow);
}

/**
 * Orga : change le statut d'un profil (publie / refuse / masque) et trace
 * QUI a validé et QUAND. Ne touche pas updated_at (réservé aux modifs de la
 * speakeuse) pour pouvoir détecter une modif postérieure à la validation.
 */
/**
 * Applique une décision de modération. Renvoie `false` si rien n'a été écrit —
 * aujourd'hui l'unique cause est une PUBLICATION sans nom de compte.
 *
 * La condition vit dans le SQL, pas seulement chez l'appelant : c'est le dernier
 * point que traverse toute mise en ligne. Une action « publier la sélection », un
 * script de reprise ou un cron oublieraient le contrôle, exactement comme il
 * manquait avant — ici l'invariant est non contournable.
 */
export async function setProfileStatus(
  profileId: number,
  status: ProfileStatus,
  validatedBy: number,
  motif: string | null = null,
): Promise<boolean> {
  const changer = async (q: Queryable, avecPurge: boolean) => {
    const { rowCount } = await q.query(
      `UPDATE speaker_profiles sp
          SET status = $2,
              validated_by = $3,
              validated_at = now(),
              refus_motif = CASE WHEN $2 = 'refuse' THEN $4 ELSE NULL END,
              -- Une décision d'orga ouvre une nouvelle période : un préavis
              -- d'adhésion en cours ou échu est oublié. Une fiche republiée
              -- sans adhésion reçoit donc un NOUVEAU préavis de trente jours,
              -- au lieu de repartir en pause le lendemain sans un mot.
              annuaire_retrait_le = NULL,
              -- Posée au PREMIER passage en « publié » seulement : le retour
              -- après un retrait est DISCRET, jamais ré-annoncé en tête des
              -- « nouvelles venues ».
              published_at = CASE
                WHEN $2 = 'publie' AND published_at IS NULL THEN now()
                ELSE published_at
              END
        WHERE sp.id = $1
          AND (
            $2 <> 'publie'
            OR EXISTS (
              SELECT 1 FROM users u
               WHERE u.id = sp."userId" AND btrim(coalesce(u.name, '')) <> ''
            )
          )`,
      [profileId, status, validatedBy, motif],
    );
    // Lot N4 : quitter « publie » (masquer, refuser) purge les bravos reçus,
    // comme le retrait volontaire — sinon ils dorment en base, irretirables
    // depuis le fil, et ressurgiraient à la re-publication.
    if (avecPurge && status !== "publie" && (rowCount ?? 0) > 0)
      await purgerReactionsDeFiche(q, profileId);
    return (rowCount ?? 0) > 0;
  };
  // Publier ne purge rien : le chemin chaud (validation d'une fiche) reste
  // une seule requête sans transaction.
  if (status === "publie") return changer(pool, false);
  return withTransactionSaufTable("fil_reactions", changer);
}
