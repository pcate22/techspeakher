import type { ReactNode } from "react";
import CoquilleEspace from "@/components/CoquilleEspace";

/**
 * Coquille de l'espace connecté (refonte §11, rail bureau du 2026-10-15) :
 * barre d'onglets basse sur mobile, rail sur grand écran, sur toutes les pages
 * de /mon-espace (et /admin, même coquille).
 */
export default function MonEspaceLayout({ children }: { children: ReactNode }) {
  return <CoquilleEspace>{children}</CoquilleEspace>;
}
