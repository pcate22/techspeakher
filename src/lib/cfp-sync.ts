// Moissonneur CFP — orchestration du re-sync (appelée par le cron sync-talks).
// Pour chaque événement actif du registre : moisson de l'endpoint public,
// matching speakers → profils, puis :
//   - talk déjà confirmé (source + external_id) → rafraîchi silencieusement ;
//   - sinon → suggestion « proposee » (confirmation un-clic par la speakeuse).

import {
  fetchSessionizeEvent,
  mapSessionizeEvent,
  matchSpeakerToProfile,
  buildProfileIndex,
  isHttpUrl,
  type ProfileIndex,
} from "@/lib/cfp-import";
import {
  getActiveCfpEvents,
  getMatchableProfiles,
  getMatchableProfileById,
  getSuggestionEmailTargets,
  upsertSuggestion,
  refreshImportedTalk,
  type CfpEvent,
} from "@/lib/cfp-suggestions";
import { dateLegueeParEdition } from "@/lib/talk-date";
import { sendBrevoEmail } from "@/lib/email";
import { escapeHtml, salutation } from "@/lib/format";
import { BASE_URL } from "@/constants/site";
import { EDITIONS_RECENTES_MOIS, HARVEST_MAX_EVENTS } from "@/lib/conferences";

export interface SyncResult {
  events: number;
  suggestions: number;
  majs: number;
  erreurs: number;
  /** Speakeuses averties par e-mail qu'on a repéré de nouveaux talks. */
  notifs: number;
}

/** Corps de l'e-mail « nouveaux talks repérés » (exporté pour le tester). */
export function buildSuggestionsEmail(name: string | null, count: number) {
  const plur = count > 1;
  const talks = plur ? `${count} nouveaux talks` : "un nouveau talk";
  const ceux = plur ? "ces talks" : "ce talk";
  const espace = `${BASE_URL}/mon-espace`;
  const bonjour = salutation(name);
  const subject = plur
    ? `${count} talks repérés pour toi sur Tech Speak'Her`
    : "Un talk repéré pour toi sur Tech Speak'Her";
  const textContent = `${bonjour}

Le moissonneur de Tech Speak'Her a repéré ${talks} qui pourrai${plur ? "ent" : "t"} être ${plur ? "les tiens" : "le tien"}.

Confirme ou écarte ${ceux} en un clic dans ton espace\u00a0:
${espace}

Rien n'est publié sans ton accord. Pour arrêter ces repérages, décoche « Propose-moi les talks trouvés à mon nom » dans ta fiche.

L'équipe Tech Speak'Her`;
  const htmlContent = `<p>${escapeHtml(bonjour)}</p>
<p>Le moissonneur de Tech Speak'Her a repéré <strong>${talks}</strong> qui pourrai${plur ? "ent" : "t"} être ${plur ? "les tiens" : "le tien"}.</p>
<p>Confirme ou écarte ${ceux} en un clic dans ton espace&nbsp;:<br>
<a href="${espace}">${espace}</a></p>
<p>Rien n'est publié sans ton accord. Pour arrêter ces repérages, décoche «&nbsp;Propose-moi les talks trouvés à mon nom&nbsp;» dans ta fiche.</p>
<p>L'équipe Tech Speak'Her</p>`;
  return { subject, textContent, htmlContent };
}

/**
 * Plafond de suggestions créées par profil et par événement à chaque run :
 * un événement (hostile ou mal exporté) ne peut pas inonder un espace membre.
 */
const MAX_SUGGESTIONS_PAR_PROFIL_PAR_EVENEMENT = 20;

async function syncSessionizeEvent(
  event: CfpEvent,
  index: ProfileIndex,
  // Compteurs communs au cron (SyncResult) et au repérage à la demande
  // (HarvestResult) : seuls suggestions/majs sont mutés ici.
  result: Pick<SyncResult, "suggestions" | "majs">,
  nouveauxParProfil: Map<number, number>,
): Promise<void> {
  const data = await fetchSessionizeEvent(event.endpoint);
  const parProfil = new Map<number, number>();

  for (const candidat of mapSessionizeEvent(data)) {
    const match = matchSpeakerToProfile(candidat.speaker, index);
    if (!match) continue;

    const infos = {
      titre: candidat.titre,
      // Session sans date précise (startsAt absent) : elle hérite de ce que
      // l'événement SAIT — la règle commune aux trois portes (saisie, import,
      // moisson). Multi-jours → le mois, jamais un faux jour.
      date: dateLegueeParEdition(event.dateDebut, event.dateFin, candidat.date),
      conference: event.nom,
      ville: event.ville,
      pays: event.pays,
      // Seuls http(s) atterrissent en href sur les fiches (jamais javascript:).
      lienConf: isHttpUrl(event.url) ? event.url : null,
    };

    const rafraichi = await refreshImportedTalk(
      match.profileId,
      event.id,
      event.source,
      candidat.externalId,
      infos,
    );
    if (rafraichi) {
      result.majs++;
      continue;
    }

    const deja = parProfil.get(match.profileId) ?? 0;
    if (deja >= MAX_SUGGESTIONS_PAR_PROFIL_PAR_EVENEMENT) continue;

    const cree = await upsertSuggestion({
      profileId: match.profileId,
      eventId: event.id,
      externalId: candidat.externalId,
      description: candidat.description,
      ...infos,
    });
    // Ne compter (et n'imputer au plafond) que les vraies nouveautés : une
    // suggestion déjà refusée est un no-op, pas une proposition du jour.
    if (cree) {
      parProfil.set(match.profileId, deja + 1);
      // Cumul cross-événements pour la notification e-mail de fin de run.
      nouveauxParProfil.set(
        match.profileId,
        (nouveauxParProfil.get(match.profileId) ?? 0) + 1,
      );
      result.suggestions++;
    }
  }
}

/**
 * Prévient par e-mail chaque speakeuse ayant reçu de NOUVELLES suggestions ce
 * run (une seule fois, quel que soit le nombre d'événements). Respecte le
 * consentement (cfp_sync_mode ≠ 'aucun', filtré côté SQL). Un envoi qui échoue
 * est logué sans interrompre les autres ni faire échouer la moisson.
 */
async function notifierNouvellesSuggestions(
  nouveauxParProfil: Map<number, number>,
  result: SyncResult,
): Promise<void> {
  const cibles = await getSuggestionEmailTargets([...nouveauxParProfil.keys()]);
  for (const cible of cibles) {
    const count = nouveauxParProfil.get(cible.id) ?? 0;
    if (count <= 0) continue;
    const mail = buildSuggestionsEmail(cible.name, count);
    try {
      await sendBrevoEmail({
        to: cible.email,
        toName: cible.name ?? undefined,
        subject: mail.subject,
        textContent: mail.textContent,
        htmlContent: mail.htmlContent,
      });
      result.notifs++;
    } catch (err) {
      console.error("Notification suggestions échouée", cible.id, err);
    }
  }
}

export interface HarvestResult {
  events: number;
  suggestions: number;
  majs: number;
  erreurs: number;
}

/**
 * Moisson À LA DEMANDE, scopée à UN profil (« Lancer le repérage » dans
 * l'espace membre) : même machinerie que le cron, mais l'index de matching ne
 * contient que la speakeuse (personne d'autre ne reçoit de suggestion), les
 * éditions parcourues sont bornées (récentes d'abord, plafond), et AUCUN
 * e-mail n'est envoyé (elle est devant son écran, les suggestions s'affichent).
 * Respecte le consentement : profil en « aucun » → run vide.
 */
export async function runHarvestForProfile(profileId: number): Promise<HarvestResult> {
  const result: HarvestResult = { events: 0, suggestions: 0, majs: 0, erreurs: 0 };

  // Lecture ciblée (une ligne), pas tout l'annuaire opté-in.
  const mien = await getMatchableProfileById(profileId);
  if (mien.length === 0) return result; // opt-out ou profil inconnu

  let events = await getActiveCfpEvents();
  // Borne : éditions récentes (ou non datées) d'abord, plafond de fetchs.
  const seuil = new Date();
  seuil.setMonth(seuil.getMonth() - EDITIONS_RECENTES_MOIS);
  const seuilIso = seuil.toISOString().slice(0, 10);
  events = events
    .filter((e) => e.dateDebut === null || e.dateDebut >= seuilIso)
    // Non datées EN PREMIER (typiquement l'ajout tout frais de la membre —
    // c'est LA conf qu'elle vient chercher), puis les plus récentes.
    .sort((a, b) => {
      if (a.dateDebut === null) return b.dateDebut === null ? 0 : -1;
      if (b.dateDebut === null) return 1;
      return b.dateDebut.localeCompare(a.dateDebut);
    })
    .slice(0, HARVEST_MAX_EVENTS);

  const index = buildProfileIndex(mien);
  const nouveauxParProfil = new Map<number, number>();
  for (const event of events) {
    result.events++;
    try {
      if (event.source === "sessionize") {
        await syncSessionizeEvent(event, index, result, nouveauxParProfil);
      } else {
        throw new Error(`Source non gérée : ${event.source}`);
      }
    } catch (err) {
      result.erreurs++;
      console.error("Repérage à la demande échoué", event.endpoint, err);
    }
  }
  return result;
}

export async function syncCfpEvents(): Promise<SyncResult> {
  const result: SyncResult = {
    events: 0,
    suggestions: 0,
    majs: 0,
    erreurs: 0,
    notifs: 0,
  };

  const events = await getActiveCfpEvents();
  if (events.length === 0) return result;

  // Index construit UNE fois : les profils sont identiques pour tous les events.
  const index = buildProfileIndex(await getMatchableProfiles());
  // Nouvelles suggestions du run par profil (pour un seul e-mail récap/profil).
  const nouveauxParProfil = new Map<number, number>();

  for (const event of events) {
    result.events++;
    try {
      if (event.source === "sessionize") {
        await syncSessionizeEvent(event, index, result, nouveauxParProfil);
      } else {
        // 'conference-hall' à brancher ensuite ; une source inconnue ne doit
        // pas être ignorée en silence (sinon une coquille passe inaperçue).
        throw new Error(`Source non gérée : ${event.source}`);
      }
    } catch (err) {
      // On n'interrompt pas le lot (retenté au prochain run), mais on compte et
      // logue : un endpoint retiré ou en panne doit être visible.
      result.erreurs++;
      console.error("Moisson échouée", event.source, event.endpoint, err);
    }
  }

  if (nouveauxParProfil.size > 0) {
    // La notification ne doit jamais faire échouer la moisson : un problème de
    // lecture des cibles ou d'envoi est logué, les compteurs du run sont
    // préservés (sinon le cron remonte 500 et perd events/suggestions/majs).
    try {
      await notifierNouvellesSuggestions(nouveauxParProfil, result);
    } catch (err) {
      console.error("Notification suggestions : étape ignorée", err);
    }
  }
  return result;
}
