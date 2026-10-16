import { describe, it, expect } from "vitest";
import { estControleNext } from "@/lib/next-errors";

/**
 * `redirect()` et `notFound()` de Next voyagent comme des exceptions : un
 * `catch` large qui les avale casse la navigation, en silence. Le test porte
 * sur un détail INTERNE de Next (le format du digest) — d'où une seule copie,
 * et des cas qui disent ce qu'on relaie et ce qu'on garde.
 */
describe("estControleNext : ce qui est de la navigation, pas une panne", () => {
  it("une redirection est du contrôle (elle doit traverser)", () => {
    expect(
      estControleNext({ digest: "NEXT_REDIRECT;replace;/connexion;307;" }),
    ).toBe(true);
  });

  it("un notFound aussi", () => {
    expect(estControleNext({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" })).toBe(true);
  });

  it("une vraie panne reste une panne (c'est elle qu'on veut attraper)", () => {
    expect(estControleNext(new Error("fetch failed"))).toBe(false);
    // Next masque les erreurs serveur derrière un digest OPAQUE : sans le
    // préfixe, ce n'est pas de la navigation.
    expect(estControleNext({ digest: "3471795564" })).toBe(false);
  });

  it("rien du tout se lit sans casser (null, undefined, chaîne)", () => {
    expect(estControleNext(null)).toBe(false);
    expect(estControleNext(undefined)).toBe(false);
    expect(estControleNext("NEXT_REDIRECT")).toBe(false);
    expect(estControleNext({ digest: 42 })).toBe(false);
  });
});
