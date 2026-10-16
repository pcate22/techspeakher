import { z } from "zod";
import { REGIONS_OCCURRENCE } from "@/lib/lieu-occurrence";
import { optionalText, optionalUrl } from "@/lib/profile-form";
import { normalizeTalkType } from "@/data/domaines";
import { buildTalkDate } from "@/lib/talk-date";
// Conférence ABSENTE du registre, saisie pour être proposée aux orga
// (migration 068) : MÊME validateur que le formulaire orga, importé et non
// recopié — un nom accepté ici doit produire une conférence valide à la
// promotion. `conference-form.ts` ne tire aucun accès DB (il passe par
// `@/lib/slug`), donc rien à craindre côté poids.
import { nomConfField } from "@/lib/conference-form";
import type { TalkIdentityInput, OccurrenceInput } from "@/lib/talks";
// Définies dans un module sans Zod (`talk-limits.ts`) pour que les composants
// client qui n'ont besoin QUE des limites n'embarquent pas Zod. Ré-exportées
// ici pour les consommateurs serveur/tests qui importaient déjà `talk-form`.
import { TITRE_MAX, DESCRIPTION_MAX } from "@/lib/talk-limits";

export { TITRE_MAX, DESCRIPTION_MAX };

// ─── Identité du talk (titre, type, résumé) ───

const identitySchema = z.object({
  // Le champ de saisie est multi-ligne (titre lisible en entier) et un titre
  // peut arriver collé depuis un CFP : on aplatit les RETOURS À LA LIGNE pour
  // qu'un titre reste UNE ligne, en base comme à l'affichage. Uniquement eux :
  // `\s+` mangeait les espaces insécables de la typographie française
  // (« : ! ? ; »), qui sont de la donnée, pas de la mise en forme.
  titre: z
    .string()
    .transform((v) => v.replace(/[^\S\r\n]*[\r\n]+[^\S\r\n]*/g, " ").trim())
    .pipe(z.string().min(1, "Titre requis").max(TITRE_MAX, "Titre trop long")),
  description: optionalText(DESCRIPTION_MAX),
});

export type TalkIdentityResult =
  | { ok: true; data: TalkIdentityInput }
  | { ok: false; errors: Record<string, string> };

/** Valide et normalise l'identité d'un talk (titre, type, résumé). */
export function parseTalkIdentityForm(formData: FormData): TalkIdentityResult {
  const raw = {
    titre: (formData.get("titre") ?? "").toString(),
    description: (formData.get("description") ?? "").toString(),
  };
  const parsed = identitySchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
    }
    return { ok: false, errors };
  }
  const type = normalizeTalkType((formData.get("type") ?? "").toString());
  return { ok: true, data: { ...parsed.data, type } };
}

// ─── Occurrence (une conférence rattachée à un talk) ───

/**
 * Code INSEE d'une commune française : cinq caractères, dont la Corse
 * (« 2A004 », « 2B033 ») qu'une validation « cinq chiffres » recalerait.
 */
const CODE_INSEE = /^(?:\d{5}|2[AB]\d{3})$/;

/**
 * Seules les régions ADMINISTRATIVES entrent en base, et la liste vient de
 * `lib/lieu-occurrence.ts` — pas de `REGIONS`, qui compte trois entrées de plus
 * qu'une occurrence ne peut pas porter.
 *
 * Correctif de revue (18/08) : `REGIONS` contient « Toute la France » (une case
 * de raccourci de l'annuaire), « International » et « À distance (visio) » (des
 * règles d'affichage). Depuis le lot 1 de l'agenda, la région décide si une
 * intervention TRAVERSE les filtres géographiques : une date toulousaine postée
 * avec `region=À distance (visio)` et un vrai code INSEE passait cette garde, et
 * se retrouvait listée sous CHAQUE ville de l'agenda public. La forme est la
 * même qu'avant (une liste blanche), c'est la liste qui se ferme.
 */
const REGIONS_CONNUES: ReadonlySet<string> = new Set(REGIONS_OCCURRENCE);

/**
 * La géographie postée est REVALIDÉE — elle arrive par des champs cachés que
 * `VilleField` remplit depuis la Base Adresse Nationale, donc par une entrée
 * non fiable. Le serveur ne peut pas interroger la BAN à chaque
 * enregistrement : ce serait lent, et surtout une saisie ne doit JAMAIS échouer
 * parce qu'un service tiers est indisponible.
 *
 * L'invariant tient lieu de vérification : **une région ne survit qu'accompagnée
 * d'un code INSEE plausible**. Un code INSEE désigne une commune FRANÇAISE ;
 * sans lui, annoncer « Occitanie » est invérifiable. Le cas qui mord est
 * « Bruxelles » + « Occitanie » : Bruxelles n'a pas de code INSEE, la région
 * tombe. Forger les deux suppose de fournir un vrai code français, c'est-à-dire
 * de dire la vérité.
 *
 * Ce n'est PAS une frontière d'autorisation — l'occurrence appartient à qui la
 * saisit, et la ville était déjà du texte libre. C'est une garde de QUALITÉ :
 * sans elle, une facette « Occitanie » listerait des dates bruxelloises.
 */
function geographieValidee(
  ville: string | null,
  codeInseeBrut: string,
  regionBrute: string,
): { codeInsee: string | null; region: string | null } {
  if (!ville) return { codeInsee: null, region: null };
  const codeInsee = CODE_INSEE.test(codeInseeBrut.trim()) ? codeInseeBrut.trim() : null;
  if (!codeInsee) return { codeInsee: null, region: null };
  const region = regionBrute.trim();
  return {
    codeInsee,
    region: REGIONS_CONNUES.has(region) ? region : null,
  };
}

const occurrenceSchema = z.object({
  conference: optionalText(160),
  ville: optionalText(120),
  pays: optionalText(120),
  lienConf: optionalUrl,
  lienSlides: optionalUrl,
  lienVideo: optionalUrl,
  lienFeedback: optionalUrl,
});

export type OccurrenceFormResult =
  | {
      ok: true;
      data: OccurrenceInput;
      /**
       * Nom de la conférence à proposer, quand la speakeuse a choisi « ma
       * conférence manque dans la liste ». L'action serveur en fait une
       * proposition et rattache la saisie dessus ; null = choix au registre.
       */
      conferenceProposee: string | null;
    }
  | { ok: false; errors: Record<string, string> };

/**
 * Valide et normalise une occurrence (entrées non fiables). `conferenceId` et
 * `editionId` viennent de champs cachés falsifiables : relayés tels quels ICI
 * (parse pur, sans DB) et REVALIDÉS par l'action serveur (l'édition déduit sa
 * conférence ; une conf hors registre est refusée). Le libellé `conference`
 * soumis n'est qu'un fallback : l'action le réécrit depuis le registre (SNAPSHOT).
 */
export function parseOccurrenceForm(formData: FormData): OccurrenceFormResult {
  const raw = {
    conference: (formData.get("conference") ?? "").toString(),
    ville: (formData.get("ville") ?? "").toString(),
    pays: (formData.get("pays") ?? "").toString(),
    lienConf: (formData.get("lienConf") ?? "").toString(),
    lienSlides: (formData.get("lienSlides") ?? "").toString(),
    lienVideo: (formData.get("lienVideo") ?? "").toString(),
    lienFeedback: (formData.get("lienFeedback") ?? "").toString(),
  };
  const parsed = occurrenceSchema.safeParse(raw);
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
    }
  }

  // Date de l'intervention (précision variable). Année vide → pas de date…
  // sauf si un jour ou un mois a été choisi : depuis que l'année cesse d'être
  // exigée avec une édition (2026-10-15), il serait jeté sans un mot.
  let date: string | null = null;
  const annee = (formData.get("annee") ?? "").toString().trim();
  const moisOuJour =
    (formData.get("mois") ?? "").toString().trim() !== "" ||
    (formData.get("jour") ?? "").toString().trim() !== "";
  if (annee === "" && moisOuJour) errors.date = "Choisis aussi l'année.";
  if (annee !== "") {
    const built = buildTalkDate(
      annee,
      (formData.get("mois") ?? "").toString(),
      (formData.get("jour") ?? "").toString(),
    );
    if (built.ok) date = built.value;
    else errors.date = built.error;
  }

  const asId = (name: string): number | null => {
    const n = Number(formData.get(name));
    return Number.isInteger(n) && n > 0 ? n : null;
  };

  // « Ma conférence manque dans la liste » : le nom saisi n'est validé que si
  // aucune conférence du registre n'est choisie — un champ resté rempli après
  // un retour au registre ne doit pas bloquer l'enregistrement.
  const conferenceId = asId("conferenceId");
  const editionId = asId("editionId");
  let conferenceProposee: string | null = null;
  const propose = (formData.get("conferenceProposee") ?? "").toString();
  // `propose !== ""` (et pas `.trim() !== ""`) : un champ rempli d'espaces DOIT
  // passer par Zod, sinon il tombe dans le refus générique porté par le
  // sélecteur — un message d'erreur loin du champ que la personne a rempli.
  if (conferenceId == null && editionId == null && propose !== "") {
    const nom = nomConfField.safeParse(propose);
    if (nom.success) conferenceProposee = nom.data;
    else errors.conferenceProposee = nom.error.issues[0].message;
  }

  if (!parsed.success || Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  // La géographie se valide APRÈS Zod : elle dépend de la ville normalisée.
  const geographie = geographieValidee(
    parsed.data.ville,
    (formData.get("codeInsee") ?? "").toString(),
    (formData.get("region") ?? "").toString(),
  );

  return {
    ok: true,
    conferenceProposee,
    data: {
      ...parsed.data,
      ...geographie,
      date,
      conferenceId,
      editionId,
    },
  };
}
