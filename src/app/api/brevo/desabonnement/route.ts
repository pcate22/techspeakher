import { NextResponse } from "next/server";
import { secretValide } from "@/lib/cron-auth";
import { desabonnerParEmail } from "@/lib/newsletter";

export const dynamic = "force-dynamic";

/**
 * Retour de Brevo quand quelqu'un se désinscrit DEPUIS un e-mail (lien natif de
 * désabonnement) : on pose le refus côté plateforme.
 *
 * Sans ce retour, la personne verrait « Recevoir la lettre d'information »
 * encore activé dans ses réglages alors qu'elle vient de refuser : l'écran lui
 * mentirait sur son propre choix. Rien n'est cassé pour autant si le webhook
 * n'est pas configuré — Brevo respecte sa désinscription de son côté ; c'est
 * l'affichage et la synchro qui resteraient en retard.
 *
 * Garde : `BREVO_WEBHOOK_SECRET` en paramètre `?token=`. Les webhooks Brevo
 * n'envoient pas d'en-tête d'autorisation personnalisable, d'où le jeton dans
 * l'URL — comparé à temps constant, et l'URL reste un secret d'exploitation.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const token = new URL(request.url).searchParams.get("token");
  if (!secretValide(process.env.BREVO_WEBHOOK_SECRET, token)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }

  // Brevo envoie `event` et `email` ; on ne traite que la désinscription et la
  // plainte pour spam (« unsubscribed », « spam »). Un autre événement répond
  // 200 sans rien faire : renvoyer une erreur ferait rejouer le webhook en
  // boucle pour rien.
  const { event, email } = (corps ?? {}) as { event?: string; email?: string };
  const aTraiter = event === "unsubscribed" || event === "spam";
  if (!aTraiter || typeof email !== "string" || email.trim() === "") {
    return NextResponse.json({ traite: false });
  }

  const desabonnees = await desabonnerParEmail(email);
  return NextResponse.json({ traite: desabonnees > 0 });
}
