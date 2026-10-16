import NextAuth from "next-auth";
import PostgresAdapter from "@auth/pg-adapter";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";
import { getUserRoles } from "@/lib/profiles";
import { toucherSigneDeVie } from "@/lib/comptes-inactifs";
import { PAS_SIGNE_DE_VIE_JOURS } from "@/lib/conservation-comptes";
import { authConfig } from "./auth.config";
import { isMagicLinkEnabled, magicLinkProvider } from "@/lib/magic-link";
import {
  adresseFournisseurVerifiee,
  duplicateSigninRedirect,
  rafraichirJetonProvider,
  SKIP_DUP_CHECK_COOKIE,
} from "@/lib/accounts";
import { pickManualImageUpdate } from "@/lib/provider-avatar";

// Providers : OAuth (edge-safe, partagés) + lien magique e-mail (Node only,
// car il a besoin de l'adapter base pour les jetons de vérification).
const providers = [...authConfig.providers];
if (isMagicLinkEnabled()) providers.push(magicLinkProvider());

/**
 * Dernier signe de vie écrit PAR CE PROCESSUS (id → epoch s).
 *
 * Le jeton porte déjà la date (`token.vu`), mais il ne la garde que si le cookie
 * ré-signé est renvoyé — ce qui n'arrive pas sur le chemin des composants
 * serveur, où `auth()` lit le jeton sans jamais reposer de `Set-Cookie`. Sans ce
 * garde-fou, passé une semaine de session, CHAQUE page authentifiée refaisait un
 * aller-retour Neon pour un UPDATE qui ne touche aucune ligne.
 *
 * Cache MOU, et c'est voulu : un processus froid refait l'écriture (sans effet),
 * jamais l'inverse. La vraie borne reste la clause `WHERE` de `toucherSigneDeVie`
 * — celle-ci ne fait qu'éviter d'aller la demander à la base.
 */
const signesDeVieEcrits = new Map<number, number>();

/**
 * Instance Auth.js (runtime Node).
 *
 * Sessions JWT + adapter Postgres : à la connexion Google/LinkedIn, le compte
 * (User + Account) est persisté en base (Neon). Le callback jwt enregistre le
 * rôle orga dans le token (lecture base, côté Node uniquement → le proxy edge
 * ne lit que le token, jamais la base).
 */
export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  providers,
  adapter: PostgresAdapter(pool),
  callbacks: {
    ...authConfig.callbacks,
    /**
     * Détection non bloquante des doublons (brique 2). Sur une connexion (OAuth
     * OU lien magique) qui CRÉERAIT un compte alors qu'un homonyme existe déjà,
     * on redirige vers un écran de choix (« regrouper » ou « nouveau compte »)
     * AVANT toute création (ce callback tourne avant handleLoginOrRegister). La
     * comparaison de nom est repliée (casse/accents/espaces, cf. foldName) pour
     * ne plus rater un quasi-homonyme. Le cookie de court-circuit (liaison
     * depuis « Mes connexions », ou choix explicite « créer quand même ») laisse
     * passer.
     */
    async signIn({ user, account, profile }) {
      const jar = await cookies();
      const skip = jar.get(SKIP_DUP_CHECK_COOKIE)?.value === "1";
      const redirectTo = await duplicateSigninRedirect({
        account: account
          ? {
              type: account.type,
              provider: account.provider,
              providerAccountId: String(account.providerAccountId),
            }
          : null,
        email: user?.email ?? (profile?.email as string | undefined) ?? null,
        name: user?.name ?? (profile?.name as string | undefined) ?? null,
        skip,
      });
      return redirectTo ?? true;
    },
    async jwt({ token, user, account, profile, trigger, session }) {
      if (user?.id) {
        const roles = await getUserRoles(Number(user.id));
        token.isOrga = roles.isOrga;
        token.isCoach = roles.isCoach;
      }
      // Le jeton d'accès du provider (et son adresse) est RE-ÉCRIT à chaque connexion OAuth :
      // Auth.js ne le fait qu'au premier rattachement, donc la base gardait un
      // jeton périmé pour qui se reconnectait des mois plus tard. C'est lui qui
      // permet de redemander la photo LinkedIn sans nouvel aller-retour
      // (`src/lib/linkedin-photo.ts`). Best-effort : jamais bloquant pour la
      // connexion elle-même.
      if (account?.access_token && Number.isFinite(Number(token.sub))) {
        try {
          await rafraichirJetonProvider({
            userId: Number(token.sub),
            provider: account.provider,
            providerAccountId: String(account.providerAccountId),
            accessToken: account.access_token,
            expiresAt:
              typeof account.expires_at === "number" ? account.expires_at : null,
            // L'adresse du FOURNISSEUR (profil OAuth), pas celle du compte :
            // c'est elle qu'Auth.js oublie, et contre laquelle une adhésion
            // HelloAsso doit pouvoir se rapprocher.
            email: adresseFournisseurVerifiee(profile),
          });
        } catch (e) {
          console.error("Jeton provider non rafraîchi", token.sub, e);
        }
      }
      // Avatar envoyé en fichier (`/api/mon-espace/avatar`) : pas d'aller-retour
      // OAuth, donc rafraîchi via `unstable_update()` (`trigger === "update"`).
      // La ligne `users.image` est déjà écrite par la route ; ici on évite
      // seulement l'avatar figé jusqu'à la prochaine connexion (même défaut
      // que `token.name`, cf. docs/dette-technique.md — corrigé ICI pour
      // l'avatar, qui se voit sur chaque page via le header).
      if (trigger === "update") {
        const image = pickManualImageUpdate(session);
        if (image) token.picture = image;
      }

      // SIGNE DE VIE (conservation des comptes, RGPD art. 5-1-e).
      //
      // Ici et pas dans un évènement de connexion : une session JWT vit
      // longtemps, quelqu'un peut utiliser le site des mois sans se
      // reconnecter, et on l'aurait déclaré inactif alors qu'il vient de lire
      // l'annuaire. Ce callback tourne à chaque rafraîchi de jeton ; le jeton
      // porte la date du dernier passage écrit, doublée d'une mémoire de
      // processus (`signesDeVieEcrits`) parce que ce jeton-là n'est pas toujours
      // reposé. On décide donc sans lire la base, et on écrit au plus une fois
      // par semaine et par compte.
      //
      // Best-effort, jamais bloquant : une base indisponible fait échouer
      // l'horodatage, pas la connexion. Un signe de vie manqué décale une
      // échéance de deux ans, une connexion refusée se voit tout de suite.
      const uid = Number(token.sub);
      const maintenant = Math.floor(Date.now() / 1000);
      const fenetre = PAS_SIGNE_DE_VIE_JOURS * 86_400;
      const vu = Math.max(token.vu ?? 0, signesDeVieEcrits.get(uid) ?? 0);
      if (Number.isFinite(uid) && uid > 0 && maintenant - vu > fenetre) {
        try {
          await toucherSigneDeVie(uid);
          token.vu = maintenant;
          signesDeVieEcrits.set(uid, maintenant);
        } catch (e) {
          console.error("Signe de vie non horodaté", uid, e);
        }
      }
      return token;
    },
  },
});
