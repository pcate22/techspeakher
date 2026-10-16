"use client";

import { useSelectedLayoutSegments } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { useFilTail } from "./FilContext";

/**
 * Fil d'Ariane raciné d'une édition (Espace organisatrices › Tremplins › …),
 * rendu par le layout `[edition]` au-dessus de chaque page du sous-arbre.
 *
 * La navigation ENTRE sections se fait désormais par le HUB de l'édition (des
 * grandes lignes lisibles Ateliers / Participantes / Finale / Photos /
 * Ressources), et non plus par une barre de pastilles peu visible en haut
 * (lot F : « hub franc »). Retour intra-édition par ce fil (la racine édition
 * ramène au hub). On garde le nom du composant pour ne pas propager le renommage.
 */
export default function EditionSousNav({
  editionId,
  editionNom,
}: {
  editionId: number;
  editionNom: string;
}) {
  const segments = useSelectedLayoutSegments();
  const premier = segments[0] ?? null;
  // Maillons ajoutés par une page profonde (participante, atelier…) : le fil
  // reste unique et complet (« … › Léa Dubois › Compte »).
  const tail = useFilTail();
  const base = `/admin/tremplins/${editionId}`;

  return (
    <Breadcrumb
      items={[
        { label: "Espace organisatrices", href: "/admin" },
        { label: "Tremplins", href: "/admin/tremplins" },
        // Sur le hub, l'édition est la page courante ; ailleurs elle reste un
        // lien de retour au hub.
        premier === null ? { label: editionNom } : { label: editionNom, href: base },
        ...tail,
      ]}
    />
  );
}
