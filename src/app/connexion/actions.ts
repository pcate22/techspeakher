"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { rememberSignInMethod } from "@/lib/last-signin-method";
import { isMagicLinkThrottled, clientIp } from "@/lib/rate-limit";

/**
 * Connexion (ou 1ʳᵉ inscription) via un provider OAuth. On mémorise la méthode
 * choisie AVANT de lancer la connexion (cookie « dernière méthode »), pour la
 * remettre en avant à la prochaine visite. signIn lève une redirection vers le
 * provider : on la laisse remonter.
 */
export async function signInWithGoogle(): Promise<void> {
  await rememberSignInMethod("google");
  await signIn("google", { redirectTo: "/mon-espace" });
}

export async function signInWithLinkedIn(): Promise<void> {
  await rememberSignInMethod("linkedin");
  await signIn("linkedin", { redirectTo: "/mon-espace" });
}

/**
 * Connexion par lien magique. Garde-fou anti-abus (spam de liens / quota Brevo)
 * AVANT tout envoi. On mémorise « email » comme dernière méthode. Le succès de
 * signIn lève une REDIRECTION Next (digest NEXT_REDIRECT) qu'on laisse passer ;
 * toute autre erreur Auth.js devient un message lisible sur /connexion.
 */
export async function signInWithEmail(formData: FormData): Promise<void> {
  const email = (formData.get("email") ?? "").toString().trim();
  if (!email) return;
  const ip = clientIp(await headers());
  if (isMagicLinkThrottled(ip, email)) {
    redirect("/connexion?error=throttle");
  }
  await rememberSignInMethod("email");
  try {
    await signIn("email", { email, redirectTo: "/mon-espace" });
  } catch (error) {
    const digest = (error as { digest?: string } | null)?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    const code = (error as { type?: string } | null)?.type ?? "default";
    redirect(`/connexion?error=${encodeURIComponent(code)}`);
  }
}
