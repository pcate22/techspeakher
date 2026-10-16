import { NextRequest, NextResponse } from "next/server";
import { searchCommunes } from "@/lib/communes";

// Proxy same-origin de l'autocomplétion de communes (Base Adresse Nationale).
// Le navigateur n'appelle jamais un tiers directement : l'appel BAN se fait
// côté serveur. Réponse mise en cache (les communes bougent très peu).
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ communes: [] });
  }
  const communes = await searchCommunes(q);
  return NextResponse.json(
    { communes },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
