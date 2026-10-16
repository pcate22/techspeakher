import type { ReactNode } from "react";
import CoquilleEspace from "@/components/CoquilleEspace";

/**
 * Même coquille d'app que /mon-espace (WCAG 3.2.3, navigation cohérente).
 * Sur mobile, l'onglet-photo de la barre basse reste courant dans tout
 * /admin ; sur grand écran, le rail y montre le groupe « Organisation ». Les
 * gardes d'autorisation restent sur chaque page (`requireOrgaPage`) : le rail
 * n'affiche ce groupe qu'aux orgas, il ne garde rien.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <CoquilleEspace>{children}</CoquilleEspace>;
}
