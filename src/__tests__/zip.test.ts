// @vitest-environment node
import { describe, it, expect } from "vitest";
import { crc32, creerZip, tailleZip } from "@/lib/zip";

/**
 * L'archive du kit de communication s'écrit sans dépendance (`src/lib/zip.ts`).
 * Ce que ces tests tiennent : un ZIP qu'un décompresseur ouvre, c'est-à-dire
 * des empreintes justes, des en-têtes cohérents entre eux, et un répertoire
 * central qui pointe au bon octet.
 *
 * L'empreinte est jugée contre des valeurs PUBLIÉES (vecteurs de référence du
 * CRC-32 IEEE), pas contre notre propre calcul : un test qui relit l'archive
 * avec la même fonction qui l'a écrite validerait n'importe quelle erreur.
 */

const texte = (s: string) => new TextEncoder().encode(s);

/** Relit les entrées d'un ZIP « stocké » à partir de son répertoire central. */
function lireZip(zip: Uint8Array) {
  const vue = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const fin = zip.byteLength - 22;
  expect(vue.getUint32(fin, true)).toBe(0x06054b50);
  const nb = vue.getUint16(fin + 10, true);
  let pos = vue.getUint32(fin + 16, true);
  const entrees: { nom: string; contenu: Uint8Array; crc: number }[] = [];
  for (let i = 0; i < nb; i++) {
    expect(vue.getUint32(pos, true)).toBe(0x02014b50);
    const crc = vue.getUint32(pos + 16, true);
    const taille = vue.getUint32(pos + 20, true);
    const lgNom = vue.getUint16(pos + 28, true);
    const local = vue.getUint32(pos + 42, true);
    const nom = new TextDecoder().decode(zip.subarray(pos + 46, pos + 46 + lgNom));
    // L'en-tête local doit dire la même chose que le répertoire central.
    expect(vue.getUint32(local, true)).toBe(0x04034b50);
    expect(vue.getUint32(local + 14, true)).toBe(crc);
    const debut = local + 30 + vue.getUint16(local + 26, true);
    entrees.push({ nom, crc, contenu: zip.subarray(debut, debut + taille) });
    pos += 46 + lgNom;
  }
  return entrees;
}

describe("crc32", () => {
  it("donne les valeurs de référence du CRC-32 IEEE", () => {
    expect(crc32(texte(""))).toBe(0);
    expect(crc32(texte("123456789"))).toBe(0xcbf43926);
    expect(crc32(texte("The quick brown fox jumps over the lazy dog"))).toBe(0x414fa339);
  });
});

describe("creerZip", () => {
  const fichiers = [
    { nom: "a.txt", contenu: texte("bonjour") },
    { nom: "dossier/b.bin", contenu: new Uint8Array([0, 255, 1, 254]) },
  ];

  it("restitue chaque fichier, à l'octet, sous son nom", () => {
    const entrees = lireZip(creerZip(fichiers));
    expect(entrees.map((e) => e.nom)).toEqual(["a.txt", "dossier/b.bin"]);
    expect(Array.from(entrees[0].contenu)).toEqual(Array.from(texte("bonjour")));
    expect(Array.from(entrees[1].contenu)).toEqual([0, 255, 1, 254]);
  });

  it("porte l'empreinte de chaque contenu", () => {
    const [a] = lireZip(creerZip(fichiers));
    // Valeur de référence calculée hors de ce module (zlib.crc32 de Node).
    expect(a.crc).toBe(0xa5b6f0c8);
  });

  it("annonce sa taille exacte d'avance (affichée sur la page)", () => {
    const tailles = fichiers.map((f) => ({ nom: f.nom, octets: f.contenu.byteLength }));
    expect(creerZip(fichiers).byteLength).toBe(tailleZip(tailles));
  });

  it("est reproductible : mêmes fichiers, mêmes octets", () => {
    expect(Array.from(creerZip(fichiers))).toEqual(Array.from(creerZip(fichiers)));
  });
});
