import { isoToTalkDate } from "@/lib/talk-date";
import { BASE_URL } from "@/constants/site";

/**
 * Mémoire COURTE des fiches résolues (par instance serveur, TTL 10 min) :
 * la confirmation retrouve les fiches de la prévisualisation sans re-consulter
 * noti.st. Honnêteté du contrat : seuls les SUCCÈS sont mémorisés — une fiche
 * en échec à la prévisualisation peut répondre à la confirmation (le plan y
 * gagne une conférence de plus, jamais moins). Rien en base : l'annuaire
 * reste LA mémoire durable (décision du 16/08).
 */
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 500;
const cache = new Map<string, { fiche: EvenementNotist; expire: number }>();

/** Vide la mémoire courte (tests). */
export function viderCacheNotist(): void {
  cache.clear();
}

/**
 * Résolution des fiches d'événements Notist pendant un import de talks.
 *
 * L'export d'un profil Notist ne NOMME pas les conférences : chaque
 * présentation pointe une fiche `https://noti.st/events/<id>.json` qui porte
 * le titre de l'événement, son lieu et sa fenêtre de dates (API publique,
 * vérifiée joignable par l'éclaireur du 16/08 : 200 en ~1,5 s). Sans cette
 * résolution, 178 scènes du fichier réel d'Aurélie Vache arrivaient sans
 * conférence — et son parcours retombait sur 178 rattachements à la main.
 *
 * Contrat de sûreté :
 * - hôte FIGÉ `noti.st`, id borné `[A-Za-z0-9]{4,12}` : rien d'autre n'est
 *   jamais consulté (zéro SSRF, l'appelant ne choisit pas l'URL) ;
 * - chaque id est consulté UNE fois par lot (178 scènes → 154 événements),
 *   concurrence bornée, timeout par fiche ;
 * - une fiche qui échoue est simplement ABSENTE du résultat : la scène reste
 *   « date seule », comme avant le chantier — jamais un import en échec ;
 * - plafond dur d'événements par lot, aligné sur la borne d'entrées du
 *   fichier : personne ne fait déclencher des milliers d'appels sortants.
 *
 * L'annuaire reste LA mémoire (décision du 16/08) : rien n'est stocké ici,
 * les titres résolus entrent dans le plan d'import ordinaire (rattachés ou
 * proposés, puis validés dans l'annuaire pour toutes les suivantes).
 */

export interface EvenementNotist {
  titre: string;
  ville: string | null;
  pays: string | null;
  dateDebut: string | null;
  dateFin: string | null;
}

/* Plafond d'événements distincts consultés par lot d'import — plus SERRÉ que
 *  la borne d'entrées du fichier (300) : au-delà, les scènes restantes suivent
 *  la voie « date seule » et sont COMPTÉES au récapitulatif
 *  (scenesSansConference), jamais perdues en silence. */
const NOTIST_MAX_EVENEMENTS = 200;

/** Budget de temps du LOT entier : l'action tourne sous maxDuration=60 s —
 *  passé ce budget, les fiches restantes suivent la voie « date seule »
 *  plutôt que de faire tuer l'import en plein vol par Vercel. */
const BUDGET_LOT_MS = 30_000;

/** Fiches consultées en parallèle (politesse envers noti.st, et maxDuration). */
const CONCURRENCE = 12; // 154 fiches à ~1,5 s : ~20 s, marge nette sous le budget

const TIMEOUT_MS = 8_000;

const ID_VALIDE = /^[A-Za-z0-9]{4,12}$/;

/**
 * L'id d'un lien d'événement Notist, ou null pour tout autre hôte. LE contrat
 * de ce qu'on accepte de consulter vit ICI, en un seul endroit : le parseur
 * d'import s'en sert pour extraire, le résolveur pour re-valider — deux bornes
 * qui divergent feraient retomber toutes les fiches en « date seule » sans une
 * erreur.
 */
export function idEvenementNotist(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const m = brut.match(/^https:\/\/noti\.st\/events\/([A-Za-z0-9]+)\.json$/);
  // La borne de forme vit dans ID_VALIDE seul : deux littéraux divergents
  // feraient retomber toutes les fiches en « date seule » sans une erreur.
  return m && ID_VALIDE.test(m[1]) ? m[1] : null;
}

/** « Berlin, Germany » → « Berlin » (la partie pays vient du code région). */
function villeDepuisAdresse(adresse: unknown): string | null {
  if (typeof adresse !== "string") return null;
  const ville = adresse.split(",")[0].trim();
  return ville === "" ? null : ville.slice(0, 120);
}

// Construit UNE fois : le constructeur ICU est coûteux et les arguments sont
// des constantes (jusqu'à 200 appels par lot sinon).
let nomsPays: Intl.DisplayNames | null | undefined;

/** « DE » → « Allemagne » : le site s'écrit en français. */
function paysDepuisCode(code: unknown): string | null {
  if (typeof code !== "string" || !/^[A-Za-z]{2}$/.test(code)) return null;
  if (nomsPays === undefined) {
    try {
      nomsPays = new Intl.DisplayNames(["fr"], { type: "region" });
    } catch {
      nomsPays = null;
    }
  }
  try {
    const nom = nomsPays?.of(code.toUpperCase());
    return nom && nom !== code.toUpperCase() ? nom : null;
  } catch {
    return null;
  }
}

async function lireFiche(id: string): Promise<EvenementNotist | null> {
  try {
    const reponse = await fetch(`https://noti.st/events/${id}.json`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Accept: "application/json",
        "User-Agent": `TechSpeakHer/1.0 (+${BASE_URL}; import consenti)`,
      },
      cache: "no-store",
    });
    if (!reponse.ok) return null;
    // L'éclaireur du 16/08 a montré `data` en TABLEAU ; le JSON:API canonique
    // permet aussi la ressource seule. On accepte les deux : la mauvaise
    // hypothèse ferait échouer TOUTES les fiches sans une seule erreur.
    const json = (await reponse.json()) as { data?: unknown };
    const d = json.data;
    const ressource = (Array.isArray(d) ? d[0] : d) as
      | { attributes?: Record<string, unknown> }
      | undefined;
    const attrs = ressource?.attributes;
    const titre = typeof attrs?.title === "string" ? attrs.title.trim().slice(0, 160) : "";
    if (titre === "") return null;
    // isoToTalkDate lit le préfixe AAAA-MM-JJ : l'horaire Notist suit, sans gêner.
    const jour = (v: unknown) => (typeof v === "string" ? isoToTalkDate(v) : null);
    return {
      titre,
      ville: villeDepuisAdresse(attrs?.address),
      pays: paysDepuisCode(attrs?.country_code),
      dateDebut: jour(attrs?.starts_on),
      dateFin: jour(attrs?.ends_on),
    };
  } catch {
    return null; // timeout, réseau, JSON invalide : la fiche est juste absente
  }
}

/**
 * Résout un lot d'ids d'événements (dédupliqués, bornés) vers leurs fiches.
 * Le résultat ne contient QUE les fiches obtenues : l'appelant retombe en
 * « date seule » pour les autres.
 */
export async function resoudreEvenementsNotist(
  ids: Iterable<string>,
  budgetMs = BUDGET_LOT_MS,
  /** Consulté SEULEMENT si le réseau est nécessaire (cache incomplet) : une
   *  confirmation entièrement servie par la mémoire courte ne consomme aucun
   *  jeton — et ne peut donc pas diverger du plan montré. */
  reseauAutorise: () => boolean = () => true,
): Promise<Map<string, EvenementNotist>> {
  const uniques = [...new Set(ids)].filter((id) => ID_VALIDE.test(id)).slice(0, NOTIST_MAX_EVENEMENTS);
  const resultat = new Map<string, EvenementNotist>();
  const echeance = Date.now() + budgetMs;

  // La mémoire courte d'abord : la confirmation retrouve les fiches de la
  // prévisualisation sans re-consulter noti.st (et sans diverger d'elle).
  const aChercher: string[] = [];
  for (const id of uniques) {
    const connue = cache.get(id);
    if (connue && connue.expire > Date.now()) {
      resultat.set(id, connue.fiche);
    } else {
      cache.delete(id); // l'entrée périmée cesse de compter dans l'éviction
      aChercher.push(id);
    }
  }

  if (aChercher.length > 0 && !reseauAutorise()) return resultat;

  // File simple à N ouvriers : chaque ouvrier tire le prochain id, et le lot
  // s'arrête d'AMORCER des fiches une fois le budget passé (celles qui restent
  // suivent la voie « date seule », visible au récapitulatif).
  let curseur = 0;
  async function ouvrier() {
    while (curseur < aChercher.length && Date.now() < echeance) {
      const id = aChercher[curseur++];
      const fiche = await lireFiche(id);
      if (fiche) {
        resultat.set(id, fiche);
        // Éviction UNE entrée (ordre d'insertion) : un clear() total forçait
        // la confirmation d'un import concurrent à tout re-consulter. Le
        // delete avant set replace l'entrée re-consultée en FIN d'ordre.
        cache.delete(id);
        while (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
        cache.set(id, { fiche, expire: Date.now() + CACHE_TTL_MS });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCE, aChercher.length) }, ouvrier));
  return resultat;
}
