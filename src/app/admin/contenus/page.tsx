import { redirect } from "next/navigation";
import { requireOrgaPage } from "@/lib/auth-guards";

export const dynamic = "force-dynamic";

/**
 * La liste des contenus a fusionné avec la page publique `/actualites` (« une
 * seule liste » : le public la consulte, l'orga y ajoute/édite). On garde cette
 * route comme redirection : les liens internes (fil d'Ariane, retours de
 * l'éditeur) restent valides. La création/édition d'un item vit toujours sur sa
 * page dédiée (`/admin/contenus/publication/...`).
 */
export default async function AdminContenusPage() {
  await requireOrgaPage();
  redirect("/actualites");
}
