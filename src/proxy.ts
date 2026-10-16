import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig, refusDAcces } from "@/auth.config";

/**
 * Proxy Next.js 16 (ex-`middleware`).
 * Instance Auth.js construite uniquement depuis `authConfig` (edge-safe, sans
 * adapter base). Le `matcher` limite l'exécution aux routes privées.
 *
 * LA DÉCISION EST APPLIQUÉE ICI, EXPLICITEMENT. Auth.js n'applique le verdict
 * du callback `authorized` que pour un proxy SANS gestionnaire propre : dès
 * qu'on en fournit un (ce fichier), `handleAuth` exécute le gestionnaire et
 * ignore le booléen (`next-auth/lib/index.js`). La version précédente ne
 * testait donc que la présence d'une session — le rôle orga n'était filtré
 * nulle part au bord, et une membre connectée traversait le proxy jusqu'aux
 * pages /admin (mesuré : 200 sur cinq d'entre elles). Seule la garde de page
 * `requireOrgaPage` la refoulait ensuite.
 *
 * On appelle donc `refusDAcces` — la même source de vérité que le callback —
 * et on redirige vers la destination qu'elle renvoie.
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const destination = refusDAcces(req.nextUrl.pathname, req.auth?.user);
  if (destination) {
    return NextResponse.redirect(new URL(destination, req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/mon-espace/:path*", "/admin/:path*"],
};
