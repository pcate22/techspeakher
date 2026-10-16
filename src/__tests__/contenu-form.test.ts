import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { parseContenuForm } from "@/lib/contenu-form";
import { SLUGS_RESERVES } from "@/data/slugs-reserves";
import { cheminInterne } from "@/lib/contenus";
import { isSafeInternalPath } from "@/components/ExternalLink";

/** Construit un FormData à partir d'un objet simple. */
function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("parseContenuForm", () => {
  it("accepte une publication minimale (titre + chapô, corps vide)", () => {
    const r = parseContenuForm(fd({ type: "publication", titre: "Mon actu", chapo: "Court résumé." }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.type).toBe("publication");
      expect(r.data.titre).toBe("Mon actu");
      expect(r.data.corps).toBe("");
    }
  });

  it("accepte un article avec corps Markdown", () => {
    const r = parseContenuForm(fd({ type: "publication", titre: "Article", corps: "## Titre\n\nDu texte." }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.corps).toContain("## Titre");
  });

  it("refuse un titre vide", () => {
    const r = parseContenuForm(fd({ type: "publication", titre: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.titre).toBeTruthy();
  });

  it("refuse un titre sans caractère alphanumérique (slug vide)", () => {
    const r = parseContenuForm(fd({ type: "publication", titre: "!!! ???" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.titre).toBeTruthy();
  });

  it("accepte le lien d'une vidéo YouTube", () => {
    const r = parseContenuForm(
      fd({ type: "publication", titre: "Interview", videoUrl: "https://youtu.be/Ac6rI2Bg-jE" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.videoUrl).toBe("https://youtu.be/Ac6rI2Bg-jE");
  });

  it("laisse la vidéo vide quand le champ est absent", () => {
    const r = parseContenuForm(fd({ type: "publication", titre: "Interview" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.videoUrl).toBeNull();
  });

  it("refuse un lien vidéo dont on ne peut pas tirer de miniature", () => {
    // Page de chaîne, autre hébergeur : le bloc vidéo serait muet.
    for (const videoUrl of [
      "https://www.youtube.com/@TechSpeakHer",
      "https://vimeo.com/123456",
    ]) {
      const r = parseContenuForm(fd({ type: "publication", titre: "Interview", videoUrl }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.videoUrl).toBeTruthy();
    }
  });

  it("exige un texte alternatif quand une image est fournie", () => {
    const r = parseContenuForm(
      fd({ type: "publication", titre: "Avec image", imageUrl: "https://ex.com/a.jpg", imageAlt: "" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.imageAlt).toBeTruthy();
  });

  it("accepte une image avec son texte alternatif", () => {
    const r = parseContenuForm(
      fd({ type: "publication", titre: "Avec image", imageUrl: "https://ex.com/a.jpg", imageAlt: "Une scène" }),
    );
    expect(r.ok).toBe(true);
  });

  describe("taille de l'image (migration 065)", () => {
    const avecImage = (extra: Record<string, string> = {}) =>
      fd({
        type: "publication",
        titre: "Avec image",
        imageUrl: "https://ex.com/a.jpg",
        imageAlt: "Une scène",
        ...extra,
      });

    it("retient la taille mesurée au dépôt", () => {
      const r = parseContenuForm(avecImage({ imageWidth: "1080", imageHeight: "1350" }));
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data.imageWidth).toBe(1080);
        expect(r.data.imageHeight).toBe(1350);
      }
    });

    it("une taille absente reste inconnue (image d'avant la mesure)", () => {
      const r = parseContenuForm(avecImage());
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data.imageWidth).toBeNull();
        expect(r.data.imageHeight).toBeNull();
      }
    });

    it("une taille aberrante est ignorée plutôt que de déformer la page", () => {
      // Valeur mesurée par le NAVIGATEUR : le serveur la borne. Une dimension
      // seule ne dit aucune proportion, elle part avec l'autre.
      for (const cas of [
        { imageWidth: "0", imageHeight: "10" },
        { imageWidth: "-5", imageHeight: "10" },
        { imageWidth: "12.5", imageHeight: "10" },
        { imageWidth: "999999", imageHeight: "10" },
        { imageWidth: "abc", imageHeight: "10" },
        { imageWidth: "1080", imageHeight: "" },
      ]) {
        const r = parseContenuForm(avecImage(cas));
        expect(r.ok).toBe(true);
        if (r.ok) {
          expect(r.data.imageWidth).toBeNull();
          expect(r.data.imageHeight).toBeNull();
        }
      }
    });

    it("sans image, aucune taille ne subsiste", () => {
      const r = parseContenuForm(
        fd({ type: "publication", titre: "Sans image", imageWidth: "800", imageHeight: "600" }),
      );
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data.imageWidth).toBeNull();
        expect(r.data.imageHeight).toBeNull();
      }
    });
  });

  it("refuse une catégorie hors liste", () => {
    const r = parseContenuForm(fd({ type: "publication", titre: "X", categorie: "Bidon" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.categorie).toBeTruthy();
  });

  it("accepte le type page", () => {
    const r = parseContenuForm(fd({ type: "page", titre: "Plan du site", corps: "Texte." }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.type).toBe("page");
  });

  it("accepte un lien interne commençant par /", () => {
    const r = parseContenuForm(fd({ type: "publication", titre: "Annonce", lien: "/tremplin" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.lien).toBe("/tremplin");
  });

  it("refuse un lien interne sans / de tête (URL cassée sinon)", () => {
    const r = parseContenuForm(fd({ type: "publication", titre: "Annonce", lien: "tremplin" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.lien).toBeTruthy();
  });

  it("refuse un lien protocol-relative // (navigation externe déguisée)", () => {
    const r = parseContenuForm(fd({ type: "publication", titre: "Annonce", lien: "//evil.com" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.lien).toBeTruthy();
  });

  it("conferenceEditionId absent ou vide → null", () => {
    const sans = parseContenuForm(fd({ type: "publication", titre: "Sans conf" }));
    expect(sans.ok && sans.data.conferenceEditionId).toBeNull();
    const vide = parseContenuForm(fd({ type: "publication", titre: "Vide", conferenceEditionId: "" }));
    expect(vide.ok && vide.data.conferenceEditionId).toBeNull();
  });

  it("conferenceEditionId numérique → entier", () => {
    const r = parseContenuForm(fd({ type: "publication", titre: "Rattachée", conferenceEditionId: "42" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.conferenceEditionId).toBe(42);
  });

  it("refuse un conferenceEditionId non entier positif", () => {
    const zero = parseContenuForm(fd({ type: "publication", titre: "X", conferenceEditionId: "0" }));
    expect(zero.ok).toBe(false);
    const texte = parseContenuForm(fd({ type: "publication", titre: "Y", conferenceEditionId: "abc" }));
    expect(texte.ok).toBe(false);
  });
});

/**
 * Deux sujets relevés en revue de sécurité et de conception, corrigés à leur
 * racine plutôt qu'au bord.
 */
describe("cheminInterne — un lien interne reste sur le site", () => {
  it("garantit le « / » de tête (donnée d'avant la garde du formulaire)", () => {
    expect(cheminInterne("tremplin")).toBe("/tremplin");
    expect(cheminInterne("/tremplin")).toBe("/tremplin");
  });

  it("désamorce une URL protocol-relative déguisée en chemin", () => {
    // « //evil.test » n'est PAS un chemin : le navigateur y lit un HÔTE, et la
    // palette comme les cartes emmèneraient la visiteuse hors du site.
    expect(cheminInterne("//evil.test/phishing")).toBe("/evil.test/phishing");
    // Même piège avec une contre-oblique, que les navigateurs assimilent à « / ».
    expect(cheminInterne("/\\evil.test")).toBe("/evil.test");
    expect(cheminInterne("\\\\evil.test")).toBe("/evil.test");
  });

  it("rend toujours un chemin que isSafeInternalPath accepte", () => {
    for (const brut of ["tremplin", "/tremplin", "//evil.test", "/\\evil.test", "///a"]) {
      expect(isSafeInternalPath(cheminInterne(brut))).toBe(true);
    }
  });
});

describe("slugs réservés — une page doit être atteignable", () => {
  it("refuse une page dont le slug est déjà servi par une route du code", () => {
    // Next sert la route codée en priorité : la page vivrait en base, publiée,
    // sans jamais s'afficher. On le dit à la saisie plutôt que de la laisser
    // disparaître en silence.
    const r = parseContenuForm(fd({ type: "page", titre: "À propos" }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // Le message NOMME l'adresse : le slug est un champ caché, et sans elle
      // l'orga cherche une page homonyme qui n'existe pas dans l'admin.
      expect(Object.values(r.errors).join(" ")).toContain("/a-propos");
      expect(Object.values(r.errors).join(" ")).toContain("Choisis un autre titre");
    }
  });

  it("laisse passer un slug libre", () => {
    expect(parseContenuForm(fd({ type: "page", titre: "Plan du site" })).ok).toBe(true);
  });

  it("ne contraint que les pages, pas les publications", () => {
    // Une publication vit sous /articles/… : aucune collision possible.
    expect(parseContenuForm(fd({ type: "publication", titre: "À propos" })).ok).toBe(true);
  });
});

describe("SLUGS_RESERVES suit les routes réelles", () => {
  it("couvre chaque segment racine servi par src/app", () => {
    // Garde anti-dérive : ajouter une route sans l'inscrire ici rouvrirait le
    // trou. La liste se vérifie contre le disque, elle ne se maintient pas à vue.
    const servis = readdirSync("src/app", { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      // Segments qui ne produisent PAS d'URL d'un niveau : l'attrape-tout, les
      // dossiers privés `_x`, les groupes de routes `(x)` et les routes
      // parallèles `@x` — les exiger dans la liste serait un échec à tort.
      .filter((n) => n !== "[slug]" && !/^[_(@]/.test(n));
    // Sans ce garde-fou, une liste vide ferait passer la boucle sans rien
    // vérifier : le test resterait vert en ne testant plus rien.
    expect(servis.length).toBeGreaterThan(5);
    for (const segment of servis) expect(SLUGS_RESERVES).toContain(segment);
  });
});
