import { NextResponse } from "next/server";
import { getSpeakerSearchItems } from "@/lib/search";
import { ENTETES_CACHE_RECHERCHE } from "@/lib/search-cache";

// Source de la recherche : speakeuses publiées (liens vers les fiches).
// Rendu DYNAMIQUE (même raison que la page `/speakeuses`) : un build sans base
// figerait un index VIDE et la loupe ne trouverait plus personne. On calcule en
// direct côté serveur, et le CDN garde le résultat 5 min via Cache-Control
// (mémorise la réponse HTTP, pas un snapshot de build) — donc pas de vide figé.
export const dynamic = "force-dynamic";

export async function GET() {
  const items = await getSpeakerSearchItems();
  return NextResponse.json(items, { headers: ENTETES_CACHE_RECHERCHE });
}
