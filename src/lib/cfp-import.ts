// Moissonneur CFP — client Sessionize + mapping + matching.
// Voir docs/faisabilite-import-talks.md (scénario F) : on consomme uniquement
// les endpoints JSON PUBLICS que les organisateurs créent pour leur embed
// (jamais de HTML, jamais de scraping). Conference Hall viendra ensuite.

// Limites de talk-form.ts : un talk importé doit rester éditable tel quel.
import { TITRE_MAX, DESCRIPTION_MAX } from "@/lib/talk-limits";
import { isoToTalkDate } from "@/lib/talk-date";

/** Un endpoint qui ne répond pas ne doit pas bloquer le lot du cron. */
const FETCH_TIMEOUT_MS = 10_000;
/** Garde-fou contre un JSON anormalement gros (endpoint hostile ou cassé). */
const MAX_RESPONSE_BYTES = 10_000_000;

/** Seuls http(s) sont acceptés pour un lien affiché (jamais javascript: …). */
export function isHttpUrl(url: string | null | undefined): url is string {
  return url != null && /^https?:\/\//i.test(url);
}

interface SessionizeSpeaker {
  id: string;
  fullName: string;
  links?: { url: string }[];
}

interface SessionizeSession {
  id: string | number;
  title: string;
  description?: string | null;
  startsAt?: string | null;
  // `/view/All` liste les speakers par ID (string) ; `/view/Sessions` les
  // imbrique en objets `{ id, name }`. On tolère les deux (cf. mapSessionizeEvent).
  speakers?: (string | { id: string | number; name?: string })[];
}

/** Forme (partielle) du JSON `…/view/All` d'un endpoint public Sessionize. */
export interface SessionizeEventData {
  sessions: SessionizeSession[];
  speakers: SessionizeSpeaker[];
}

/** Un talk candidat = une session × un speaker (co-speakers → un candidat chacun). */
export interface TalkCandidate {
  externalId: string;
  titre: string;
  description: string | null;
  /** Format talk-date (YYYY-MM-DD), ou null si l'événement ne date pas la session. */
  date: string | null;
  speaker: { fullName: string; links: string[] };
}

/** Récupère UNE vue JSON d'un endpoint public Sessionize (timeout + garde taille). */
async function fetchSessionizeView(
  endpointId: string,
  view: string,
): Promise<unknown> {
  const res = await fetch(
    `https://sessionize.com/api/v2/${encodeURIComponent(endpointId)}/view/${view}`,
    { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
  );
  if (!res.ok) {
    throw new Error(`Sessionize ${endpointId} (${view}) : HTTP ${res.status}`);
  }
  const length = Number(res.headers.get("content-length"));
  if (length > MAX_RESPONSE_BYTES) {
    throw new Error(
      `Sessionize ${endpointId} (${view}) : réponse trop grosse (${length} octets)`,
    );
  }
  return res.json();
}

/**
 * Aplati la vue `/view/Sessions` (tableau de GROUPES `{ groupName, sessions }`)
 * en liste plate de sessions. Tolère aussi un tableau déjà plat de sessions.
 */
function flattenSessionGroups(raw: unknown): SessionizeSession[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((el) => {
    if (el && Array.isArray((el as { sessions?: unknown }).sessions)) {
      return (el as { sessions: SessionizeSession[] }).sessions;
    }
    if (el && typeof (el as { title?: unknown }).title === "string") {
      return [el as SessionizeSession];
    }
    return [];
  });
}

/**
 * Récupère un événement public Sessionize. La vue `All` (une seule requête)
 * est préférée, mais beaucoup d'orgas ne l'ouvrent pas (404) tout en ouvrant
 * `Sessions` + `Speakers` : on recompose alors la même forme. Si le repli
 * échoue aussi, on relance l'erreur de `All` (message le plus parlant).
 */
export async function fetchSessionizeEvent(
  endpointId: string,
): Promise<SessionizeEventData> {
  try {
    return (await fetchSessionizeView(endpointId, "All")) as SessionizeEventData;
  } catch (errAll) {
    try {
      const [sessionsRaw, speakersRaw] = await Promise.all([
        fetchSessionizeView(endpointId, "Sessions"),
        fetchSessionizeView(endpointId, "Speakers"),
      ]);
      return {
        sessions: flattenSessionGroups(sessionsRaw),
        speakers: Array.isArray(speakersRaw)
          ? (speakersRaw as SessionizeSpeaker[])
          : [],
      };
    } catch {
      throw errAll;
    }
  }
}

export function mapSessionizeEvent(data: SessionizeEventData): TalkCandidate[] {
  // Entrée EXTERNE non maîtrisée : un champ absent ou mal formé ne doit jamais
  // faire échouer tout l'événement — on saute la donnée bancale, c'est tout.
  const speakersById = new Map(
    (data.speakers ?? [])
      .filter((s) => s?.id != null)
      .map((s) => [String(s.id), s]),
  );
  const candidats: TalkCandidate[] = [];

  for (const session of data.sessions ?? []) {
    if (session?.id == null || typeof session.title !== "string") continue;
    for (const ref of session.speakers ?? []) {
      // Un speaker de session est soit un ID (`/view/All`), soit un objet
      // `{ id, name }` (`/view/Sessions`) : on ramène tout à l'ID.
      const rawId = typeof ref === "object" ? ref?.id : ref;
      if (rawId == null) continue;
      const speaker = speakersById.get(String(rawId));
      if (!speaker || typeof speaker.fullName !== "string") continue;
      candidats.push({
        externalId: String(session.id),
        titre: session.title.slice(0, TITRE_MAX),
        description: session.description?.slice(0, DESCRIPTION_MAX) ?? null,
        date: isoToTalkDate(session.startsAt),
        speaker: {
          fullName: speaker.fullName,
          links: (speaker.links ?? [])
            .map((l) => l?.url)
            .filter((u): u is string => typeof u === "string"),
        },
      });
    }
  }
  return candidats;
}

// ─── Matching speaker → profil TSH ───

/** Sous-ensemble du profil nécessaire au matching (jamais d'e-mail ici). */
export interface MatchableProfile {
  id: number;
  name: string | null;
  linkedin: string | null;
  sessionizeUrl: string | null;
}

/**
 * fort : lien vérifiable (LinkedIn du profil, ou lien Sessionize déclaré).
 * faible : simple égalité de nom normalisé → toujours une suggestion, jamais
 * un ajout automatique (voir l'étude, consentement).
 */
export type SpeakerMatch = { profileId: number; strength: "fort" | "faible" };

/** Compare des URLs en ignorant protocole, www., casse, query/fragment et slash. */
function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "") // ?originalSubdomain=fr, #section… ne comptent pas
    .replace(/\/+$/, "");
}

/** Compare des noms en ignorant accents, casse et espaces multiples. */
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Index de matching construit UNE fois par run (les profils sont identiques
 * pour tous les candidats). Évite de re-normaliser chaque profil à chaque
 * comparaison. Un nom porté par plusieurs profils est marqué ambigu → jamais
 * de match faible dessus.
 */
export interface ProfileIndex {
  byUrl: Map<string, number>;
  byName: Map<string, number | null>; // null = homonymes (ambigu)
}

export function buildProfileIndex(profiles: MatchableProfile[]): ProfileIndex {
  const byUrl = new Map<string, number>();
  const byName = new Map<string, number | null>();
  for (const p of profiles) {
    for (const lien of [p.linkedin, p.sessionizeUrl]) {
      if (lien != null) byUrl.set(normalizeUrl(lien), p.id);
    }
    if (p.name != null) {
      const nom = normalizeName(p.name);
      if (nom !== "") {
        byName.set(nom, byName.has(nom) ? null : p.id);
      }
    }
  }
  return { byUrl, byName };
}

export function matchSpeakerToProfile(
  speaker: { fullName: string; links: string[] },
  index: ProfileIndex,
): SpeakerMatch | null {
  for (const link of speaker.links) {
    const id = index.byUrl.get(normalizeUrl(link));
    if (id != null) return { profileId: id, strength: "fort" };
  }

  // Nom : uniquement si UNE SEULE speakeuse porte ce nom (sinon ambigu → null,
  // on ne propose jamais le talk d'une homonyme à la première venue).
  const nom = normalizeName(speaker.fullName);
  const id = nom !== "" ? index.byName.get(nom) : undefined;
  if (id != null) return { profileId: id, strength: "faible" };
  return null;
}
