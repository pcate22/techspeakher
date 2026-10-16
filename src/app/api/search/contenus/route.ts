import { NextResponse } from "next/server";
import { getContenuSearchItems } from "@/lib/search-contenus";
import { ENTETES_CACHE_RECHERCHE } from "@/lib/search-cache";

// Source de la recherche : contenus éditoriaux PUBLIÉS (actualités et pages).
// Rendu DYNAMIQUE pour la même raison que la route speakeuses : un build sans
// base figerait un index vide, et publier depuis l'éditeur ne rendrait toujours
// rien trouvable — le défaut que ce lot corrige. Le CDN garde la réponse 5 min
// (mémorise la réponse HTTP, pas un instantané de build).
export const dynamic = "force-dynamic";

export async function GET() {
  const items = await getContenuSearchItems();
  return NextResponse.json(items, { headers: ENTETES_CACHE_RECHERCHE });
}
