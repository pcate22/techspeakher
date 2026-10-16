import { describe, it, expect } from "vitest";
import {
  cleConference,
  libelleConference,
  type IdentiteConference,
} from "@/lib/agenda-conference";

/**
 * LA FACETTE « CONFÉRENCE » SE BÂTIT SUR LE REGISTRE, JAMAIS SUR LE LIBELLÉ FIGÉ.
 *
 * Constat qui a imposé cette règle (docs/audit-ux-agenda-2026-08.md §4.1) : sur
 * la prod du 16/08/2026, la MÊME journée au même endroit s'affichait sous deux
 * libellés, « DevFest Toulouse » (4 fois) et « DevFest » (3 fois), et deux
 * conférences portaient leur année dans le nom (« Devoxx France 2025 »,
 * « Agile Tour Bordeaux (ATBX) 2026 »). Une facette construite sur cette chaîne
 * listerait quatre entrées pour trois événements, et mentirait au premier clic.
 *
 * `talk_occurrences.conference` est un SNAPSHOT de saisie ; le lien canonique
 * est `conference_id → conferences`. Ces deux fonctions tranchent une fois pour
 * toutes, au bord (§7 des principes : normaliser au point de lecture, pas dans
 * chaque vue).
 */

/** Raccourci de lisibilité : une occurrence rattachée au registre. */
const auRegistre = (
  slug: string,
  nom: string,
  snapshot: string | null,
): IdentiteConference => ({ slug, nom, snapshot });

/** Une occurrence en texte libre, jamais rattachée. */
const texteLibre = (snapshot: string | null): IdentiteConference => ({
  slug: null,
  nom: null,
  snapshot,
});

describe("cleConference — la clé de regroupement", () => {
  it("vient du REGISTRE dès qu'il existe, quel que soit le libellé figé", () => {
    // Le cas de la prod : deux saisies divergentes, une seule conférence.
    const a = auRegistre("devfest-toulouse", "DevFest Toulouse", "DevFest Toulouse");
    const b = auRegistre("devfest-toulouse", "DevFest Toulouse", "DevFest");
    expect(cleConference(a)).toBe(cleConference(b));
    expect(cleConference(a)).toBe("devfest-toulouse");
  });

  it("ignore le libellé figé même quand il porte une année", () => {
    const a = auRegistre("devoxx-france", "Devoxx France", "Devoxx France 2025");
    const b = auRegistre("devoxx-france", "Devoxx France", "Devoxx France 2026");
    expect(cleConference(a)).toBe(cleConference(b));
  });

  it("SANS registre, retombe sur le libellé figé, replié et sans son année", () => {
    // Repli : il ne rapproche que ce qui est vraiment le même texte. Il ne
    // devine pas que « DevFest » et « DevFest Toulouse » sont la même chose —
    // seul le registre le sait.
    expect(cleConference(texteLibre("Devoxx France 2025"))).toBe(
      cleConference(texteLibre("Devoxx  France")),
    );
    expect(cleConference(texteLibre("MiXiT"))).toBe(cleConference(texteLibre("mixit")));
    expect(cleConference(texteLibre("DevFest"))).not.toBe(
      cleConference(texteLibre("DevFest Toulouse")),
    );
  });

  it("une clé de repli ne peut jamais entrer en collision avec un slug de registre", () => {
    // Le cas qui mord : un libellé libre qui se REPLIE EXACTEMENT sur un slug
    // existant. Sans espace de noms distinct, cette occurrence se rangerait
    // dans la facette du registre sans y être rattachée — et le décompte de la
    // facette compterait des scènes qui n'en sont pas.
    //
    // (Première version de ce test : « DevFest Toulouse » contre le slug
    // « devfest-toulouse ». Elle passait même en retirant le préfixe, puisque
    // l'espace et le tiret suffisaient à les distinguer. Un test qu'on ne casse
    // pas ne garde rien — cf. docs/principes-tests.md.)
    const repli = cleConference(texteLibre("Devfest-Toulouse"));
    const registre = cleConference(auRegistre("devfest-toulouse", "DevFest Toulouse", null));
    expect(repli).not.toBe(registre);
  });

  it("aucune conférence renseignée : aucune clé (la scène reste hors facette)", () => {
    expect(cleConference(texteLibre(null))).toBeNull();
    expect(cleConference(texteLibre("   "))).toBeNull();
  });
});

describe("libelleConference — ce qu'on affiche dans la facette", () => {
  it("préfère le nom du registre au libellé figé", () => {
    expect(
      libelleConference(auRegistre("devfest-toulouse", "DevFest Toulouse", "DevFest")),
    ).toBe("DevFest Toulouse");
  });

  it("sans registre, garde le libellé tel que la speakeuse l'a saisi, sans son année", () => {
    // On retire l'année parce qu'une facette nomme une CONFÉRENCE, pas une
    // édition : « Devoxx France 2025 » et « Devoxx France 2026 » sont la même
    // entrée de filtre. Le reste du texte est laissé intact.
    expect(libelleConference(texteLibre("Devoxx France 2025"))).toBe("Devoxx France");
    expect(libelleConference(texteLibre("Agile Tour Bordeaux (ATBX) 2026"))).toBe(
      "Agile Tour Bordeaux (ATBX)",
    );
    expect(libelleConference(texteLibre("  MiXiT  "))).toBe("MiXiT");
  });

  it("laisse tranquille un nom dont le nombre final n'est PAS une année", () => {
    // Un cliquet contre l'excès de zèle : « Web2Day » garde son 2, et une
    // édition numérotée reste lisible.
    expect(libelleConference(texteLibre("Web2Day"))).toBe("Web2Day");
    expect(libelleConference(texteLibre("Sunny Tech 42"))).toBe("Sunny Tech 42");
  });

  it("aucune conférence renseignée : aucun libellé", () => {
    expect(libelleConference(texteLibre(null))).toBeNull();
  });
});
