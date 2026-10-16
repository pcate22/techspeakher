"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth-guards";
import { connexionOAuthSansDoublon } from "@/lib/connexion-oauth";
import {
  getLinkedProviders,
  unlinkProvider,
  canUnlinkProvider,
} from "@/lib/accounts";
import { getUserById } from "@/lib/users";
import { isMagicLinkEnabled } from "@/lib/magic-link";
import { isGoogleEnabled, isLinkedInEnabled } from "@/auth.config";

/** Providers OAuth qu'on sait lier / délier (les seuls matérialisés en base). */
const OAUTH_PROVIDERS: Record<string, () => boolean> = {
  google: isGoogleEnabled,
  linkedin: isLinkedInEnabled,
};

/**
 * Lier un provider au compte de la membre CONNECTÉE : on relance simplement la
 * connexion OAuth alors qu'une session existe. Auth.js rattache alors le nouveau
 * provider au compte courant, même si son e-mail diffère (handle-login : « user
 * already signed in » → linkAccount). L'identité vient de la session ; on ne
 * lance la connexion que pour un provider réellement configuré.
 */
export async function linkProviderAction(formData: FormData): Promise<void> {
  await requireUserId();
  const provider = String(formData.get("provider") ?? "");
  const enabled = OAUTH_PROVIDERS[provider];
  if (!enabled || !enabled()) redirect("/mon-espace/connexions?error=methode");
  // On lie à un compte DÉJÀ connecté : court-circuiter la détection de doublon
  // (l'homonyme trouvé serait… ce compte lui-même). La redirection vers le
  // provider est levée par `signIn` ; on la délègue telle quelle.
  await connexionOAuthSansDoublon(provider, "/mon-espace/connexions?ok=liee");
}

/**
 * Délier un provider. Garde-fous : identité par la SESSION, provider connu, et
 * surtout on refuse de retirer le DERNIER moyen de connexion (anti-lockout :
 * la membre doit toujours pouvoir se reconnecter). Le lien magique compte comme
 * moyen de secours dès que le compte a un e-mail et qu'il est activé.
 */
export async function unlinkProviderAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const provider = String(formData.get("provider") ?? "");
  if (!(provider in OAUTH_PROVIDERS)) redirect("/mon-espace/connexions?error=methode");

  const [linked, user] = await Promise.all([
    getLinkedProviders(userId),
    getUserById(userId),
  ]);
  const opts = {
    hasEmail: Boolean(user?.email),
    magicLinkEnabled: isMagicLinkEnabled(),
  };
  if (!canUnlinkProvider(provider, linked, opts)) {
    redirect("/mon-espace/connexions?error=derniere");
  }

  await unlinkProvider(userId, provider);
  revalidatePath("/mon-espace/connexions");
  redirect("/mon-espace/connexions?ok=deliee");
}

// La PHOTO de profil se choisit là où elle s'affiche : le champ Photo de la
// fiche (`ChampPhoto`), qui sait l'envoyer en fichier (`/api/mon-espace/avatar`)
// comme la reprendre depuis LinkedIn (`reprendrePhotoLinkedInAction`). Cette
// page-ci n'a plus qu'un rôle : les moyens d'entrer dans son compte.
