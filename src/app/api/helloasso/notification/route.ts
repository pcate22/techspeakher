import { NextResponse } from "next/server";
import { secretValide } from "@/lib/cron-auth";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { traiterNotificationHelloAsso } from "@/lib/passe-adhesions";

export const dynamic = "force-dynamic";

/**
 * Notification HelloAsso (commande, paiement). Cf.
 * docs/conception-adhesions-helloasso.md § 2.
 *
 * HelloAsso ne SIGNE pas ses notifications : n'importe qui peut poster ici.
 * Trois défenses, dans l'ordre :
 * 1. la clé `HELLOASSO_WEBHOOK_SECRET` en paramètre `?token=` (même convention
 *    que le webhook Brevo), comparée à temps constant : sans elle, 401 ;
 * 2. un débit borné par IP ;
 * 3. surtout, le corps n'est jamais cru : `traiterNotificationHelloAsso` n'en
 *    lit que l'identifiant de commande et relit la commande par l'API.
 *
 * Une panne de l'API répond 500 ; le rattrapage du cron du soir (17 h UTC) relit de toute
 * façon tout l'historique, donc rien ne se perd.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const token = new URL(request.url).searchParams.get("token");
  if (!secretValide(process.env.HELLOASSO_WEBHOOK_SECRET, token)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (isRateLimited(`helloasso:ip:${clientIp(request.headers)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
  }

  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }

  try {
    const resultat = await traiterNotificationHelloAsso(corps);
    return NextResponse.json({ resultat });
  } catch (err) {
    console.error("Notification HelloAsso non traitée", err);
    return NextResponse.json({ error: "Traitement impossible" }, { status: 500 });
  }
}
