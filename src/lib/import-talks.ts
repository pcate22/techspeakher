// Import de talks depuis un fichier (JSON ou CSV) — la moitié PURE.
//
// Du texte vers des talks GROUPÉS : un même titre donné à N conférences devient
// UN talk à N occurrences, parce que c'est le modèle du site (speaker_talks =
// identité, talk_occurrences = chaque fois où il est donné). C'est le cas réel
// de l'export Notist qui a motivé la fonctionnalité : « Understanding
// Kubernetes in a visual way » y figure une dizaine de fois.
//
// Tolérance : entrée par entrée (une ligne bancale est SAUTÉE et comptée,
// jamais fatale au lot — modèle `mapSessionizeEvent`) ; le LOT n'échoue que
// pour une cause globale (format inconnu, fichier trop grand), avec une erreur
// dite en clair. Aucune base ni réseau ici : la moitié DB vit dans l'action
// (`src/app/mon-espace/talks/importer/actions.ts`).

import { buildTalkDate, dateLegueeParEdition, MOIS_FR } from "@/lib/talk-date";
import { isHttpUrl } from "@/lib/cfp-import";
import { idEvenementNotist } from "@/lib/notist-evenements";
import { TITRE_MAX, DESCRIPTION_MAX } from "@/lib/talk-limits";
import { slugify } from "@/lib/slug";
import { buildEditionLibelle } from "@/lib/conferences";

/** Une fois où le talk a été donné, telle que lue dans le fichier. */
export interface OccurrenceImportee {
  conference: string | null;
  /** Format talk-date à précision variable : « 2026 », « 2026-07 », « 2026-07-12 ». */
  date: string | null;
  ville: string | null;
  pays: string | null;
  lien: string | null;
  /** Id d'événement Notist (links.event, hôte noti.st SEUL) : la fiche de
   *  l'événement porte le nom de la conférence que ce fichier tait. */
  evenementNotist: string | null;
}

/** Un talk groupé, prêt pour la prévisualisation puis l'écriture. */
export interface TalkImporte {
  titre: string;
  description: string | null;
  occurrences: OccurrenceImportee[];
}

export type ImportParse =
  | { ok: true; talks: TalkImporte[]; ignorees: number }
  | { ok: false; erreur: string };

/** Plafond d'entrées d'un lot : protège l'écran de prévisualisation et la base. */
export const IMPORT_MAX_ENTREES = 300;

/** Plafond de taille du texte soumis (≈ 400 Ko, large pour ~300 talks). */
export const IMPORT_MAX_TAILLE = 400_000;

/** Plafond de conférences hors répertoire PROPOSÉES par lot : l'import écrit
 *  dans la file de modération orga, qui reste bornée lot par lot. Dimensionné
 *  sur le fichier réel qui a motivé le chantier (154 conférences distinctes
 *  sur dix ans) avec de la marge, sous la borne d'entrées du fichier (300) :
 *  un portfolio entier passe en UN lot — à 20, il en fallait 8, étalés sur
 *  3 h par le quota de confirmation. L'arbitrage anti-abus (600/h au pire via
 *  les 3 imports/h) est consigné au registre de la dette. */
export const IMPORT_MAX_PROPOSITIONS = 200;

// ─── Lecture d'une entrée (JSON ou ligne CSV), clés FR et EN ───

/** Alias acceptés par champ : les exports nomment chacun à sa façon. */
const CLES = {
  titre: ["titre", "title", "name", "nom"],
  description: ["description", "abstract", "resume", "résumé", "summary"],
  conference: ["conference", "conférence", "event", "event_name", "evenement", "événement"],
  date: ["date", "presented-on", "presented_on", "presented at", "starts_on", "quand"],
  annee: ["annee", "année", "year"],
  ville: ["ville", "city", "lieu", "location"],
  pays: ["pays", "country"],
  lien: ["lien", "url", "link", "event_url", "lien_conf"],
} satisfies Record<string, readonly string[]>;

function lireChamp(entree: Record<string, unknown>, aliases: readonly string[]): string | null {
  for (const [cle, valeur] of Object.entries(entree)) {
    if (!aliases.includes(cle.toLowerCase())) continue;
    if (typeof valeur === "string" && valeur.trim() !== "") return valeur.trim();
    if (typeof valeur === "number" && Number.isFinite(valeur)) return String(valeur);
  }
  return null;
}

/** Candidat à plat (avant groupage), ou null si l'entrée est irrecevable. */
interface Candidat {
  titre: string;
  description: string | null;
  occurrence: OccurrenceImportee | null;
}

function versCandidat(brut: unknown): Candidat | null {
  if (brut == null || typeof brut !== "object" || Array.isArray(brut)) return null;
  let entree = brut as Record<string, unknown>;
  // Style JSON:API (export Notist) : les champs vivent sous `attributes` et le
  // lien vers la fiche de l'événement sous `links.event`.
  const liensBruts = (brut as { links?: unknown }).links;
  const evenementNotist =
    liensBruts != null && typeof liensBruts === "object"
      ? idEvenementNotist((liensBruts as Record<string, unknown>).event)
      : null;
  if (entree.attributes != null && typeof entree.attributes === "object") {
    entree = entree.attributes as Record<string, unknown>;
  }

  const titre = lireChamp(entree, CLES.titre);
  if (titre == null || titre.length < 1 || titre.length > TITRE_MAX) return null;

  const description = lireChamp(entree, CLES.description)?.slice(0, DESCRIPTION_MAX) ?? null;
  const conference = lireChamp(entree, CLES.conference)?.slice(0, 160) ?? null;
  const date =
    parseDateLibre(lireChamp(entree, CLES.date) ?? "") ??
    parseDateLibre(lireChamp(entree, CLES.annee) ?? "");
  const ville = lireChamp(entree, CLES.ville)?.slice(0, 120) ?? null;
  const pays = lireChamp(entree, CLES.pays)?.slice(0, 120) ?? null;
  const lienBrut = lireChamp(entree, CLES.lien);
  const lien = isHttpUrl(lienBrut) ? lienBrut : null;

  // Rien à rattacher = un sujet proposé : l'occurrence n'existe pas.
  const occurrence =
    conference == null && date == null && ville == null && lien == null && evenementNotist == null
      ? null
      : { conference, date, ville, pays, lien, evenementNotist };
  return { titre, description, occurrence };
}

// ─── Groupage : un titre = un talk ───

/** Clé de groupage d'un titre : casse et espaces multiples ignorés. */
function cleTitre(titre: string): string {
  return titre.toLowerCase().replace(/\s+/g, " ").trim();
}

function grouper(candidats: Candidat[]): TalkImporte[] {
  const parTitre = new Map<string, TalkImporte>();
  const ordre: string[] = [];
  for (const c of candidats) {
    const cle = cleTitre(c.titre);
    let talk = parTitre.get(cle);
    if (!talk) {
      talk = { titre: c.titre, description: c.description, occurrences: [] };
      parTitre.set(cle, talk);
      ordre.push(cle);
    }
    // La première description non vide gagne (les suivantes répètent la même).
    if (talk.description == null && c.description != null) {
      talk.description = c.description;
    }
    if (c.occurrence) talk.occurrences.push(c.occurrence);
  }
  return ordre.map((cle) => parTitre.get(cle)!);
}

// ─── JSON ───

/**
 * Une ressource JSON:API qui en NICHE d'autres cède la place à son nid.
 *
 * L'export Notist d'un profil (le fichier réel d'Aurélie Vache) est ainsi :
 * la racine `data` porte l'AUTRICE, et ses 178 présentations vivent dans
 * `relationships.data`. Sans ce dépliage, on lisait le `name` de l'autrice
 * comme un titre et on importait UN talk « Aurélie » — sans la moindre
 * erreur, ce qui est pire qu'un refus.
 */
function deplierRessources(liste: unknown[]): unknown[] {
  // PAR élément : celui qui niche cède la place à son nid, les AUTRES restent.
  // La version « tout ou rien » jetait le premier niveau entier d'un fichier
  // mixte dès qu'UN élément nichait — talks perdus en silence (finding 16/08).
  return liste.flatMap((e) => {
    if (e == null || typeof e !== "object") return [e];
    const rel = (e as Record<string, unknown>).relationships;
    if (rel == null || typeof rel !== "object") return [e];
    const dedans = (rel as Record<string, unknown>).data;
    // Un tableau niché — MÊME VIDE — remplace son porteur : une autrice sans
    // présentation doit disparaître, jamais devenir un talk à son prénom.
    return Array.isArray(dedans) ? dedans : [e];
  });
}

/** Déplie les enveloppes connues ({ data: [...] }, { presentations: [...] }). */
function versListe(json: unknown): unknown[] | null {
  if (Array.isArray(json)) return deplierRessources(json);
  if (json != null && typeof json === "object") {
    for (const cle of ["data", "presentations", "talks", "items"]) {
      const v = (json as Record<string, unknown>)[cle];
      if (Array.isArray(v)) return deplierRessources(v);
    }
  }
  return null;
}

function parseJson(texte: string): ImportParse | null {
  let json: unknown;
  try {
    json = JSON.parse(texte);
  } catch {
    return null; // pas du JSON : on tentera le CSV
  }
  const liste = versListe(json);
  if (liste == null) {
    return {
      ok: false,
      erreur:
        "Ce JSON a une forme inattendue : une liste de talks est attendue (ou un objet avec une clé data / presentations).",
    };
  }
  if (liste.length > IMPORT_MAX_ENTREES) {
    return {
      ok: false,
      erreur: `Ce fichier dépasse ${IMPORT_MAX_ENTREES} entrées : découpe-le et importe en plusieurs fois.`,
    };
  }
  const candidats: Candidat[] = [];
  let ignorees = 0;
  for (const brut of liste) {
    const c = versCandidat(brut);
    if (c) candidats.push(c);
    else ignorees++;
  }
  if (candidats.length === 0) {
    return {
      ok: false,
      erreur: "Aucun talk lisible dans ce fichier : chaque entrée a besoin d'un titre.",
    };
  }
  return { ok: true, talks: grouper(candidats), ignorees };
}

// ─── CSV (RFC 4180, séparateur virgule ou point-virgule) ───

/** Découpe un CSV en lignes de champs, guillemets respectés (virgules et
 *  retours à la ligne INTERNES préservés). */
function lignesCsv(texte: string, sep: string): string[][] {
  const lignes: string[][] = [];
  let champ = "";
  let ligne: string[] = [];
  let dansGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (dansGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') {
          champ += '"';
          i++;
        } else {
          dansGuillemets = false;
        }
      } else {
        champ += c;
      }
    } else if (c === '"' && champ.trim() === "") {
      // RFC 4180 : les guillemets n'ouvrent qu'en DÉBUT de champ (espaces de
      // tête tolérés : « titre, "a, b" » se lit comme avant). Ailleurs
      // (« Écran 5\" pouces »), c'est un caractère comme un autre — sinon un
      // guillemet isolé avalait tout le reste du fichier (finding 16/08).
      dansGuillemets = true;
    } else if (c === sep) {
      ligne.push(champ);
      champ = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(champ);
      champ = "";
      if (ligne.some((v) => v.trim() !== "")) lignes.push(ligne);
      ligne = [];
    } else {
      champ += c;
    }
  }
  ligne.push(champ);
  if (ligne.some((v) => v.trim() !== "")) lignes.push(ligne);
  return lignes;
}

function parseCsv(texte: string): ImportParse {
  // Séparateur déduit de l'en-tête : celui qui découpe le plus de colonnes.
  const entete = texte.split(/\r?\n/, 1)[0] ?? "";
  const sep =
    (entete.match(/;/g)?.length ?? 0) > (entete.match(/,/g)?.length ?? 0) ? ";" : ",";
  const lignes = lignesCsv(texte, sep);
  if (lignes.length < 2) {
    return {
      ok: false,
      erreur:
        "Ce fichier ressemble à un CSV sans données : une ligne d'en-têtes puis une ligne par talk sont attendues.",
    };
  }
  const entetes = lignes[0].map((h) => h.trim().toLowerCase());
  if (!entetes.some((h) => CLES.titre.includes(h))) {
    return {
      ok: false,
      erreur: "Colonne du titre introuvable : nomme-la « titre » (ou title).",
    };
  }
  if (lignes.length - 1 > IMPORT_MAX_ENTREES) {
    return {
      ok: false,
      erreur: `Ce fichier dépasse ${IMPORT_MAX_ENTREES} entrées : découpe-le et importe en plusieurs fois.`,
    };
  }
  const candidats: Candidat[] = [];
  let ignorees = 0;
  for (const valeurs of lignes.slice(1)) {
    const entree: Record<string, unknown> = {};
    entetes.forEach((h, i) => {
      entree[h] = valeurs[i] ?? "";
    });
    const c = versCandidat(entree);
    if (c) candidats.push(c);
    else ignorees++;
  }
  if (candidats.length === 0) {
    return {
      ok: false,
      erreur: "Aucun talk lisible dans ce fichier : chaque ligne a besoin d'un titre.",
    };
  }
  return { ok: true, talks: grouper(candidats), ignorees };
}

// ─── Point d'entrée ───

/** Parse un texte collé ou téléversé (JSON d'abord, CSV sinon). */
export function parseImport(texte: string): ImportParse {
  const t = texte.trim();
  if (t === "") {
    return { ok: false, erreur: "Le fichier est vide : colle ton export JSON ou CSV." };
  }
  if (t.length > IMPORT_MAX_TAILLE) {
    return {
      ok: false,
      erreur: "Ce fichier est trop grand : découpe-le et importe en plusieurs fois.",
    };
  }
  const json = parseJson(t);
  if (json) return json;
  // Repli CSV inconditionnel : un CSV à UNE colonne (juste « titre ») est
  // valide — le trier sur la présence d'un séparateur le rejetait à tort, et
  // les erreurs du parseur CSV disent mieux ce qui manque qu'un « format
  // irreconnaissable ».
  return parseCsv(t);
}

// ─── Dates en texte libre ───

const MOIS_EN = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;

/** Numéro de mois (1-12) depuis un nom FR/EN, abrégé accepté ; null sinon. */
function moisDepuisNom(nom: string): number | null {
  const bas = nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  for (const table of [MOIS_FR, MOIS_EN]) {
    const i = table.findIndex((m) => {
      const plein = m.normalize("NFD").replace(/[̀-ͯ]/g, "");
      return plein === bas || (bas.length >= 3 && plein.startsWith(bas));
    });
    if (i >= 0) return i + 1;
  }
  return null;
}

/**
 * Date en texte libre → format talk-date (précision variable), ou null.
 * Couvre les formes des exports : ISO (2025-10-06, 2025-10), année seule,
 * « July 2026 » / « juillet 2026 », « 12/07/2026 » (JJ/MM/AAAA),
 * « 06 Oct 2025 », « October 6, 2025 ». Les bornes (1900-2100, mois 1-12,
 * jour 1-31) restent celles du site : `buildTalkDate` tranche.
 *
 * L'HORAIRE est coupé d'abord : Notist date ses présentations à la seconde
 * (« 2026-07-09 14:00:00 »), le site stocke un jour. Sans cette coupe, tout
 * l'export réel d'Aurélie Vache arrivait sans aucune date.
 */
export function parseDateLibre(brut: string): string | null {
  const t = brut.trim().replace(/[T ]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/, "");
  if (t === "") return null;

  const construire = (a: string, m = "", j = ""): string | null => {
    const r = buildTalkDate(a, m, j);
    return r.ok ? r.value : null;
  };

  let m = t.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/);
  if (m) return construire(m[1], m[2] ?? "", m[3] ?? "");

  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // JJ/MM/AAAA
  if (m) return construire(m[3], m[2], m[1]);

  m = t.match(/^(\d{1,2})\s+([\p{L}.]+)\s+(\d{4})$/u); // 06 Oct 2025
  if (m) {
    const mois = moisDepuisNom(m[2].replace(/\.$/, ""));
    if (mois) return construire(m[3], String(mois), m[1]);
  }

  m = t.match(/^([\p{L}.]+)\s+(\d{1,2}),\s*(\d{4})$/u); // October 6, 2025
  if (m) {
    const mois = moisDepuisNom(m[1].replace(/\.$/, ""));
    if (mois) return construire(m[3], String(mois), m[2]);
  }

  m = t.match(/^([\p{L}.]+)\s+(\d{4})$/u); // juillet 2026 / July 2026
  if (m) {
    const mois = moisDepuisNom(m[1].replace(/\.$/, ""));
    if (mois) return construire(m[2], String(mois));
  }

  return null;
}

// ─── Le plan d'import : quelle écriture pour chaque talk, décidée AVANT ───

/** Le répertoire, réduit à ce que le rapprochement consomme. */
export type RegistreIndex = Array<{
  id: number;
  nom: string;
  slug: string;
  editions: Array<{
    id: number;
    annee: number | null;
    dateDebut: string | null;
    dateFin: string | null;
  }>;
}>;

/** Les talks déjà sur la fiche, réduits à ce que le dédoublonnage consomme. */
export type TalkExistant = {
  id: number;
  titre: string;
  occurrences: Array<{ conference: string | null; date: string | null }>;
};

export type PlanOccurrence = OccurrenceImportee & {
  /**
   * - `registre` : conférence connue, l'occurrence sera rattachée ;
   * - `proposition` : conférence inconnue, elle part en proposition (066/068) et
   *   la saisie attend l'arbitrage ;
   * - `doublon` : déjà sur ce talk (même conférence, même année) — rien à écrire ;
   * - `ignoree` : sans conférence, inutilisable (le site exige une conférence).
   */
  action: "registre" | "proposition" | "doublon" | "ignoree";
  conferenceId: number | null;
  editionId: number | null;
  /** Libellé SNAPSHOT à écrire (recomposé du répertoire quand rattachée). */
  libelle: string | null;
  /** Nom à proposer (année retirée) quand `action === "proposition"`. */
  nomPropose: string | null;
  /** Année de l'événement (extraite de la date, sinon du nom). */
  annee: number | null;
};

export type PlanTalk = {
  titre: string;
  description: string | null;
  /** Talk de la fiche portant déjà ce titre, à compléter au lieu de doubler. */
  talkIdExistant: number | null;
  /**
   * - `nouveau` : le talk sera créé ;
   * - `complement` : il existe, des occurrences s'y ajoutent ;
   * - `inchange` : il existe et tout est déjà dessus — rien à écrire.
   */
  statut: "nouveau" | "complement" | "inchange";
  occurrences: PlanOccurrence[];
};

/** Clé de comparaison d'un titre (casse et espaces ignorés) — celle du groupage. */
export function titreNormalise(titre: string): string {
  return cleTitre(titre);
}

/** « Devoxx Belgium 2025 » → nom sans l'année + année ; année absente → null. */
function extraireAnnee(nom: string): { nom: string; annee: number | null } {
  const m = nom.match(/^(.*\S)\s+((?:19|20)\d{2})$/);
  return m ? { nom: m[1], annee: Number(m[2]) } : { nom, annee: null };
}

/** Clé de dédoublonnage d'une occurrence : (conférence sans année, année). */
function cleOccurrence(conference: string | null, date: string | null): string {
  const { nom, annee } = extraireAnnee((conference ?? "").trim());
  const an = date?.slice(0, 4) ?? (annee != null ? String(annee) : "");
  return `${slugify(nom)}|${an}`;
}

/**
 * Construit le plan : rapprochement au répertoire + dédoublonnage contre la
 * fiche. PURE (répertoire et existants en entrée) : c'est la même vérité que
 * la prévisualisation affiche et que la confirmation exécute.
 */
export function construirePlan(
  talks: TalkImporte[],
  registre: RegistreIndex,
  existants: TalkExistant[],
): PlanTalk[] {
  const parSlug = new Map(registre.map((c) => [c.slug, c]));
  const existantParTitre = new Map(existants.map((t) => [titreNormalise(t.titre), t]));

  return talks.map((talk) => {
    const existant = existantParTitre.get(titreNormalise(talk.titre)) ?? null;
    const dejaLa = new Set(
      existant?.occurrences.map((o) => cleOccurrence(o.conference, o.date)) ?? [],
    );

    const occurrences: PlanOccurrence[] = talk.occurrences.map((o) => {
      const vide: PlanOccurrence = {
        ...o,
        action: "ignoree",
        conferenceId: null,
        editionId: null,
        libelle: null,
        nomPropose: null,
        annee: null,
      };
      if (o.conference == null) return vide;

      const { nom, annee: anneeDuNom } = extraireAnnee(o.conference.trim());
      // Un nom qui ne peut PAS devenir une conférence (slug vide, trop court) :
      // écarté dès le plan, visible en prévisualisation — mêmes bornes que le
      // formulaire (`nomConfField`), sinon l'import contournait la validation.
      if (nom.length < 2 || slugify(nom).length === 0) return vide;
      const annee = o.date != null ? Number(o.date.slice(0, 4)) : anneeDuNom;
      // L'année du nom sert de date de repli : « Devoxx Belgium 2025 » sans
      // date dit quand même l'année.
      const date = o.date ?? (anneeDuNom != null ? String(anneeDuNom) : null);

      // Déjà sur la fiche, OU déjà plus haut dans CE fichier (les exports
      // répètent volontiers la même ligne) : une seule écriture.
      if (dejaLa.has(cleOccurrence(o.conference, date))) {
        return { ...vide, date, action: "doublon", annee };
      }
      dejaLa.add(cleOccurrence(o.conference, date));

      const conf = parSlug.get(slugify(nom));
      if (conf) {
        const edition = conf.editions.find((e) => e.annee != null && e.annee === annee);
        // Même héritage que la saisie manuelle (resolveOccurrenceLink), règle
        // partagée : le jour exact si l'édition tient sur un jour, le mois si
        // elle en couvre plusieurs — sinon le même talk affichait deux
        // précisions selon la porte d'entrée.
        const dateHeritee = edition
          ? dateLegueeParEdition(edition.dateDebut, edition.dateFin, date)
          : date;
        return {
          ...vide,
          date: dateHeritee,
          action: "registre",
          conferenceId: conf.id,
          editionId: edition?.id ?? null,
          libelle: buildEditionLibelle({
            confNom: conf.nom,
            type: "edition",
            nom: null,
            annee: edition ? annee : null,
            dateDebut: null,
          }),
          annee,
        };
      }
      return { ...vide, date, action: "proposition", nomPropose: nom, annee };
    });

    const aEcrire = occurrences.some(
      (o) => o.action === "registre" || o.action === "proposition",
    );
    return {
      titre: talk.titre,
      description: talk.description,
      talkIdExistant: existant?.id ?? null,
      statut: existant == null ? "nouveau" : aEcrire ? "complement" : "inchange",
      occurrences,
    };
  });
}
