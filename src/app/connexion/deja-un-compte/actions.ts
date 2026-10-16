"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { signIn } from "@/auth";
import { SKIP_DUP_CHECK_COOKIE } from "@/lib/accounts";
import { isGoogleEnabled, isLinkedInEnabled } from "@/auth.config";

const OAUTH_PROVIDERS: Record<string, () => boolean> = {
  google: isGoogleEnabled,
  linkedin: isLinkedInEnabled,
};

/**
 * « Créer un nouveau compte quand même » depuis l'écran de doublon : on relance
 * la connexion au provider en posant le cookie qui court-circuite la détection
 * (sinon on retomberait en boucle sur cet écran). Non bloquant, c'est le choix
 * explicite de la personne.
 */
export async function continueAsNewAction(formData: FormData): Promise<void> {
  const provider = String(formData.get("methode") ?? "");
  const enabled = OAUTH_PROVIDERS[provider];
  if (!enabled || !enabled()) redirect("/connexion?error=default");

  const jar = await cookies();
  jar.set(SKIP_DUP_CHECK_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
  await signIn(provider, { redirectTo: "/mon-espace" });
}
