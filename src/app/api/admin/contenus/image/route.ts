import { NextResponse } from "next/server";
import { requireOrgaJson } from "@/lib/auth-guards";
import { getUploadedFile, uploadImage } from "@/lib/media";

/**
 * Upload de l'image d'un article/page (`Editeur.tsx`, appel `fetch` direct).
 * Route API (pas une Server Action) : les Server Actions partagent une limite
 * de taille de requête GLOBALE (`experimental.serverActions.bodySizeLimit`,
 * 1 Mo par défaut) — la relever pour une image de 4 Mo l'aurait relevée pour
 * TOUTE action du site, y compris les actions publiques non authentifiées
 * (connexion, contact). Une route dédiée n'a pas cette limite partagée.
 */
export async function POST(request: Request): Promise<Response> {
  const denied = await requireOrgaJson();
  if (denied) return denied;

  const file = await getUploadedFile(request);
  if (!file) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });

  const result = await uploadImage(file);
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
