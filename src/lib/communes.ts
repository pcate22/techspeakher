// Autocomplétion de communes via la Base Adresse Nationale (BAN), service
// public gratuit et sans clé (api-adresse.data.gouv.fr). On préfère la BAN à
// l'API INSEE : pas d'authentification, et le `context` porte directement la
// région, ce qui évite un second appel pour la région de résidence.

const BAN_URL = "https://api-adresse.data.gouv.fr/search/";

export type Commune = {
  nom: string;
  codePostal: string;
  codeInsee: string;
  /** Région de résidence dérivée de la commune (≠ zones d'intervention). */
  region: string;
};

/**
 * Région = dernier segment du `context` BAN
 * (ex. « 31, Haute-Garonne, Occitanie » → « Occitanie »). Tolère l'absence.
 */
export function regionFromContext(context: unknown): string {
  if (typeof context !== "string") return "";
  const parts = context
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

type BanFeature = {
  properties?: {
    name?: unknown;
    postcode?: unknown;
    citycode?: unknown;
    context?: unknown;
  };
};

function toCommune(feature: BanFeature): Commune | null {
  const p = feature.properties ?? {};
  const nom = typeof p.name === "string" ? p.name : "";
  if (!nom) return null;
  return {
    nom,
    codePostal: typeof p.postcode === "string" ? p.postcode : "",
    codeInsee: typeof p.citycode === "string" ? p.citycode : "",
    region: regionFromContext(p.context),
  };
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  // AbortSignal.timeout : Node 17.3+/undici. Absent ailleurs → pas de timeout.
  return typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
    ? AbortSignal.timeout(ms)
    : undefined;
}

/**
 * Suggestions de communes pour une requête (type « municipality »). Résilient :
 * requête trop courte → pas d'appel ; toute erreur réseau / réponse invalide →
 * [] (l'autocomplétion dégrade en saisie libre, elle ne casse jamais le form).
 */
export async function searchCommunes(query: string, limit = 7): Promise<Commune[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${BAN_URL}?q=${encodeURIComponent(q)}&type=municipality&autocomplete=1&limit=${limit}`;
  try {
    const res = await fetch(url, { signal: timeoutSignal(4000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: unknown };
    const features = Array.isArray(data.features) ? (data.features as BanFeature[]) : [];
    const out: Commune[] = [];
    const seen = new Set<string>();
    for (const feature of features) {
      const commune = toCommune(feature);
      const key = commune?.codeInsee || commune?.nom;
      if (commune && key && !seen.has(key)) {
        seen.add(key);
        out.push(commune);
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * LA COMMUNE QU'ON RETIENT pour un nom de ville saisi à la main, ou `null`.
 *
 * Sert au rattrapage géographique des occurrences déjà enregistrées
 * (`scripts/rattraper-geographie-occurrences.mjs`), qui ÉCRIT dans les données
 * de vraies personnes. D'où une règle volontairement stricte, isolée ici pour
 * être éprouvée sans réseau.
 *
 * ON EXIGE UNE CORRESPONDANCE UNIQUE ET EXACTE sur le nom. « Saint-Denis »
 * désigne une dizaine de communes : en choisir une au hasard écrirait une
 * région fausse dans la fiche de quelqu'un. Laisser vide est le bon résultat —
 * l'occurrence reste simplement hors facette, et personne n'a menti.
 *
 * La comparaison ignore la casse et les accents (`sensitivity: "base"`) : une
 * speakeuse tape « orleans » ou « Orléans » indifféremment.
 */
export function communeRetenue(
  ville: string,
  candidates: readonly Commune[],
): Commune | null {
  const exactes = candidates.filter((c) => memeNomDeCommune(c.nom, ville));
  if (exactes.length !== 1) return null;
  const seule = exactes[0];
  // Sans code NI région, la commune ne sert à rien : autant la traiter comme
  // absente plutôt que d'écrire une moitié de géographie.
  return seule.codeInsee && seule.region ? seule : null;
}

/**
 * Deux écritures du même nom de commune ? Casse et accents ignorés
 * (`sensitivity: "base"`) : « orleans » et « Orléans » sont la même ville.
 *
 * Partagé avec le champ de saisie, qui s'en sert pour REPOSER une géographie
 * déjà enregistrée tant que la ville n'a pas changé. Reposer ce qui est en base
 * et décider d'y écrire du neuf sont deux gestes différents : le second passe
 * par `communeRetenue`, plus exigeant.
 */
export function memeNomDeCommune(a: string, b: string): boolean {
  return a.trim().localeCompare(b.trim(), "fr", { sensitivity: "base" }) === 0;
}
