import { NextResponse } from "next/server";
import { invaliderAnnuaireDiffere } from "@/lib/annuaire-cache";
import { requireUserJson } from "@/lib/auth-guards";
import { getUploadedFile, uploadImage } from "@/lib/media";
import { appliquerNouvelAvatar, CADENCE_AVATAR } from "@/lib/avatar-compte";
import { isRateLimited } from "@/lib/rate-limit";

/**
 * Envoyer une photo comme avatar du compte — appelée en `fetch` direct depuis
 * la fiche (`ChampsIdentite`, étape « Profil ») : c'est la photo AFFICHÉE sur
 * la fiche publique qui devient l'avatar, une seule photo pour les deux (même
 * colonne `users.image` que la reprise de photo OAuth). Route API (pas une
 * Server Action) pour la même raison que `/api/admin/contenus/image` : ne pas
 * relever la limite de taille GLOBALE des Server Actions pour une seule
 * fonctionnalité d'upload.
 */
export async function POST(request: Request): Promise<Response> {
  const userId = await requireUserJson();
  if (userId instanceof Response) return userId;

  // Anti-abus : chaque envoi coûte réellement (stockage/bande passante Blob).
  // `src/lib/rate-limit.ts` existe déjà pour ça (lien magique, contact) ;
  // réutilisé ici par compte, à la cadence PARTAGÉE avec la reprise LinkedIn.
  if (isRateLimited(`avatar-upload:${userId}`, CADENCE_AVATAR.envois, CADENCE_AVATAR.fenetreMs)) {
    return NextResponse.json(
      { error: "Trop de photos envoyées récemment. Réessaie dans quelques minutes." },
      { status: 429 },
    );
  }

  const file = await getUploadedFile(request);
  if (!file) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });

  const result = await uploadImage(file, "avatars");
  if ("error" in result) return NextResponse.json(result, { status: 400 });

  // Écriture DB ET rafraîchissement du jeton, ensemble (`appliquerNouvelAvatar`) :
  // sans le second, l'avatar du header resterait l'ancien jusqu'à la prochaine
  // connexion.
  await appliquerNouvelAvatar(userId, result.url);
  // La photo s'affiche sur la carte de l'annuaire ; route handler, donc le
  // geste DIFFÉRÉ (updateTag est réservé aux Server Actions).
  invaliderAnnuaireDiffere();
  return NextResponse.json(result);
}
