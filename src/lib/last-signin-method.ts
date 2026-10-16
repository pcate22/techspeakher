import { cookies } from "next/headers";

/**
 * Mémoire de la DERNIÈRE méthode de connexion utilisée sur cet appareil, pour
 * la remettre en avant à la prochaine visite (« La dernière fois, tu t'es
 * connectée avec… »). Cookie fonctionnel first-party, sans donnée personnelle
 * (juste l'identifiant de méthode) : il guide la personne vers la même porte et
 * évite ainsi un doublon de compte involontaire, sur le même appareil.
 *
 * Côté serveur uniquement (lecture au rendu de /connexion, écriture dans les
 * Server Actions de connexion). `httpOnly` : jamais lu par du JS client.
 */
export type SignInMethod = "google" | "linkedin" | "email";

const COOKIE = "tsh-derniere-methode";
const VALID: readonly SignInMethod[] = ["google", "linkedin", "email"];
// Un an : c'est une préférence stable, comme chez les services qui font ça.
const MAX_AGE = 60 * 60 * 24 * 365;

/** Mémorise la méthode choisie (appelé au moment où on lance la connexion). */
export async function rememberSignInMethod(method: SignInMethod): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, method, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** Dernière méthode utilisée sur cet appareil, ou null si inconnue/invalide. */
export async function getLastSignInMethod(): Promise<SignInMethod | null> {
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  return value && (VALID as readonly string[]).includes(value)
    ? (value as SignInMethod)
    : null;
}
