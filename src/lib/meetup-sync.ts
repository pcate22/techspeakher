// Sync des meetups toulousains depuis le Toulouse Tech Hub (lot 2).
// Source : https://toulouse-tech-hub.fr/events.json — flux publié par le site
// (dépôt GDGToulouse/toulouse-tech-hub, licence MIT, sync Meetup plusieurs
// fois par jour). C'est un artefact Jekyll, PAS une API contractuelle : le
// mapping est tolérant entrée par entrée (ligne bancale sautée, jamais d'échec
// du lot) et « 0 meetup parsé » compte comme une erreur visible.
//
// Format capturé (juillet 2026), événements FUTURS uniquement :
// [{ Id: "meetup-308804426", Href, Title, Start: "2025-07-23 18:30", Img,
//    Group: "Agile Toulouse", Venue, VenueAddr, HtmlDescription }]

import { isHttpUrl } from "@/lib/cfp-import";
import { upsertMeetupEdition, type MeetupCandidate } from "@/lib/conferences";

export const TECH_HUB_EVENTS_URL = "https://toulouse-tech-hub.fr/events.json";

/** Un flux qui ne répond pas ne doit pas bloquer le cron. */
const FETCH_TIMEOUT_MS = 10_000;
/** Garde-fou contre une réponse anormalement grosse. */
const MAX_RESPONSE_BYTES = 10_000_000;
/** Même limite que le champ conférence des talks (`optionalText(160)`). */
const NOM_MAX = 160;

export interface MeetupSyncResult {
  meetups: number;
  erreurs: number;
}

export async function fetchTechHubEvents(): Promise<unknown> {
  const res = await fetch(TECH_HUB_EVENTS_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Toulouse Tech Hub : HTTP ${res.status}`);
  }
  const length = Number(res.headers.get("content-length"));
  if (length > MAX_RESPONSE_BYTES) {
    throw new Error(`Toulouse Tech Hub : réponse trop grosse (${length} octets)`);
  }
  return res.json();
}

/** Extrait la date YYYY-MM-DD d'un `Start` type « 2025-07-23 18:30 ». */
function startToDate(start: unknown): string | null {
  if (typeof start !== "string") return null;
  const m = start.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

export function mapTechHubEvents(data: unknown): MeetupCandidate[] {
  // Entrée EXTERNE non maîtrisée : une entrée absente ou mal formée ne doit
  // jamais faire échouer le lot — on saute la ligne bancale, c'est tout.
  if (!Array.isArray(data)) return [];
  const candidats: MeetupCandidate[] = [];
  for (const raw of data) {
    if (raw == null || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    const meetupId = cleanText(e.Id, NOM_MAX);
    const titre = cleanText(e.Title, NOM_MAX);
    const groupe = cleanText(e.Group, NOM_MAX);
    if (meetupId == null || titre == null || groupe == null) continue;
    const href = typeof e.Href === "string" ? e.Href : null;
    candidats.push({
      meetupId,
      titre,
      groupe,
      date: startToDate(e.Start),
      lieu: cleanText(e.Venue, NOM_MAX),
      url: isHttpUrl(href) ? href : null,
    });
  }
  return candidats;
}

/**
 * Une passe de sync (appelée par le cron sync-talks, indépendamment de la
 * moisson CFP). Erreurs par meetup isolées ; un flux en panne ou un format
 * méconnaissable = 1 erreur comptée, retenté au prochain run.
 */
export async function syncTechHubMeetups(): Promise<MeetupSyncResult> {
  const result: MeetupSyncResult = { meetups: 0, erreurs: 0 };
  let candidats: MeetupCandidate[];
  try {
    candidats = mapTechHubEvents(await fetchTechHubEvents());
  } catch (err) {
    console.error("Sync meetups Tech Hub échouée", err);
    result.erreurs++;
    return result;
  }
  if (candidats.length === 0) {
    // Flux vide ou format qui a changé : visible, pas silencieux.
    console.error("Sync meetups Tech Hub : 0 meetup parsé (format changé ?)");
    result.erreurs++;
    return result;
  }
  for (const m of candidats) {
    try {
      await upsertMeetupEdition(m);
      result.meetups++;
    } catch (err) {
      result.erreurs++;
      console.error("Upsert meetup échoué", m.meetupId, err);
    }
  }
  return result;
}
