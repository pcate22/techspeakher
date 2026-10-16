// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GET } from "@/app/kit-de-communication/tech-speakher-kit-communication.zip/route";
import { fichiersArchive, octetsZip, NOM_ZIP } from "@/data/kit-communication";

/**
 * La route qui sert l'archive du kit. Le test de `src/lib/zip.ts` juge le
 * format ; celui-ci juge le BRANCHEMENT : les bons fichiers, lus au bon
 * endroit, servis comme un téléchargement, au poids que la page annonce.
 */
describe("GET /kit-de-communication/" + NOM_ZIP, () => {
  it("sert un téléchargement ZIP nommé", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toBe(`attachment; filename="${NOM_ZIP}"`);
  });

  it("pèse exactement ce que la page annonce", async () => {
    const zip = new Uint8Array(await (await GET()).arrayBuffer());
    expect(zip.byteLength).toBe(octetsZip);
    // La taille seule est une tautologie (le tampon est dimensionné par le même
    // calcul) : c'est la fin de répertoire central, À SA PLACE, qui prouve
    // qu'aucun octet n'est en trop.
    expect(new DataView(zip.buffer).getUint32(zip.byteLength - 22, true)).toBe(0x06054b50);
  });

  it("contient chaque fichier du kit, à l'octet, sous son nom", async () => {
    const zip = Buffer.from(await (await GET()).arrayBuffer());
    for (const f of fichiersArchive) {
      const contenu = readFileSync(resolve(process.cwd(), "public/kit", f.fichier));
      const nom = zip.indexOf(Buffer.from(f.fichier));
      expect(nom, f.fichier).toBeGreaterThan(0);
      // En mode stocké, le contenu suit immédiatement le nom dans l'en-tête local.
      const debut = nom + Buffer.byteLength(f.fichier);
      expect(zip.subarray(debut, debut + contenu.length).equals(contenu), f.fichier).toBe(true);
    }
  });
});
