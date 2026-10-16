import { describe, it, expect } from "vitest";
import { youtubeId, youtubeVignette } from "@/lib/youtube";

/**
 * Extraction de l'identifiant d'une vidéo YouTube. L'URL vient de l'éditeur
 * (saisie orga) : on n'accepte que les hôtes YouTube et un identifiant au
 * format attendu, pour ne jamais fabriquer une URL de vignette à partir d'une
 * entrée quelconque.
 */
describe("youtubeId", () => {
  it.each([
    ["https://youtu.be/Ac6rI2Bg-jE", "Ac6rI2Bg-jE"],
    ["https://www.youtube.com/watch?v=Ac6rI2Bg-jE", "Ac6rI2Bg-jE"],
    ["https://youtube.com/watch?v=Ac6rI2Bg-jE", "Ac6rI2Bg-jE"],
    ["https://m.youtube.com/watch?v=Ac6rI2Bg-jE", "Ac6rI2Bg-jE"],
    ["https://www.youtube.com/embed/Ac6rI2Bg-jE", "Ac6rI2Bg-jE"],
    ["https://www.youtube.com/live/Ac6rI2Bg-jE", "Ac6rI2Bg-jE"],
    ["https://www.youtube.com/shorts/Ac6rI2Bg-jE", "Ac6rI2Bg-jE"],
  ])("lit l'identifiant de %s", (url, id) => {
    expect(youtubeId(url)).toBe(id);
  });

  it("ignore les paramètres qui suivent", () => {
    expect(youtubeId("https://youtu.be/Ac6rI2Bg-jE?t=42")).toBe("Ac6rI2Bg-jE");
    expect(youtubeId("https://www.youtube.com/watch?v=Ac6rI2Bg-jE&list=PLx")).toBe(
      "Ac6rI2Bg-jE",
    );
  });

  it("accepte l'espace autour de l'URL", () => {
    expect(youtubeId("  https://youtu.be/Ac6rI2Bg-jE  ")).toBe("Ac6rI2Bg-jE");
  });

  it.each([
    ["une URL vide", ""],
    ["un autre hébergeur", "https://vimeo.com/123456"],
    ["un hôte qui imite YouTube", "https://youtube.com.evil.test/watch?v=Ac6rI2Bg-jE"],
    ["un sous-domaine pirate", "https://evil-youtube.com/watch?v=Ac6rI2Bg-jE"],
    ["un schéma dangereux", "javascript:alert(1)"],
    ["une chaîne YouTube", "https://www.youtube.com/@TechSpeakHer"],
    ["un identifiant trop court", "https://youtu.be/abc"],
    ["un identifiant avec un caractère interdit", "https://youtu.be/Ac6rI2Bg-j."],
    ["du texte libre", "regarde la vidéo"],
  ])("reste vide pour %s", (_cas, url) => {
    expect(youtubeId(url)).toBeNull();
  });
});

describe("youtubeVignette", () => {
  it("construit l'URL de la miniature de la vidéo", () => {
    // `hqdefault` est la seule taille présente pour toutes les vidéos ; le
    // recadrage 16/9 côté carte enlève ses bandes noires.
    expect(youtubeVignette("https://youtu.be/Ac6rI2Bg-jE")).toBe(
      "https://i.ytimg.com/vi/Ac6rI2Bg-jE/hqdefault.jpg",
    );
  });

  it("reste vide quand l'URL n'est pas une vidéo YouTube", () => {
    expect(youtubeVignette("https://vimeo.com/123456")).toBeNull();
  });
});
