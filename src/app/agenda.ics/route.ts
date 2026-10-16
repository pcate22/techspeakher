import { agendaIcs } from "@/lib/agenda-ics";
import { getScenesHorizon, type ScenePublique } from "@/lib/agenda-public";
import { aujourdhuiParis } from "@/lib/tremplin-statut";

/**
 * FLUX iCALENDAR DE L'HORIZON (lot 4 de `docs/audit-ux-agenda-2026-08.md`) :
 * `https://techspeakher.fr/agenda.ics`. On s'abonne à des dates, on ne les
 * recopie pas.
 *
 * L'HORIZON, pas l'archive : un calendrier auquel on s'abonne sert à savoir ce
 * qui vient. Le passé a sa surface citable (`/agenda/[annee]`), et déverser
 * quinze ans d'archive dans le calendrier de quelqu'un serait un cadeau
 * empoisonné.
 *
 * Résilient comme les pages : base injoignable → un calendrier **vide mais
 * valide**, jamais une erreur. Un 500 sur un flux d'abonnement fait
 * désabonner des clients d'une adresse qui remarchera dans cinq minutes.
 *
 * Le rendu est DYNAMIQUE, pour la même raison que `/agenda` : l'ISR figerait au
 * build un calendrier qui doit glisser tous les jours.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const aujourdhui = aujourdhuiParis();
  let aVenir: ScenePublique[] = [];
  try {
    aVenir = await getScenesHorizon(aujourdhui);
  } catch (err) {
    console.error("Flux iCalendar de l'agenda : base indisponible", err);
  }

  const ics = agendaIcs(aVenir, { horodatage: new Date().toISOString() });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Les clients de calendrier rafraîchissent seuls, souvent plusieurs fois
      // par heure : la même fenêtre que le flux RSS suffit largement.
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      // Nom de fichier lisible pour qui télécharge au lieu de s'abonner.
      "Content-Disposition": 'inline; filename="agenda-tech-speak-her.ics"',
    },
  });
}
