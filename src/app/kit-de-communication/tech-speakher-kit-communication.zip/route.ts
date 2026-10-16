import { readFile } from "node:fs/promises";
import path from "node:path";
import { creerZip } from "@/lib/zip";
import { DOSSIER_KIT, fichiersArchive, NOM_ZIP } from "@/data/kit-communication";

/**
 * L'archive du kit de communication : les fichiers de `public/kit/`, réunis
 * en un ZIP au BUILD (`force-static`), puis servi comme un fichier statique.
 *
 * Construite depuis la liste de `src/data/kit-communication.ts` plutôt que
 * committée : un logo remplacé dans `public/kit/` entre dans l'archive au
 * déploiement suivant, sans seconde copie à tenir à jour.
 */
export const dynamic = "force-static";

export async function GET() {
  const fichiers = await Promise.all(
    fichiersArchive.map(async (f) => ({
      nom: f.fichier,
      contenu: await readFile(path.join(process.cwd(), "public", DOSSIER_KIT, f.fichier)),
    })),
  );
  return new Response(creerZip(fichiers), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${NOM_ZIP}"`,
    },
  });
}
