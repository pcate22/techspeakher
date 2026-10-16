import { z } from "zod";
import { firstErrors, formString, optionalText, optionalUrl } from "@/lib/profile-form";
import { optionalIsoDate } from "@/lib/tremplin-form";
// `@/lib/slug` (pure) et non l'alias `slugifyConference` de `@/lib/conferences` :
// sans import DB, ce module devient importable par `talk-form.ts`, qui a besoin
// du MÊME `nomConfField` (une seule définition de « nom de conférence valide »).
import { slugify } from "@/lib/slug";

const NOM_MAX = 160;

/**
 * Nom d'une conférence : le slug (clé de navigation ET d'unicité) en est dérivé,
 * donc le nom doit produire un slug non vide. Un nom de 2+ caractères tous
 * non-alphanumériques (symboles, écriture non latine non translittérée) passerait
 * `min(2)` mais donnerait un slug "" → conférence inatteignable. On le refuse ici.
 *
 * UNE définition, partagée par le formulaire orga ET par la saisie « ma
 * conférence manque dans la liste » (`talk-form.ts`) : les deux alimentent la
 * même table `conferences`, une borne qui divergerait laisserait un chemin
 * accepter un nom que la promotion rejette.
 */
export const nomConfField = z
  .string()
  .trim()
  .min(2, "Nom requis")
  .max(NOM_MAX, "Nom trop long")
  .refine((v) => slugify(v).length > 0, {
    message: "Le nom doit contenir des lettres ou des chiffres.",
  });

/**
 * Validation des formulaires de la référence des conférences (entrées non
 * fiables). L'id d'endpoint Sessionize est la vraie défense anti-SSRF : format
 * strict validé ICI, hôte sessionize.com codé en dur côté fetch.
 */

/** Id d'endpoint public Sessionize (API/Embed) : alphanumérique court. */
export const ENDPOINT_REGEX = /^[a-z0-9]{6,32}$/i;

const endpointField = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || ENDPOINT_REGEX.test(v), {
    message:
      "Id d'endpoint invalide : lettres et chiffres uniquement (pas l'URL complète).",
  });

/** Adresse https d'une page programme (bornée) — l'id en est détecté par l'action. */
const PAGE_PROGRAMME_REGEX = /^https:\/\/\S{1,300}$/i;

/**
 * Champ endpoint des ÉDITIONS (écran orga) : l'id, OU l'adresse https de la
 * page programme — l'action la passe au détecteur (`detecteur-sessionize.ts`,
 * garde SSRF) et n'écrit jamais que l'id. Le formulaire MEMBRE « propose-la »
 * reste sur `endpointField` (id strict) : aller chercher une page côté
 * serveur est un pouvoir réservé à l'orga.
 */
const endpointOuPageField = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || ENDPOINT_REGEX.test(v) || PAGE_PROGRAMME_REGEX.test(v), {
    message:
      "Colle l'id d'endpoint (lettres et chiffres), ou l'adresse https de la page programme.",
  });

const anneeField = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v >= 1990 && v <= 2100), {
    message: "Année invalide.",
  });

const conferenceSchema = z.object({
  nom: nomConfField,
  type: z.enum(["conference", "asso"]),
  ville: optionalText(120),
  pays: optionalText(120),
  siteUrl: optionalUrl,
});

const editionSchema = z
  .object({
    conferenceId: z.coerce.number().int().positive("Conférence requise"),
    annee: anneeField,
    // Même validateur que les Tremplins : rejette aussi les dates impossibles.
    dateDebut: optionalIsoDate("Date invalide (AAAA-MM-JJ)."),
    // Dernier jour d'un événement sur PLUSIEURS jours : c'est elle qui décide
    // ce qu'une édition lègue à la date d'un talk (`dateLegueeParEdition`).
    dateFin: optionalIsoDate("Date invalide (AAAA-MM-JJ)."),
    ville: optionalText(120),
    lieu: optionalText(160),
    url: optionalUrl,
    endpoint: endpointOuPageField,
  })
  .superRefine((e, ctx) => {
    // La fenêtre a besoin de ses deux bords, dans l'ordre (même règle que le
    // CHECK en base, migration 069) : l'erreur se lit ici, jamais en 500.
    if (e.dateFin == null) return;
    if (e.dateDebut == null) {
      ctx.addIssue({
        code: "custom",
        path: ["dateFin"],
        message: "Renseigne aussi la date de début.",
      });
    } else if (e.dateFin < e.dateDebut) {
      ctx.addIssue({
        code: "custom",
        path: ["dateFin"],
        message: "La fin doit suivre le début.",
      });
    }
  });

/**
 * Les champs d'une PROPOSITION de conférence — ceux que la membre dépose et
 * ceux que l'orga corrige avant de valider. Un seul objet, deux schémas : la
 * seule différence est le champ endpoint, et elle est délibérée (voir plus bas).
 * Deux listes jumelles auraient divergé au premier champ ajouté.
 */
const propositionFields = {
  nomConference: nomConfField,
  annee: anneeField,
  ville: optionalText(120),
  url: optionalUrl,
};

/** Formulaire membre : « Ta conf n'y est pas ? Ajoute-la ». */
const memberEditionSchema = z.object({
  ...propositionFields,
  endpoint: endpointField,
});

/**
 * Correction d'une proposition par une ORGA, avant validation. Mêmes champs,
 * sauf l'endpoint : elle peut coller l'adresse de la page programme, que
 * l'action passe au détecteur — aller chercher une page côté serveur est un
 * pouvoir réservé à l'orga (même règle que les éditions).
 */
const propositionOrgaSchema = z.object({
  ...propositionFields,
  endpoint: endpointOuPageField,
});

export type ConferenceFormResult =
  | { ok: true; data: z.infer<typeof conferenceSchema> }
  | { ok: false; errors: Record<string, string> };
export type EditionFormResult =
  | { ok: true; data: z.infer<typeof editionSchema> }
  | { ok: false; errors: Record<string, string> };
export type PropositionOrgaFormResult =
  | { ok: true; data: z.infer<typeof propositionOrgaSchema> }
  | { ok: false; errors: Record<string, string> };
export type MemberEditionFormResult =
  | { ok: true; data: z.infer<typeof memberEditionSchema> }
  | { ok: false; errors: Record<string, string> };

const get = formString;

export function parseConferenceForm(formData: FormData): ConferenceFormResult {
  const parsed = conferenceSchema.safeParse({
    nom: get(formData, "nom"),
    type: get(formData, "type") || "conference",
    ville: get(formData, "ville"),
    pays: get(formData, "pays"),
    siteUrl: get(formData, "siteUrl"),
  });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error.issues) };
  return { ok: true, data: parsed.data };
}

export function parseEditionForm(formData: FormData): EditionFormResult {
  const parsed = editionSchema.safeParse({
    conferenceId: get(formData, "conferenceId"),
    annee: get(formData, "annee"),
    dateDebut: get(formData, "dateDebut"),
    dateFin: get(formData, "dateFin"),
    ville: get(formData, "ville"),
    lieu: get(formData, "lieu"),
    url: get(formData, "url"),
    endpoint: get(formData, "endpoint"),
  });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error.issues) };
  return { ok: true, data: parsed.data };
}

/**
 * UN NOM de conférence, validé seul — pour le geste « reprendre ce nom », qui
 * n'envoie que lui. Le MÊME `nomConfField` que les trois formulaires : une
 * porte de moins ne doit pas être une garde de moins.
 */
export function parseNomConference(brut: FormDataEntryValue | null): string | null {
  const parsed = nomConfField.safeParse(typeof brut === "string" ? brut : "");
  return parsed.success ? parsed.data : null;
}

export function parsePropositionOrgaForm(
  formData: FormData,
): PropositionOrgaFormResult {
  const parsed = propositionOrgaSchema.safeParse({
    nomConference: get(formData, "nomConference"),
    annee: get(formData, "annee"),
    ville: get(formData, "ville"),
    url: get(formData, "url"),
    endpoint: get(formData, "endpoint"),
  });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error.issues) };
  return { ok: true, data: parsed.data };
}

export function parseMemberEditionForm(formData: FormData): MemberEditionFormResult {
  const parsed = memberEditionSchema.safeParse({
    nomConference: get(formData, "nomConference"),
    annee: get(formData, "annee"),
    ville: get(formData, "ville"),
    url: get(formData, "url"),
    endpoint: get(formData, "endpoint"),
  });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error.issues) };
  return { ok: true, data: parsed.data };
}
