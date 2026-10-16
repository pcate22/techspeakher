// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { resolve } from "node:path";
import {
  declinaisonsLogo,
  fichiersKit,
  fichiersArchive,
  modelesKit,
  couleursKit,
  poidsLisible,
  reglesLogo,
} from "@/data/kit-communication";

/**
 * Le kit de communication décrit des fichiers qu'il ne fabrique pas : ils sont
 * déposés à la main dans `public/kit/`. Ce que la page AFFICHE (poids,
 * dimensions, codes couleur) doit donc être confronté au disque et aux
 * tokens, sinon un logo remplacé laisse la page annoncer l'ancien.
 */

const DOSSIER = resolve(process.cwd(), "public/kit");

/** Largeur × hauteur lues dans l'en-tête IHDR d'un PNG. */
function dimensionsPng(chemin: string): [number, number] {
  const octets = readFileSync(chemin);
  expect(octets.subarray(1, 4).toString("latin1")).toBe("PNG");
  return [octets.readUInt32BE(16), octets.readUInt32BE(20)];
}

describe("Kit de communication — fichiers", () => {
  it("chaque fichier annoncé existe, avec le poids et les dimensions affichés", () => {
    for (const f of fichiersKit) {
      const chemin = resolve(DOSSIER, f.fichier);
      expect(statSync(chemin).size, f.fichier).toBe(f.octets);
      expect(dimensionsPng(chemin), f.fichier).toEqual([f.largeur, f.hauteur]);
    }
  });

  it("aucun fichier ne porte de métadonnées (auteur, identifiants Canva…)", () => {
    // Les exports Canva embarquent un bloc XMP : nom de l'autrice, identifiants
    // de compte et de design. Un fichier fait pour être redistribué n'en garde
    // aucun — seuls restent les blocs qui dessinent l'image.
    for (const f of fichiersKit) {
      const octets = readFileSync(resolve(DOSSIER, f.fichier));
      const blocs: string[] = [];
      for (let i = 8; i < octets.length; i += 12 + octets.readUInt32BE(i)) {
        blocs.push(octets.subarray(i + 4, i + 8).toString("latin1"));
      }
      expect(blocs.filter((b) => ["tEXt", "iTXt", "zTXt", "eXIf"].includes(b)), f.fichier).toEqual([]);
    }
  });

  it("chaque fichier déposé dans public/kit est proposé sur la page", () => {
    const annonces = fichiersArchive.map((f) => f.fichier).sort();
    expect(readdirSync(DOSSIER).filter((n) => !n.startsWith(".")).sort()).toEqual(annonces);
  });

  it("les noms de fichier disent la marque, la déclinaison et le fond", () => {
    for (const f of fichiersKit) {
      expect(f.fichier).toMatch(/^tech-speakher-(logo-complet|icone)-fond-(sombre|clair)\.(png|svg)$/);
    }
  });

  it("chaque aperçu décrit le fichier, au-delà du seul mot « logo »", () => {
    for (const d of declinaisonsLogo) {
      expect(d.alt.length, d.id).toBeGreaterThan(60);
      expect(d.alt, d.id).toMatch(/fond/);
    }
  });

  it("un emplacement vide reste visible : le format manquant est listé, sans fichier", () => {
    const vides = declinaisonsLogo.flatMap((d) => d.formats.filter((f) => !f.fichier));
    expect(vides.map((f) => f.format)).toContain("SVG");
  });
});

/** Les entrées d'un .pptx (une archive ZIP), décompressées. */
function entreesPptx(chemin: string): Map<string, Buffer> {
  const zip = readFileSync(chemin);
  const fin = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let pos = zip.readUInt32LE(fin + 16);
  const entrees = new Map<string, Buffer>();
  for (let i = 0; i < zip.readUInt16LE(fin + 10); i++) {
    const methode = zip.readUInt16LE(pos + 10);
    // Stocké ou « deflate » seulement : sinon on scannerait des octets
    // compressés, et la garde de confidentialité passerait pour rien.
    expect([0, 8]).toContain(methode);
    const taille = zip.readUInt32LE(pos + 20);
    const lgNom = zip.readUInt16LE(pos + 28);
    const local = zip.readUInt32LE(pos + 42);
    const nom = zip.subarray(pos + 46, pos + 46 + lgNom).toString("utf8");
    const debut = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const brut = zip.subarray(debut, debut + taille);
    entrees.set(nom, methode === 8 ? inflateRawSync(brut) : brut);
    pos += 46 + lgNom + zip.readUInt16LE(pos + 30) + zip.readUInt16LE(pos + 32);
  }
  return entrees;
}

describe("Kit de communication — modèle de présentation", () => {
  for (const m of modelesKit) {
    const chemin = resolve(DOSSIER, m.fichier);

    it(`${m.fichier} : le poids et le nombre de diapositives affichés`, () => {
      expect(statSync(chemin).size).toBe(m.octets);
      const diapos = [...entreesPptx(chemin).keys()].filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
      expect(diapos).toHaveLength(m.diapositives);
    });

    it(`${m.fichier} : aucun chemin local ni nom de personne dans le fichier`, () => {
      // L'original portait, en texte alternatif de ses logos, un chemin
      // Windows avec le nom complet de l'autrice : lu à voix haute par un
      // lecteur d'écran, visible de toute personne qui télécharge.
      // TOUTES les parties, images comprises : l'export Canva de la
      // présentation portait le nom de l'autrice et ses identifiants Canva
      // dans le bloc XMP d'un PNG, invisible depuis le XML des diapositives.
      for (const [nom, contenu] of entreesPptx(chemin)) {
        const texte = contenu.toString("latin1");
        expect(texte, nom).not.toMatch(/[A-Z]:\\Users\\|\/Users\/|PUCCETTI|Cateline|Canva doc=|user=U[\w-]{10}/i);
      }
    });
  }
});

describe("Kit de communication — couleurs", () => {
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

  it("chaque code affiché est celui du token du site", () => {
    for (const c of couleursKit) {
      const m = css.match(new RegExp(`--color-${c.token}:\\s*(#[0-9a-fA-F]{6})`));
      expect(m, `token ${c.token} absent de globals.css`).not.toBeNull();
      expect(c.hex.toLowerCase(), c.nom).toBe(m![1].toLowerCase());
    }
  });
});

describe("Kit de communication — règles du logo", () => {
  it("reprend la taille minimale et la zone de protection de tokens.json", () => {
    const tokens = JSON.parse(
      readFileSync(resolve(process.cwd(), "public/brand/tokens.json"), "utf8"),
    );
    const texte = reglesLogo.aFaire.join(" ");
    const px = tokens.logo.min_size.web.$value.replace("px", "");
    const mm = tokens.logo.min_size.print.$value.replace("mm", "");
    expect(texte).toMatch(new RegExp(`${px}\\s*px`));
    expect(texte).toMatch(new RegExp(`${mm}\\s*mm`));
    expect(tokens.logo.protection.$value).toMatch(/« T »/);
    expect(texte).toMatch(/«\s*T\s*»/);
  });
});

describe("poidsLisible", () => {
  it("écrit le poids en ko, à la française", () => {
    expect(poidsLisible(123_714)).toBe("124 ko");
    expect(poidsLisible(1_234_567)).toBe("1,2 Mo");
  });
});
