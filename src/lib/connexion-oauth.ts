import { cookies } from "next/headers";
import { signIn } from "@/auth";
import { SKIP_DUP_CHECK_COOKIE } from "@/lib/accounts";

/**
 * Relancer une connexion OAuth EN COURT-CIRCUITANT la détection de doublon.
 *
 * Trois gestes le font, pour la même raison : lier une méthode depuis « Mes
 * connexions », choisir « créer un compte quand même » sur l'écran de doublon,
 * redemander une autorisation à LinkedIn pour reprendre sa photo. Dans les
 * trois cas, l'homonyme que la détection trouverait est le compte qu'on a déjà
 * sous la main — la laisser tourner renverrait vers l'écran « tu as peut-être
 * déjà un compte » au milieu d'un geste délibéré.
 *
 * Le cookie était recopié à ces trois endroits, attributs compris. Un seul
 * endroit les tient maintenant : sa durée (courte, le temps d'un aller-retour)
 * et ses attributs de sécurité sont une décision, pas trois.
 *
 * `signIn` lève une redirection (vers le provider) : cette fonction ne rend
 * jamais la main, ses appelantes la délèguent telle quelle.
 */
export async function connexionOAuthSansDoublon(
  provider: string,
  redirectTo: string,
): Promise<void> {
  const jar = await cookies();
  jar.set(SKIP_DUP_CHECK_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
  await signIn(provider, { redirectTo });
}
