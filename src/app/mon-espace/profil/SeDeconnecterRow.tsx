"use client";

import { signOut } from "next-auth/react";

/**
 * La déconnexion, rangée de « Mon profil » : elle a quitté le tiroir du
 * burger avec le reste du « moi » (conception N1 §2.2, validée). Sa propre
 * carte, en couleur distincte — une action de sortie, pas une navigation.
 */
export default function SeDeconnecterRow() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="block w-full rounded-xl border border-navy-lighter bg-navy px-4 py-3 text-left text-sm font-medium text-orange transition-colors hover:bg-orange/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
    >
      Se déconnecter
    </button>
  );
}
