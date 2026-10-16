import { describe, it, expect } from "vitest";
import { videos, replayDe } from "@/data/videos";
import { faq } from "@/data/tremplin";
import { youtubeVignette } from "@/lib/youtube";

/**
 * Garde-fous du catalogue vidéo. Le contenu vit dans `src/data/videos.ts` et se
 * remplit au fil de la chaîne (replay du Tremplin, interviews Behind the
 * Scenes, talks filmés des speakeuses) : ces tests valent pour chaque entrée
 * ajoutée, pour qu'une vidéo mal renseignée soit attrapée avant la prod.
 */
describe("catalogue vidéo", () => {
  it("donne un identifiant unique à chaque vidéo", () => {
    const ids = videos.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("pointe chaque vidéo vers une URL YouTube en https", () => {
    for (const v of videos) {
      expect(v.url, v.title).toMatch(/^https:\/\/(www\.youtube\.com|youtu\.be)\//);
    }
  });

  it("dérive une vignette de chaque vidéo", () => {
    // Rien à déposer à la main : si l'URL est lisible, la miniature suit. Une
    // vidéo dont on ne tire aucune vignette tomberait sur la couverture de
    // repli, ce qui trahirait une URL mal collée.
    for (const v of videos) {
      expect(youtubeVignette(v.url), v.title).toMatch(/^https:\/\/i\.ytimg\.com\/vi\//);
    }
  });

  it("publie le replay de la soirée Tremplin 2026", () => {
    const replay = replayDe("devfest-toulouse", 2026);
    expect(replay?.url).toBe("https://youtu.be/Ac6rI2Bg-jE");
    expect(replay?.date).toBe("4 juin 2026");
  });

  describe("replayDe", () => {
    it("reste vide pour une édition sans replay", () => {
      expect(replayDe("devfest-toulouse", 2027)).toBeUndefined();
      expect(replayDe("une-autre-conf", 2026)).toBeUndefined();
    });
  });
});

/**
 * The Playground sert aux INSCRIPTIONS : on ne peut pas y revoir un événement.
 * La question du replay doit donc mener à une vidéo, jamais à la billetterie.
 * Le lien précis d'une édition est posé par sa page (elle seule sait de quelle
 * édition il s'agit) ; la FAQ générique se contente de la chaîne.
 */
describe("FAQ Tremplin — revoir la soirée", () => {
  const question = faq.find((f) => f.id === "replay");

  it("existe et s'annonce comme la question du replay", () => {
    expect(question?.q).toContain("revoir la soirée");
  });

  it("mène à la chaîne YouTube, pas à la billetterie", () => {
    expect(question?.lien?.href).toBe("https://www.youtube.com/@TechSpeakHer");
    expect(question?.a).toMatch(/YouTube/);
    expect(question?.a.toLowerCase()).toMatch(/inscription/);
  });
});
