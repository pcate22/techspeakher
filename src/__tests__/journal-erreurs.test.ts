// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  construireEntree,
  cheminSansRequete,
  journaliserErreur,
} from "@/lib/journal-erreurs";

/**
 * Un journal d'erreurs est un endroit où les données personnelles fuient sans
 * qu'on l'ait voulu : on y déverse « tout le contexte » pour déboguer, et on y
 * déverse au passage des cookies de session et ce que la personne a saisi.
 *
 * Ces tests gardent les deux limites, et le fait que le journal ne puisse pas
 * aggraver l'incident qu'il rapporte.
 */

let erreurs: string[];
beforeEach(() => {
  erreurs = [];
  vi.spyOn(console, "error").mockImplementation((m) => erreurs.push(String(m)));
});
afterEach(() => vi.restoreAllMocks());

describe("ce que le journal retient", () => {
  it("garde le digest : le seul pont entre le signalement d'une membre et le journal", () => {
    const e = construireEntree({ message: "Boom", digest: "a1b2c3" }, { path: "/mon-espace" });
    expect(e.digest).toBe("a1b2c3");
    expect(e.message).toBe("Boom");
    expect(e.chemin).toBe("/mon-espace");
  });

  it("garde de quoi situer la panne : route, type, méthode", () => {
    const e = construireEntree({ message: "x" }, { path: "/a", method: "POST" }, {
      routePath: "/app/mon-espace/page",
      routeType: "action",
    });
    expect(e).toMatchObject({ methode: "POST", route: "/app/mon-espace/page", typeDeRoute: "action" });
  });
});

describe("ce que le journal ne doit JAMAIS retenir", () => {
  /**
   * `request.path` inclut la chaîne de requête (« /blog?name=foo », dixit la
   * doc Next). C'est là que voyagent une adresse e-mail saisie dans un
   * formulaire, un terme de recherche, un jeton de réinitialisation.
   */
  it("coupe la chaîne de requête, où la personne a pu saisir n'importe quoi", () => {
    const e = construireEntree({ message: "x" }, { path: "/contact?email=lea@example.org&q=secret" });
    expect(e.chemin).toBe("/contact");
    expect(JSON.stringify(e)).not.toContain("lea@example.org");
    expect(JSON.stringify(e)).not.toContain("secret");
  });

  it("coupe aussi le fragment", () => {
    expect(cheminSansRequete("/page#jeton=abc")).toBe("/page");
  });

  /**
   * Le point le plus grave : les en-têtes portent le cookie de session. Les
   * journaliser publierait de quoi usurper la session d'une membre dans un
   * endroit que plusieurs personnes peuvent lire.
   */
  it("n'emporte aucun en-tête, donc aucun cookie de session", () => {
    const requeteComplete = {
      path: "/mon-espace",
      method: "GET",
      headers: {
        cookie: "authjs.session-token=JETON-SECRET",
        authorization: "Bearer AUTRE-JETON",
      },
    };
    const serialise = JSON.stringify(construireEntree({ message: "x" }, requeteComplete));
    expect(serialise).not.toContain("JETON-SECRET");
    expect(serialise).not.toContain("AUTRE-JETON");
    expect(serialise).not.toMatch(/cookie|authorization/i);
  });
});

describe("le journal n'aggrave jamais l'incident", () => {
  it("survit à une erreur absente", () => {
    expect(() => journaliserErreur(undefined)).not.toThrow();
    expect(erreurs[0]).toContain("Erreur sans message");
  });

  it("survit à une erreur non sérialisable (référence circulaire)", () => {
    const circulaire: Record<string, unknown> = { message: "boucle" };
    circulaire.moi = circulaire;
    expect(() => journaliserErreur(circulaire as never)).not.toThrow();
    expect(erreurs).toHaveLength(1);
  });

  it("écrit UNE ligne, lisible par une machine", () => {
    journaliserErreur({ message: "Boom", digest: "d1" }, { path: "/x?a=1" });
    expect(erreurs).toHaveLength(1);
    expect(erreurs[0].split("\n")).toHaveLength(1);
    const parsed = JSON.parse(erreurs[0]);
    expect(parsed).toMatchObject({ niveau: "error", digest: "d1", chemin: "/x" });
  });
});

describe("l'erreur reçue n'est pas toujours un Error", () => {
  /**
   * La doc Next prévient : « l'instance peut ne pas être l'erreur d'origine,
   * elle a pu être traitée par React ». Selon l'endroit où ça casse, on reçoit
   * un objet quelconque, une chaîne, ou rien. Le journal doit rester lisible.
   */
  it("accepte une chaîne jetée telle quelle", () => {
    expect(construireEntree("panne brute").message).toBe("panne brute");
  });

  it("ignore un champ du mauvais type au lieu de le recopier", () => {
    const e = construireEntree({ message: 42, digest: { ruse: true } });
    expect(e.message).toBe("Erreur sans message");
    expect(e.digest).toBeUndefined();
  });
});
