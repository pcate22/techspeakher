import { describe, it, expect } from "vitest";
import { parseImport, parseDateLibre } from "@/lib/import-talks";
import { TITRE_MAX, DESCRIPTION_MAX } from "@/lib/talk-limits";

/**
 * Parseur d'import de talks (JSON + CSV) — la moitié PURE de l'import : du
 * texte vers des talks groupés, sans base ni réseau. Tolérant entrée par
 * entrée (une ligne bancale est sautée et comptée, jamais fatale au lot —
 * modèle `mapSessionizeEvent`), strict sur le lot (format inconnu, fichier
 * trop grand → erreur claire).
 *
 * Le cas réel qui a dicté le contrat : l'export Notist d'Aurélie Vache — un
 * même titre donné à N conférences doit devenir UN talk à N occurrences,
 * pas N fiches en doublon (c'est le modèle de données du site).
 */

describe("parseImport — JSON", () => {
  it("tableau plat (clés anglaises) : titres, événements, dates relayés", () => {
    const r = parseImport(
      JSON.stringify([
        {
          title: "Understanding Kubernetes in a visual way",
          event: "Devoxx Belgium 2025",
          date: "2025-10-06",
          city: "Anvers",
          url: "https://devoxx.be",
        },
      ]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks).toEqual([
      {
        titre: "Understanding Kubernetes in a visual way",
        description: null,
        occurrences: [
          {
            conference: "Devoxx Belgium 2025",
            date: "2025-10-06",
            ville: "Anvers",
            pays: null,
            lien: "https://devoxx.be",
            evenementNotist: null,
          },
        ],
      },
    ]);
    expect(r.ignorees).toBe(0);
  });

  it("clés françaises (titre, conference, ville, lien) reconnues aussi", () => {
    const r = parseImport(
      JSON.stringify([
        { titre: "Mon talk", conference: "Cloud Nord", annee: 2025, ville: "Lille" },
      ]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks[0].occurrences[0]).toMatchObject({
      conference: "Cloud Nord",
      date: "2025",
      ville: "Lille",
    });
  });

  it("enveloppes { data: [...] } et { attributes: {...} } (style API Notist) dépliées", () => {
    const r = parseImport(
      JSON.stringify({
        data: [
          {
            type: "presentations",
            attributes: {
              title: "TinyGo, petit mais costaud !",
              event: "DevFest Toulouse",
              "presented-on": "2024-11-14",
            },
          },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks[0].titre).toBe("TinyGo, petit mais costaud !");
    expect(r.talks[0].occurrences[0]).toMatchObject({
      conference: "DevFest Toulouse",
      date: "2024-11-14",
    });
  });

  /**
   * LE FICHIER RÉEL d'Aurélie Vache (noti.st/aurelievache.json, 16/08/2026) :
   * la racine `data` porte l'AUTRICE, ses 178 présentations sont nichées dans
   * `relationships.data`. Sans ce dépliage, l'import lisait le `name` de
   * l'autrice comme un titre et créait UN talk « Aurélie » — silencieusement,
   * sans la moindre erreur. C'est la vérification qui manquait pour dire
   * « oui, elle peut importer » : le format documenté ne suffisait pas.
   */
  it("export Notist d'un PROFIL : les présentations nichées sont lues, jamais le nom de l'autrice", () => {
    const r = parseImport(
      JSON.stringify({
        data: [
          {
            type: "authors",
            id: "au_VaYawj",
            attributes: { username: "aurelievache", name: "Aurélie", full_name: "Aurélie Vache" },
            relationships: {
              data: [
                {
                  type: "presentations",
                  id: "pr_ljA50B",
                  attributes: {
                    title: "Understanding Kubernetes in a visual way",
                    presented_on: "2026-07-09 14:00:00",
                  },
                },
                {
                  type: "presentations",
                  id: "pr_EBTwg5",
                  attributes: {
                    title: "Questions pour un conteneur",
                    presented_on: "2026-07-06 08:00:00",
                  },
                },
              ],
            },
          },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks.map((t) => t.titre)).toEqual([
      "Understanding Kubernetes in a visual way",
      "Questions pour un conteneur",
    ]);
    // Le prénom de l'autrice n'est JAMAIS devenu un talk.
    expect(r.talks.some((t) => t.titre === "Aurélie")).toBe(false);
    // L'heure est coupée : le site stocke une date, pas un horaire.
    expect(r.talks[0].occurrences[0]).toMatchObject({ date: "2026-07-09" });
  });

  /**
   * Le fichier Notist ne NOMME pas les conférences : chaque présentation porte
   * un lien `links.event` vers la fiche de l'événement. Le parseur relaie l'ID
   * de cet événement pour que l'action aille chercher le nom (chantier
   * PR #326) — sans lui, 178 scènes arrivaient sans conférence.
   */
  it("export Notist : l'id d'événement (links.event) est relayé sur l'occurrence", () => {
    const r = parseImport(
      JSON.stringify({
        data: [
          {
            type: "authors",
            attributes: { name: "Aurélie" },
            relationships: {
              data: [
                {
                  type: "presentations",
                  attributes: { title: "Talk A", presented_on: "2026-07-09 14:00:00" },
                  links: { event: "https://noti.st/events/4bUppk.json" },
                },
                {
                  type: "presentations",
                  attributes: { title: "Talk B", event: "Conf nommée" },
                  links: { event: "https://autre-site.example/x.json" },
                },
              ],
            },
          },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks[0].occurrences[0].evenementNotist).toBe("4bUppk");
    // Un lien qui a un autre hôte que noti.st est écarté (jamais suivi).
    expect(r.talks[1].occurrences[0].evenementNotist).toBeNull();
  });

  /**
   * Repro d'un finding externe (16/08) : dans un fichier MIXTE, un seul
   * élément à `relationships.data` faisait jeter tout le premier niveau —
   * deux talks disparaissaient en silence, ignorees restait à 0.
   */
  it("fichier MIXTE : les présentations nichées s'AJOUTENT au premier niveau, rien n'est jeté", () => {
    const r = parseImport(
      JSON.stringify({
        data: [
          { title: "Talk plat 1", event: "Conf A" },
          {
            type: "authors",
            attributes: { name: "Aurélie" },
            relationships: {
              data: [{ type: "presentations", attributes: { title: "Talk niché" } }],
            },
          },
          { title: "Talk plat 2", event: "Conf B" },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks.map((t) => t.titre).sort()).toEqual([
      "Talk niché",
      "Talk plat 1",
      "Talk plat 2",
    ]);
  });

  it("autrice SANS présentation (relationships.data vide) : aucun talk à son prénom", () => {
    const r = parseImport(
      JSON.stringify({
        data: [
          { type: "authors", attributes: { name: "Aurélie" }, relationships: { data: [] } },
          { title: "Talk réel", event: "Conf A" },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks.map((t) => t.titre)).toEqual(["Talk réel"]);
  });

  it("enveloppe { presentations: [...] } dépliée aussi", () => {
    const r = parseImport(
      JSON.stringify({ presentations: [{ title: "Talk A", event: "Conf A" }] }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks).toHaveLength(1);
  });

  it("MÊME titre à N conférences → UN talk, N occurrences (le cas Notist réel)", () => {
    const r = parseImport(
      JSON.stringify([
        { title: "Understanding Kubernetes in a visual way", event: "Devoxx Belgium", date: "2025-10" },
        { title: "Understanding Kubernetes in a visual way ", event: "Sunny Tech", date: "2025-06" },
        { title: "UNDERSTANDING KUBERNETES IN A VISUAL WAY", event: "KCD Porto", date: "2025-11" },
      ]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks).toHaveLength(1);
    expect(r.talks[0].occurrences.map((o) => o.conference)).toEqual([
      "Devoxx Belgium",
      "Sunny Tech",
      "KCD Porto",
    ]);
  });

  it("entrée sans titre : sautée et comptée, le lot continue", () => {
    const r = parseImport(
      JSON.stringify([{ event: "Conf sans titre" }, { title: "Talk valide" }]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks).toHaveLength(1);
    expect(r.ignorees).toBe(1);
  });

  it("titre hors borne : entrée sautée et comptée (ce qui EST importé est valide)", () => {
    const r = parseImport(
      JSON.stringify([{ title: "A".repeat(TITRE_MAX + 1) }, { title: "OK" }]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks.map((t) => t.titre)).toEqual(["OK"]);
    expect(r.ignorees).toBe(1);
  });

  it("titre sans occurrence → sujet proposé (zéro occurrence), pas une erreur", () => {
    const r = parseImport(JSON.stringify([{ title: "Une idée de talk" }]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks[0].occurrences).toEqual([]);
  });

  it("description reprise et bornée à DESCRIPTION_MAX", () => {
    const r = parseImport(
      JSON.stringify([
        { title: "T", description: "B".repeat(DESCRIPTION_MAX + 50), event: "C" },
      ]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks[0].description).toHaveLength(DESCRIPTION_MAX);
  });

  it("un lien qui a un autre protocole que http(s) est écarté du champ lien", () => {
    const r = parseImport(
      JSON.stringify([{ title: "T", event: "C", url: "javascript:alert(1)" }]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks[0].occurrences[0].lien).toBeNull();
  });
});

describe("parseImport — CSV", () => {
  it("en-têtes français : titre;conference;date;ville;pays;lien", () => {
    const r = parseImport(
      [
        "titre,conference,date,ville,pays,lien",
        'Mon talk,Cloud Nord,2025-10-03,Lille,France,https://cloudnord.fr',
      ].join("\n"),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks[0]).toMatchObject({
      titre: "Mon talk",
      occurrences: [
        {
          conference: "Cloud Nord",
          date: "2025-10-03",
          ville: "Lille",
          pays: "France",
          lien: "https://cloudnord.fr",
        },
      ],
    });
  });

  it("en-têtes anglais (title,event,date,city,country,url) reconnus", () => {
    const r = parseImport(
      ["title,event,date", "My talk,DevFest Toulouse,November 2024"].join("\n"),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks[0].occurrences[0]).toMatchObject({
      conference: "DevFest Toulouse",
      date: "2024-11",
    });
  });

  it("champs entre guillemets : virgules et retours à la ligne INTERNES préservés", () => {
    const r = parseImport(
      [
        "titre,conference,description",
        '"Kubernetes, en visuel","Devoxx, Belgium","Ligne 1',
        'Ligne 2"',
      ].join("\n"),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks[0].titre).toBe("Kubernetes, en visuel");
    expect(r.talks[0].occurrences[0].conference).toBe("Devoxx, Belgium");
    expect(r.talks[0].description).toBe("Ligne 1\nLigne 2");
  });

  it("le point-virgule (export tableur FR) sépare aussi", () => {
    const r = parseImport(
      ["titre;conference;annee", "Mon talk;Cloud Nord;2025"].join("\n"),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks[0].occurrences[0]).toMatchObject({
      conference: "Cloud Nord",
      date: "2025",
    });
  });

  it("CSV à UNE colonne (juste « titre ») suffit — la promesse de la page", () => {
    const r = parseImport(["titre", "Mon talk", "Mon autre talk"].join("\n"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks.map((t) => t.titre)).toEqual(["Mon talk", "Mon autre talk"]);
  });

  /**
   * Repro d'un finding externe (16/08) : un « " » isolé en MILIEU de champ
   * (« Écran 5" pouces ») avalait tout le reste du fichier — un talk poubelle
   * créé, les suivants perdus, zéro ignorée. RFC 4180 : le mode guillemets ne
   * s'ouvre qu'en DÉBUT de champ ; ailleurs, c'est un caractère comme un autre.
   */
  it('un « " » isolé en milieu de champ reste un caractère : rien n\'est avalé', () => {
    const r = parseImport(
      [
        "titre,conference",
        'Écran 5" pouces,Conf A',
        "Talk suivant,Conf B",
      ].join("\n"),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks.map((t) => t.titre)).toEqual(['Écran 5" pouces', "Talk suivant"]);
  });

  it("un champ CITÉ précédé d'espaces (« titre, \"a, b\" ») se lit comme avant", () => {
    const r = parseImport(
      ["titre,conference", 'Mon titre, "Cloud Nord, édition spéciale"'].join("\n"),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.talks[0].occurrences[0].conference).toBe("Cloud Nord, édition spéciale");
  });

  it("CSV sans colonne titre → erreur claire (le lot entier est irrecevable)", () => {
    const r = parseImport(["conference,date", "Cloud Nord,2025"].join("\n"));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreur).toMatch(/titre/i);
  });
});

describe("parseImport — garde-fous du lot", () => {
  it("texte qui n'est ni JSON ni CSV → erreur claire, jamais une exception", () => {
    const r = parseImport("bonjour, ceci est une phrase.");
    expect(r.ok).toBe(false);
  });

  it("texte vide → erreur claire", () => {
    expect(parseImport("   ").ok).toBe(false);
  });

  it("plus de 300 entrées → erreur claire (protéger l'écran et la base)", () => {
    const beaucoup = Array.from({ length: 301 }, (_, i) => ({ title: `T${i}` }));
    const r = parseImport(JSON.stringify(beaucoup));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreur).toMatch(/300/);
  });

  it("JSON qui n'est pas une liste d'objets → erreur claire", () => {
    expect(parseImport('{"bonjour": 1}').ok).toBe(false);
    expect(parseImport("[1, 2, 3]").ok).toBe(false);
  });
});

describe("parseDateLibre — les formats rencontrés dans les exports", () => {
  const cas: Array<[string, string | null]> = [
    ["2025-10-06", "2025-10-06"],
    ["2025-10", "2025-10"],
    ["2025", "2025"],
    ["July 2026", "2026-07"],
    ["november 2025", "2025-11"],
    ["juillet 2026", "2026-07"],
    ["Décembre 2025", "2025-12"],
    ["12/07/2026", "2026-07-12"],
    ["06 Oct 2025", "2025-10-06"],
    // Notist date ses présentations à l'heure près : on garde le jour.
    ["2026-07-09 14:00:00", "2026-07-09"],
    ["2026-07-09T14:00:00Z", "2026-07-09"],
    ["October 6, 2025", "2025-10-06"],
    ["", null],
    ["bientôt", null],
    // Hors bornes du site (buildTalkDate) : rejetée plutôt que fausse.
    ["1817", null],
  ];
  it.each(cas)("« %s » → %s", (entree, attendu) => {
    expect(parseDateLibre(entree)).toBe(attendu);
  });
});
