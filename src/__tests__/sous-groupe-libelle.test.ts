import { describe, it, expect } from "vitest";
import { libelleSousGroupe, libelleCoachs } from "@/lib/sous-groupe-libelle";

/**
 * Un sous-groupe n'a PAS de nom. Retour orga : « Ils n'ont pas besoin de noms,
 * juste les participantes au sous groupe et éventuellement une ou plusieurs
 * coachs dedans ».
 *
 * C'est juste, et ça règle un vrai problème : on nommait « Binôme 1 », « Binôme
 * 2 »… donc l'écran affichait des étiquettes qui ne disaient rien, et il fallait
 * ouvrir chaque groupe pour savoir qui était dedans. Le sous-groupe se DÉSIGNE
 * désormais par qui le compose — un libellé dérivé, jamais saisi, donc jamais
 * en désaccord avec son contenu.
 */

describe("libelleSousGroupe — le groupe se nomme par qui est dedans", () => {
  it("un duo se lit comme on le dit", () => {
    expect(libelleSousGroupe(["Léa Dubois", "Manon Girard"], 1)).toBe(
      "Léa Dubois et Manon Girard",
    );
  });

  it("un trio : des virgules, puis « et » pour la dernière", () => {
    expect(libelleSousGroupe(["Léa", "Manon", "Yasmine"], 1)).toBe("Léa, Manon et Yasmine");
  });

  it("une seule participante (point individuel avec sa coach)", () => {
    expect(libelleSousGroupe(["Léa Dubois"], 2)).toBe("Léa Dubois");
  });

  /**
   * Un groupe fraîchement créé n'a personne : il faut quand même pouvoir le
   * désigner pour l'ouvrir et le composer. Son RANG sert d'étiquette, à la forme
   * positive — jamais « sans nom » ni « groupe vide ».
   */
  it("un groupe encore à composer se désigne par son rang", () => {
    expect(libelleSousGroupe([], 3)).toBe("Sous-groupe 3");
    expect(libelleSousGroupe([], 1)).toBe("Sous-groupe 1");
  });

  it("les noms vides ne créent pas de virgules orphelines", () => {
    expect(libelleSousGroupe(["Léa", "", "Manon"], 1)).toBe("Léa et Manon");
    expect(libelleSousGroupe(["", ""], 4)).toBe("Sous-groupe 4");
  });

  /**
   * TOUS les membres sont nommés. On avait borné à trois pour tenir sur une
   * rangée mobile, et la quatrième participante d'un groupe n'était alors nommée
   * nulle part — sur l'écran qui sert justement à savoir qui est dedans.
   */
  it("une liste longue nomme TOUT LE MONDE, sans écourter", () => {
    const r = libelleSousGroupe(["Ada", "Grace", "Hedy", "Katherine", "Radia"], 1);
    for (const nom of ["Ada", "Grace", "Hedy", "Katherine", "Radia"]) {
      expect(r).toContain(nom);
    }
    expect(r).toBe("Ada, Grace, Hedy, Katherine et Radia");
  });
});

describe("libelleCoachs — une, plusieurs, ou autonome", () => {
  it("une coach", () => {
    expect(libelleCoachs(["Sofia Nguyen"])).toBe("Sofia Nguyen");
  });

  it("plusieurs coachs : la base n'en acceptait qu'une, l'orga en veut plusieurs", () => {
    expect(libelleCoachs(["Sofia Nguyen", "Lucile Martin"])).toBe(
      "Sofia Nguyen et Lucile Martin",
    );
  });

  /**
   * « Autonome » est un état NORMAL d'un sous-groupe (revue croisée entre
   * speakeuses), pas un manque : on le dit à la forme positive, sans alerte.
   */
  it("aucune coach : autonome, et c'est un état normal", () => {
    expect(libelleCoachs([])).toBe("Autonome");
    expect(libelleCoachs(["", ""])).toBe("Autonome");
  });
});
