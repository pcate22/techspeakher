import { z } from "zod";
import { optionalText, optionalUrl, isValidEmail } from "@/lib/profile-form";
import type { DocumentInput, DocumentType } from "@/lib/tremplin-documents";
import type { RegistrationPublicDetails } from "@/lib/tremplin-registrations";
import type { PhotoInput, PhotoKind } from "@/lib/tremplin-photos";
import type { AtelierInput, AtelierInfos } from "@/lib/tremplin-ateliers";
import type { EditionInput, EditionUpdate } from "@/lib/tremplin-editions";
import { nomConference } from "@/lib/tremplin-conf";

const DOC_TYPES = [
  "support_atelier",
  "feedback_jury",
  "video_pitch",
  "note",
  "autre",
] as const;

const MAX_CONTENU = 20000;

/** "" / absent → null ; sinon un entier. */
function optInt(v: FormDataEntryValue | null): number | null {
  const s = (v ?? "").toString().trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : null;
}

/** Portée d'un document : tout le monde / un atelier / une participante. */
const PORTEES = ["generale", "atelier", "participante"] as const;
export type DocumentPortee = (typeof PORTEES)[number];

const documentSchema = z
  .object({
    type: z.enum(DOC_TYPES).catch("autre"),
    titre: z.string().trim().min(1, "Titre requis").max(200, "Titre trop long"),
    lien: optionalUrl, // null si vide ; refuse les schémas non http(s)
    contenu: optionalText(MAX_CONTENU),
    atelierId: z.number().int().nullable(),
    registrationId: z.number().int().nullable(),
  })
  .refine((d) => d.lien !== null || d.contenu !== null, {
    message: "Ajoute un lien ou du contenu",
    path: ["lien"],
  })
  // Garde RGPD : un retour du jury ou une vidéo de pitch est PERSONNEL — sans
  // inscription cible, il partirait en « partagé » et serait servi à toutes
  // les inscrites de l'édition (getSharedDocuments).
  .refine(
    (d) => !["feedback_jury", "video_pitch"].includes(d.type) || d.registrationId !== null,
    {
      message:
        "Un retour du jury ou une vidéo de pitch se dépose sur la fiche de la participante (portée « participante »).",
      path: ["type"],
    },
  );

export type DocumentFormResult =
  | { ok: true; data: DocumentInput }
  | { ok: false; error: string };

/**
 * Valide les champs du formulaire « ajouter un document » (entrées orga non
 * fiables). La **portée** (générale = toutes les participantes par défaut /
 * atelier / participante) détermine la cible : on ne retient que l'id pertinent,
 * l'autre est ignoré — plus de combinaison ambiguë « atelier ET participante ».
 * Le rattachement de la cible à l'édition est revérifié dans `addDocument`.
 */
export function parseDocumentForm(
  formData: FormData,
  auteurId: number,
): DocumentFormResult {
  const porteeRaw = (formData.get("portee") ?? "generale").toString();
  const portee: DocumentPortee = (PORTEES as readonly string[]).includes(porteeRaw)
    ? (porteeRaw as DocumentPortee)
    : "generale";

  const atelierId = portee === "atelier" ? optInt(formData.get("atelierId")) : null;
  const registrationId =
    portee === "participante" ? optInt(formData.get("registrationId")) : null;

  if (portee === "atelier" && atelierId === null) {
    return { ok: false, error: "Choisis l'atelier concerné." };
  }
  if (portee === "participante" && registrationId === null) {
    return { ok: false, error: "Choisis la participante concernée." };
  }

  const parsed = documentSchema.safeParse({
    type: (formData.get("type") ?? "").toString() as DocumentType,
    titre: (formData.get("titre") ?? "").toString(),
    lien: (formData.get("lien") ?? "").toString(),
    contenu: (formData.get("contenu") ?? "").toString(),
    atelierId,
    registrationId,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  const { type, titre, lien, contenu } = parsed.data;
  return {
    ok: true,
    data: { atelierId, registrationId, auteurId, type, titre, lien, contenu },
  };
}

export interface AttachInput {
  editionId: number;
  registrationId: number;
  /** Compte existant choisi dans la recherche (rattachement direct), ou null. */
  compteId: number | null;
  /** E-mail à inviter si aucun compte n'est choisi (sinon null). */
  email: string | null;
  /** Prénom et nom (facultatif) : complète le compte s'il n'en a pas encore. */
  nom: string | null;
}

export type AttachFormResult =
  | { ok: true; data: AttachInput }
  | { ok: false; error: string };

export interface RegistrationDetailsInput extends RegistrationPublicDetails {
  editionId: number;
  registrationId: number;
}

export type RegistrationDetailsResult =
  | { ok: true; data: RegistrationDetailsInput }
  | { ok: false; error: string };

/**
 * Valide le formulaire « détails publics » d'une inscription (entrées orga non
 * fiables) : récompense, bio, site web, URL de photo. Les URLs passent par
 * `optionalUrl` (http(s) uniquement) — défense anti-XSS, ces champs étant
 * rendus sur des pages publiques. Le scope à l'édition est revérifié en BDD.
 */
export function parseRegistrationDetailsForm(formData: FormData): RegistrationDetailsResult {
  const editionId = optInt(formData.get("editionId"));
  const registrationId = optInt(formData.get("registrationId"));
  if (editionId === null || registrationId === null) {
    return { ok: false, error: "Édition ou inscription invalide" };
  }
  // Classement de podium : entier >= 1, ou VIDE (non classée). Le libellé
  // « 1ᵉʳ prix » est dérivé à l'affichage (cf. rangLabel), plus de texte libre.
  // Une saisie non vide mais non entière (« 1er », « 2,5 ») est une ERREUR, pas
  // un « non classée » silencieux (sinon on déclasserait par mégarde).
  const classementBrut = (formData.get("classement") ?? "").toString().trim();
  const classement = optInt(formData.get("classement"));
  if (classementBrut !== "" && (classement === null || classement < 1)) {
    return { ok: false, error: "Classement invalide (1, 2, 3…)." };
  }
  return { ok: true, data: { editionId, registrationId, classement } };
}

const PHOTO_KINDS = ["podium", "soiree", "autre"] as const;
const MAX_LEGENDE = 200;

const photoSchema = z.object({
  url: optionalUrl, // http(s) uniquement ; null si vide → rejeté ci-dessous
  legende: optionalText(MAX_LEGENDE),
  kind: z.enum(PHOTO_KINDS).catch("autre"),
});

export interface PhotoFormData extends PhotoInput {
  editionId: number;
  /** Inscriptions taguées sur la photo (droit à l'image). */
  registrationIds: number[];
}

export type PhotoFormResult =
  | { ok: true; data: PhotoFormData }
  | { ok: false; error: string };

/**
 * Valide le formulaire « ajouter une photo » (entrées orga non fiables). L'URL
 * de la photo est obligatoire et http(s) uniquement (anti-XSS, rendue sur des
 * pages publiques). Les personnes taguées sont des ids d'inscription ; leur
 * appartenance à l'édition est revérifiée dans `setPhotoPersons`.
 */
export function parsePhotoForm(formData: FormData): PhotoFormResult {
  const editionId = optInt(formData.get("editionId"));
  if (editionId === null || editionId <= 0) {
    return { ok: false, error: "Édition invalide" };
  }
  const parsed = photoSchema.safeParse({
    url: (formData.get("url") ?? "").toString(),
    legende: (formData.get("legende") ?? "").toString(),
    kind: (formData.get("kind") ?? "").toString(),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  if (parsed.data.url === null) {
    return { ok: false, error: "URL de photo requise (http(s))." };
  }
  const registrationIds = formData
    .getAll("personnes")
    .map((v) => optInt(v))
    .filter((n): n is number => n !== null && n > 0);

  return {
    ok: true,
    data: {
      editionId,
      url: parsed.data.url,
      legende: parsed.data.legende,
      kind: parsed.data.kind as PhotoKind,
      registrationIds,
    },
  };
}

const MAX_TITRE = 200;
const MAX_DESC = 2000;
const MAX_COACHS = 200;

/** Vraie date calendaire AAAA-MM-JJ (le regex seul laisse passer 2026-02-31). */
function isRealIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Date AAAA-MM-JJ optionnelle : "" → null, sinon vraie date calendaire. */
export const optionalIsoDate = (message: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || isRealIsoDate(v), message);

const atelierSchema = z.object({
  titre: z.string().trim().min(1, "Titre requis").max(MAX_TITRE, "Titre trop long"),
  date: optionalIsoDate("Date invalide (AAAA-MM-JJ)"),
  description: optionalText(MAX_DESC),
  lienVisio: optionalUrl, // http(s) uniquement ; null si vide
  coachs: optionalText(MAX_COACHS),
});

export interface AtelierFormData {
  editionId: number;
  atelier: AtelierInput;
  /** Participantes membres (inventaire nominatif) ; « ouvert à toutes » est une propriété à part. */
  registrationIds: number[];
}

export type AtelierFormResult =
  | { ok: true; data: AtelierFormData }
  | { ok: false; error: string };

/** Heure HH:MM (24 h), optionnelle : "" → null. On tolère les secondes en
 * entrée (« HH:MM:SS », que renvoie une colonne TIME relue puis re-postée) et
 * on normalise systématiquement en « HH:MM ». */
const HEURE_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const optionalHeure = (message: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || HEURE_RE.test(v), message)
    .transform((v) => (v === null ? null : v.slice(0, 5)));

/** Champs de fond d'un atelier édités sur sa fiche — MÊME validation que la
 * création (titre requis + bornes, date calendaire, description bornée), plus
 * les horaires. Une seule définition partagée, sinon create et edit divergent
 * (cf. `editionChampsCommuns`). */
const atelierInfosSchema = z
  .object({
    titre: z.string().trim().min(1, "Le titre est obligatoire").max(MAX_TITRE, "Titre trop long"),
    date: optionalIsoDate("Date invalide (AAAA-MM-JJ)"),
    dateFin: optionalIsoDate("Date de fin invalide (AAAA-MM-JJ)"),
    heureDebut: optionalHeure("Heure de début invalide (HH:MM)"),
    heureFin: optionalHeure("Heure de fin invalide (HH:MM)"),
    lieu: optionalText(MAX_DESC),
    description: optionalText(MAX_DESC),
  })
  // Fenêtre cohérente : la fin ne précède pas le début (dates ISO → comparaison
  // lexicographique = chronologique). Message clair plutôt qu'une erreur SQL.
  .refine((d) => !d.date || !d.dateFin || d.dateFin >= d.date, {
    message: "La date de fin ne peut pas précéder la date de début.",
    path: ["dateFin"],
  });

export type AtelierInfosFormResult =
  | { ok: true; data: AtelierInfos }
  | { ok: false; error: string };

/** Valide l'édition des informations d'un atelier (entrées orga non fiables). */
export function parseAtelierInfosForm(formData: FormData): AtelierInfosFormResult {
  const parsed = atelierInfosSchema.safeParse({
    titre: (formData.get("titre") ?? "").toString(),
    date: (formData.get("date") ?? "").toString(),
    dateFin: (formData.get("dateFin") ?? "").toString(),
    heureDebut: (formData.get("heureDebut") ?? "").toString(),
    heureFin: (formData.get("heureFin") ?? "").toString(),
    lieu: (formData.get("lieu") ?? "").toString(),
    description: (formData.get("description") ?? "").toString(),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Valide le formulaire « ajouter un atelier » (entrées orga non fiables) :
 * titre requis, date optionnelle, description, lien visio (http(s)), coachs,
 * et la sélection de participantes (membres, inventaire nominatif).
 * L'appartenance des membres à l'édition est revérifiée en base.
 */
export function parseAtelierForm(formData: FormData): AtelierFormResult {
  const editionId = optInt(formData.get("editionId"));
  if (editionId === null || editionId <= 0) {
    return { ok: false, error: "Édition invalide" };
  }
  const parsed = atelierSchema.safeParse({
    titre: (formData.get("titre") ?? "").toString(),
    date: (formData.get("date") ?? "").toString(),
    description: (formData.get("description") ?? "").toString(),
    lienVisio: (formData.get("lienVisio") ?? "").toString(),
    coachs: (formData.get("coachs") ?? "").toString(),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  const registrationIds = formData
    .getAll("membres")
    .map((v) => optInt(v))
    .filter((n): n is number => n !== null && n > 0);

  return {
    ok: true,
    data: {
      editionId,
      atelier: {
        ordre: 0,
        titre: parsed.data.titre,
        date: parsed.data.date,
        heureDebut: null,
        heureFin: null,
        description: parsed.data.description,
        lienVisio: parsed.data.lienVisio,
        coachs: parsed.data.coachs,
      },
      registrationIds,
    },
  };
}

/**
 * Identifiant d'URL à partir d'un nom de conférence : minuscules, accents
 * retirés, tout le reste en tirets (« Devoxx France » → `devoxx-france`).
 */
export function slugify(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // diacritiques (é → e)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Champs éditoriaux communs aux DEUX formulaires d'édition (création et
 * modification) : une seule définition, sinon les validations divergent.
 */
const editionChampsCommuns = {
  nom: z.string().trim().min(1, "Nom de l'édition requis").max(MAX_TITRE, "Nom trop long"),
  confNom: z
    .string()
    .trim()
    .min(1, "Nom de la conférence requis")
    .max(MAX_TITRE, "Nom trop long")
    // L'année est l'AXE de l'édition, jamais le nom de la conf récurrente
    // (aucune vraie conf ne met l'année dans sa marque). Empêche « DevFest 2026 ».
    .refine((v) => !/\b(19|20)\d{2}\b/.test(v), "N'inclus pas l'année dans le nom : c'est l'édition."),
  // Lieu de la conf : ville OU pays (Devoxx = pays, DevFest = ville), optionnel
  // (Mix-IT / Agile on the Beach n'en ont pas). Sert au nom affiché et au slug.
  confLieu: optionalText(MAX_TITRE),
  confDate: optionalIsoDate("Date de la conférence invalide"),
  confLien: optionalUrl,
  finaleDate: optionalIsoDate("Date de la finale invalide"),
  finaleLieu: optionalText(MAX_TITRE),
  description: optionalText(MAX_DESC),
  inscriptionsDebut: optionalIsoDate("Date de début des inscriptions invalide"),
  inscriptionsFin: optionalIsoDate("Date de fin des inscriptions invalide"),
  // Événement de la référence des conférences (migration 027) pointé par
  // cette édition de Tremplin (facultatif : "" = non reliée).
  conferenceEditionId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0), {
      message: "Événement de la référence invalide",
    }),
} as const;

const EDITION_CHAMPS_NOMS = Object.keys(editionChampsCommuns);

/** Extrait de FormData les chaînes attendues par un schéma (clé → string). */
function formStrings(formData: FormData, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.map((n) => [n, (formData.get(n) ?? "").toString()]));
}

/** Contrôle croisé de la fenêtre d'inscriptions ; message d'erreur ou null. */
function fenetreInscriptionsErreur(d: {
  inscriptionsDebut: string | null;
  inscriptionsFin: string | null;
}): string | null {
  if (d.inscriptionsDebut && d.inscriptionsFin && d.inscriptionsDebut > d.inscriptionsFin) {
    return "La fin des inscriptions doit suivre leur début.";
  }
  return null;
}

const editionSchema = z.object({
  ...editionChampsCommuns,
  annee: z
    .string()
    .trim()
    .refine((v) => /^\d{4}$/.test(v), "Année invalide")
    .transform(Number)
    .refine((n) => n >= 2000 && n <= 2100, "Année hors bornes (2000–2100)"),
  confSlug: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === "" || SLUG_RE.test(v), "Identifiant d'URL invalide (minuscules, chiffres, tirets)"),
});

export type EditionFormResult =
  | { ok: true; data: EditionInput }
  | { ok: false; error: string };

/**
 * Valide le formulaire « créer une édition » (entrées orga non fiables).
 * Le slug d'URL est déduit du nom de la conférence si non fourni ; il définit
 * l'identité publique (conf_slug, annee) — l'unicité est garantie en base.
 * Statut initial : `preparation` (invisible du public tant que non ouverte).
 */
export function parseEditionForm(formData: FormData): EditionFormResult {
  const parsed = editionSchema.safeParse(
    formStrings(formData, [...EDITION_CHAMPS_NOMS, "annee", "confSlug"]),
  );
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  const d = parsed.data;
  const fenetreErr = fenetreInscriptionsErreur(d);
  if (fenetreErr) return { ok: false, error: fenetreErr };
  // Slug déduit de la marque + du lieu (« DevFest » + « Toulouse » →
  // devfest-toulouse), pour distinguer les instances d'une même marque
  // (devfest-toulouse vs devfest-nantes) ; surchargeable, gelé après création.
  const confSlug = d.confSlug || slugify(nomConference(d.confNom, d.confLieu));
  if (!SLUG_RE.test(confSlug)) {
    return { ok: false, error: "Impossible de déduire un identifiant d'URL du nom de la conférence." };
  }
  return {
    ok: true,
    data: {
      nom: d.nom,
      annee: d.annee,
      confSlug,
      statut: "preparation",
      description: d.description,
      confNom: d.confNom,
      confLieu: d.confLieu,
      confDate: d.confDate,
      confLien: d.confLien,
      finaleDate: d.finaleDate,
      finaleLieu: d.finaleLieu,
      inscriptionsDebut: d.inscriptionsDebut,
      inscriptionsFin: d.inscriptionsFin,
      conferenceEditionId: d.conferenceEditionId,
    },
  };
}

const editionUpdateSchema = z.object(editionChampsCommuns);

export type EditionUpdateFormResult =
  | { ok: true; data: { editionId: number; update: EditionUpdate } }
  | { ok: false; error: string };

/**
 * Valide le formulaire « informations de l'édition » (champs éditoriaux).
 * Le STATUT a sa propre action (sous-page dédiée — c'est là qu'on ouvre une
 * édition). L'identité publique (conf_slug, annee) n'est volontairement pas
 * modifiable (URLs publiées).
 */
export function parseEditionUpdateForm(formData: FormData): EditionUpdateFormResult {
  const editionId = optInt(formData.get("editionId"));
  if (editionId === null || editionId <= 0) {
    return { ok: false, error: "Édition invalide" };
  }
  const parsed = editionUpdateSchema.safeParse(
    formStrings(formData, [...EDITION_CHAMPS_NOMS]),
  );
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  const u = parsed.data;
  const fenetreErr = fenetreInscriptionsErreur(u);
  if (fenetreErr) return { ok: false, error: fenetreErr };
  return { ok: true, data: { editionId, update: u } };
}

/** Valide le rattachement compte ↔ inscription (par e-mail). */
export function parseAttachForm(formData: FormData): AttachFormResult {
  const editionId = optInt(formData.get("editionId"));
  const registrationId = optInt(formData.get("registrationId"));
  const compteId = optInt(formData.get("compteId"));
  const email = (formData.get("email") ?? "").toString().trim().toLowerCase();
  if (editionId === null || registrationId === null) {
    return { ok: false, error: "Édition ou inscription invalide" };
  }
  const nomBrut = (formData.get("nom") ?? "").toString().trim();
  if (nomBrut.length > MAX_TITRE) {
    return { ok: false, error: "Nom trop long" };
  }
  const nom = nomBrut === "" ? null : nomBrut;
  // Rattachement DIRECT à un compte existant choisi dans la recherche : pas
  // besoin d'e-mail (le compte existe déjà, la personne est joignable).
  if (compteId !== null) {
    return { ok: true, data: { editionId, registrationId, compteId, email: null, nom } };
  }
  // Sinon, invitation par e-mail (le compte sera pré-créé au besoin).
  if (!isValidEmail(email)) {
    return { ok: false, error: "Choisis un compte dans la liste, ou saisis un e-mail valide" };
  }
  return {
    ok: true,
    data: { editionId, registrationId, compteId: null, email, nom },
  };
}
