import type { ReactNode } from "react";
import SujetEntete from "../../SujetEntete";

/**
 * En-tête d'une sous-page participante. Fin wrapper de `SujetEntete` (le motif
 * commun surtitre + titre) : le nom est le titre, la fonction le surtitre.
 */
export default function ParticipanteEntete({
  fonction,
  nom,
  children,
}: {
  fonction: string;
  nom: string;
  children?: ReactNode;
}) {
  return (
    <SujetEntete surtitre={fonction} titre={nom}>
      {children}
    </SujetEntete>
  );
}
