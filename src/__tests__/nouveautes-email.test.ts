import { describe, it, expect } from "vitest";
import { buildNouveautesEmail } from "@/lib/nouveautes-email";
import {
  A_VENIR,
  BLOCS_NOUVEAUTES,
  NOUVEAUTES_PLATEFORME,
  ET_AUSSI,
} from "@/data/nouveautes-plateforme";

/**
 * L'e-mail d'annonce des nouveautés, en DEUX versions (avec fiche / sans
 * fiche). On tient ici ce qui distingue les deux (l'invitation à ouvrir sa
 * fiche) et ce qui doit être vrai des deux (les nouveautés, le motif de
 * réception, la forme positive du wording).
 */
describe("buildNouveautesEmail", () => {
  const versions = ["sans-fiche", "avec-fiche"] as const;

  it.each(versions)("version %s : salue par le prénom", (version) => {
    const { htmlContent, textContent } = buildNouveautesEmail({
      name: "Marie Curie",
      version,
    });
    expect(htmlContent).toMatch(/Salut Marie,/);
    expect(textContent).toMatch(/Salut Marie,/);
  });

  it.each(versions)("version %s : sans nom, salue quand même", (version) => {
    const { htmlContent } = buildNouveautesEmail({ name: null, version });
    expect(htmlContent).toMatch(/Salut,/);
  });

  it.each(versions)("version %s : liste toutes les nouveautés", (version) => {
    const { htmlContent, textContent } = buildNouveautesEmail({
      name: "A",
      version,
    });
    for (const n of NOUVEAUTES_PLATEFORME) {
      expect(htmlContent).toContain(n.titre);
      expect(htmlContent).toContain(n.texte);
      expect(textContent).toContain(n.titre);
    }
    for (const a of ET_AUSSI) {
      expect(htmlContent).toContain(a.texte);
    }
  });

  it("version sans-fiche : invite à ouvrir sa fiche, en tête", () => {
    const { subject, htmlContent } = buildNouveautesEmail({
      name: "A",
      version: "sans-fiche",
    });
    expect(subject).toMatch(/fiche/i);
    expect(htmlContent).toMatch(/Ouvrir ma fiche/);
    expect(htmlContent).toContain("https://techspeakher.fr/mon-espace/fiche");
    // L'invitation est le premier geste proposé : avant les nouveautés.
    expect(htmlContent.indexOf("Ouvrir ma fiche")).toBeLessThan(
      htmlContent.indexOf(NOUVEAUTES_PLATEFORME[0].titre),
    );
  });

  it("version avec-fiche : annonce les nouveautés, sans inviter à créer une fiche", () => {
    const { subject, htmlContent } = buildNouveautesEmail({
      name: "A",
      version: "avec-fiche",
    });
    expect(subject).toMatch(/nouveautés/i);
    expect(htmlContent).not.toMatch(/Ouvrir ma fiche/);
    expect(htmlContent).toMatch(/Ouvrir mon espace/);
  });

  it.each(versions)(
    "version %s : dit pourquoi on reçoit ce message et comment l'arrêter",
    (version) => {
      const { htmlContent } = buildNouveautesEmail({ name: "A", version });
      expect(htmlContent).toMatch(/compte sur techspeakher\.fr/i);
      // La promesse du canal : le marketing se refuse, le service continue.
      expect(htmlContent).toMatch(/désinscription/i);
      expect(htmlContent).toMatch(/continuent d'arriver/i);
    },
  );

  it.each(versions)(
    "version %s : les captures d'écran sont servies par notre domaine, avec une alternative",
    (version) => {
      const { htmlContent } = buildNouveautesEmail({ name: "A", version });
      const images = [...htmlContent.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
      const attendues = NOUVEAUTES_PLATEFORME.filter((n) => n.image);
      expect(images).toHaveLength(attendues.length);
      for (const img of images) {
        expect(img).toMatch(/src="https:\/\/techspeakher\.fr\//);
        expect(img).toMatch(/alt="[^"]+"/);
      }
    },
  );

  it.each(versions)("version %s : wording à la forme positive", (version) => {
    const { subject, htmlContent, textContent } = buildNouveautesEmail({
      name: "A",
      version,
    });
    for (const texte of [subject, htmlContent, textContent]) {
      // Règle projet : « ne … pas », « ne … plus » interdits (CLAUDE.md).
      expect(texte).not.toMatch(/\bne\s+\w+\s+(?:pas|plus)\b/i);
      expect(texte).not.toMatch(/\bn'\w+\s+(?:pas|plus)\b/i);
      // Pas de cadratin dans le contenu affiché.
      expect(texte).not.toContain("—");
    }
  });

  it.each(versions)("version %s : range les nouveautés par bloc, chacun annoncé", (version) => {
    const { htmlContent, textContent } = buildNouveautesEmail({ name: "A", version });
    for (const bloc of BLOCS_NOUVEAUTES) {
      expect(htmlContent).toContain(bloc.titre);
      expect(textContent).toContain(bloc.titre.toUpperCase());
      if (bloc.intro) expect(htmlContent).toContain(bloc.intro);
      // Chaque nouveauté suit le titre de SON bloc : le tri qu'on promet à la
      // lectrice tombe à l'eau si une nouveauté remonte au-dessus.
      for (const n of bloc.nouveautes) {
        expect(htmlContent.indexOf(bloc.titre)).toBeLessThan(htmlContent.indexOf(n.titre));
      }
    }
  });

  it.each(versions)("version %s : annonce ce qui arrive, dans les deux formats", (version) => {
    const { htmlContent, textContent } = buildNouveautesEmail({ name: "A", version });
    expect(htmlContent).toContain("À venir");
    for (const a of A_VENIR) {
      expect(htmlContent).toContain(a.texte);
      expect(textContent).toContain(a.texte);
    }
  });

  it.each(versions)("version %s : une brève sans lien reste du texte, une brève avec lien est un lien", (version) => {
    // Les DEUX branches, pour chaque brève : un filtre sur les seules brèves
    // sans lien tournait à vide le jour où il n'en restait aucune (15/10/2026).
    const { htmlContent } = buildNouveautesEmail({ name: "A", version });
    expect(A_VENIR.length).toBeGreaterThan(0);
    for (const a of A_VENIR) {
      if (a.lien === null) {
        // Aucun clic promis vers une page qui n'existe pas encore.
        expect(htmlContent).toContain(`<li style="margin-bottom:6px">${a.texte}</li>`);
      } else {
        expect(htmlContent).toMatch(new RegExp(`<a href="[^"]*${a.lien}"[^>]*>${a.texte}</a>`));
      }
    }
  });

  it.each(versions)("version %s : l'objet annonce le nombre réel de nouveautés", (version) => {
    const { subject } = buildNouveautesEmail({ name: "A", version });
    expect(subject).toContain(`${NOUVEAUTES_PLATEFORME.length} nouveautés`);
  });

  it.each(versions)("version %s : un lien externe part tel quel", (version) => {
    const { htmlContent } = buildNouveautesEmail({ name: "A", version });
    for (const a of ET_AUSSI) {
      const attendu = a.lien.startsWith("http") ? a.lien : `https://techspeakher.fr${a.lien}`;
      expect(htmlContent).toContain(`href="${attendu}"`);
    }
  });

  it.each(versions)("version %s : un texte brut lisible accompagne le HTML", (version) => {
    const { textContent } = buildNouveautesEmail({ name: "A", version });
    expect(textContent).not.toContain("<");
    expect(textContent).toContain("https://techspeakher.fr/mon-espace");
  });
});
