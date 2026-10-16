import type { DefaultSession } from "next-auth";

// Expose l'id du compte (clé en base) et le rôle orga dans la session,
// pour relier le profil à la bonne personne et garder les routes /admin.
declare module "next-auth" {
  interface Session {
    user: { id: string; isOrga: boolean; isCoach: boolean } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isOrga?: boolean;
    isCoach?: boolean;
    /** Dernier horodatage du signe de vie écrit en base (epoch, secondes).
     *  Porté par le jeton pour décider SANS lire la base à chaque rafraîchi
     *  (cf. docs/conception-conservation-comptes.md). */
    vu?: number;
  }
}
