import { NextResponse } from "next/server";
import { invaliderAnnuaireDiffere } from "@/lib/annuaire-cache";
import { syncCfpEvents } from "@/lib/cfp-sync";
import { syncTechHubMeetups, type MeetupSyncResult } from "@/lib/meetup-sync";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
// Le moissonnage enchaîne des fetchs externes (10 s de timeout chacun) :
// on laisse de la marge au-delà des 10 s par défaut de Vercel.
export const maxDuration = 60;

/**
 * Cron du moissonneur : re-synchronise les éditions actives de la référence
 * des conférences (suggestions de talks des speakeuses), PUIS synchronise les
 * meetups toulousains (Toulouse Tech Hub). Les deux étapes sont indépendantes :
 * la sync meetups tourne même sans événement CFP actif, et son crash ne fait
 * pas perdre les compteurs de la moisson (juste une erreur comptée).
 * Protégé par CRON_SECRET (en-tête Authorization, ajouté par Vercel Cron).
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cfp = await syncCfpEvents();
  let meetups: MeetupSyncResult;
  try {
    meetups = await syncTechHubMeetups();
  } catch (err) {
    console.error("Sync meetups : étape en échec", err);
    meetups = { meetups: 0, erreurs: 1 };
  }
  // La moisson peut réécrire des titres de talks affichés sur les cartes de
  // l'annuaire : expiration différée (cron = route handler).
  invaliderAnnuaireDiffere();
  const result = {
    ...cfp,
    meetups: meetups.meetups,
    erreurs: cfp.erreurs + meetups.erreurs,
  };
  // 207 si au moins une étape a échoué : observable dans le monitoring Vercel
  // sans dépendre de la lecture des logs.
  return NextResponse.json(result, { status: result.erreurs > 0 ? 207 : 200 });
}
