// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { isMissingTable } from "@/lib/pg-errors";

/**
 * Intégration BDD des contenus éditoriaux (lot 2) : une table `contenus`
 * polymorphe (publication = article/actualité + page). Vrai Postgres (PGlite)
 * + db/schema.sql, comme les autres tests d'intégration. Vérifie l'unicité de
 * slug, l'exclusion des brouillons en lecture publique, le tri, la pose de
 * publie_le à la publication, et l'exclusion des publications sans corps de la
 * liste d'articles.
 */
const h = vi.hoisted(() => {
  const holder: { db: import("@electric-sql/pglite").PGlite | null } = { db: null };
  const pool = {
    query: async (text: string, params?: unknown[]) => {
      const r = await holder.db!.query(text, params);
      return { ...r, rowCount: (r as { affectedRows?: number }).affectedRows };
    },
  };
  return { holder, pool };
});
vi.mock("@/lib/db", () => ({
  pool: h.pool,
  // Transactions du lot N4 (purges de réactions) : même base mockée.
  withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn(h.pool),
  // Le helper du lot N4 : même sémantique, sur la base mockée (la table
  // fil_reactions existe dans le schéma des tests — la branche repli reste couverte
  // par pg-errors).
  withTransactionSaufTable: async (
    _t: string,
    fn: (q: unknown, avec: boolean) => Promise<unknown>,
  ) => fn(h.pool, true),
}));

import {
  createContenu,
  updateContenu,
  setStatut,
  deleteContenu,
  getContenuById,
  getContenuBySlug,
  getContenuPublieBySlug,
  getAideSlidesHref,
  getPublishedArticleByConferenceEdition,
  AIDE_SLIDES_TITRE,
  listContenus,
  listPublications,
  listPublicationsRecentes,
  listArticlesPublies,
  listPagesPubliees,
  listContenusPourRecherche,
  RECHERCHE_MAX_CONTENUS,
  RECHERCHE_CORPS_MAX,
  type ContenuInput,
} from "@/lib/contenus";
import { seedContenus } from "@/lib/contenus-seed";
import { destinationContenu } from "@/lib/carte-actu";

beforeAll(async () => {
  h.holder.db = new PGlite();
  await h.holder.db.exec(fs.readFileSync("db/schema.sql", "utf8"));
}, 60_000);
beforeEach(async () => {
  // Table volontairement absente dans la suite « migration en attente » : le
  // TRUNCATE n'a alors rien à vider, on ignore CE cas précis (42P01) et rien
  // d'autre — une vraie panne de TRUNCATE doit rester visible.
  await h.holder.db!.exec("TRUNCATE contenus RESTART IDENTITY CASCADE").catch((e) => {
    if (!isMissingTable(e)) throw e;
  });
});

function publication(over: Partial<ContenuInput> = {}): ContenuInput {
  return {
    type: "publication",
    titre: "Titre",
    chapo: "Chapô",
    corps: "",
    imageUrl: null,
    imageAlt: null,
    imageWidth: null,
    imageHeight: null,
    videoUrl: null,
    categorie: "Communauté",
    tag: "Passé",
    lien: null,
    lienExterne: null,
    lienLabel: null,
    conferenceEditionId: null,
    ...over,
  };
}

/**
 * Conférence + édition de la référence, renvoie l'id d'édition. Idempotent
 * (le beforeEach ne vide que `contenus`, pas la référence) : select-or-insert,
 * pour rester rejouable malgré l'unique (conference_id, annee).
 */
async function seedEdition(): Promise<number> {
  await h.holder.db!.query(
    `INSERT INTO conferences (slug, nom, type, ville, pays)
     VALUES ('devfest-toulouse', 'DevFest Toulouse', 'conference', 'Toulouse', 'France')
     ON CONFLICT (slug) DO NOTHING`,
  );
  const existant = await h.holder.db!.query(
    `SELECT e.id FROM conference_editions e
       JOIN conferences c ON c.id = e.conference_id
      WHERE c.slug = 'devfest-toulouse' AND e.annee = 2026`,
  );
  if (existant.rows.length > 0) return (existant.rows[0] as { id: number }).id;
  const { rows } = await h.holder.db!.query(
    `INSERT INTO conference_editions (conference_id, annee, date_debut)
     SELECT id, 2026, '2026-11-19' FROM conferences WHERE slug = 'devfest-toulouse'
     RETURNING id`,
  );
  return (rows[0] as { id: number }).id;
}

describe("contenus — écritures", () => {
  it("crée une publication en brouillon, slug dérivé du titre", async () => {
    const r = await createContenu(publication({ titre: "Ma Première Actu" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.slug).toBe("ma-premiere-actu");
      const c = await getContenuById(r.id);
      expect(c?.statut).toBe("brouillon");
      expect(c?.publieLe).toBeNull();
    }
  });

  it("refuse un slug déjà pris (deux titres au même slug)", async () => {
    await createContenu(publication({ titre: "DevFest Toulouse" }));
    const dup = await createContenu(publication({ titre: "DevFest  Toulouse" }));
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.reason).toBe("slug");
  });

  it("publie : pose publie_le à la date du jour pour une publication", async () => {
    const r = await createContenu(publication({ titre: "À publier" }));
    if (!r.ok) throw new Error("création KO");
    await setStatut(r.id, "publie");
    const c = await getContenuById(r.id);
    expect(c?.statut).toBe("publie");
    expect(c?.publieLe).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("met à jour et change le slug quand le titre change", async () => {
    const r = await createContenu(publication({ titre: "Ancien" }));
    if (!r.ok) throw new Error("création KO");
    const up = await updateContenu(r.id, publication({ titre: "Nouveau Titre" }));
    expect(up.ok).toBe(true);
    if (up.ok) expect(up.slug).toBe("nouveau-titre");
  });

  it("garde la taille de l'image d'un bout à l'autre (migration 065)", async () => {
    // Aller-retour complet : colonnes du schéma, paramètres d'écriture et
    // `COLS` en lecture. C'est ce qui permet de réserver la place de la photo
    // en tête d'article.
    const r = await createContenu(
      publication({
        titre: "Illustré",
        imageUrl: "https://x.example/p.png",
        imageAlt: "Une scène",
        imageWidth: 1080,
        imageHeight: 1350,
      }),
    );
    if (!r.ok) throw new Error("création KO");
    expect(await getContenuById(r.id)).toMatchObject({ imageWidth: 1080, imageHeight: 1350 });

    // Retirer l'image emporte sa taille : aucune mesure orpheline en base.
    await updateContenu(r.id, publication({ titre: "Illustré" }));
    expect(await getContenuById(r.id)).toMatchObject({
      imageUrl: null,
      imageWidth: null,
      imageHeight: null,
    });
  });

  it("une image sans taille reste lisible (déposée avant la mesure)", async () => {
    const r = await createContenu(
      publication({ titre: "Ancien visuel", imageUrl: "https://x.example/a.png", imageAlt: "Alt" }),
    );
    if (!r.ok) throw new Error("création KO");
    expect(await getContenuById(r.id)).toMatchObject({
      imageUrl: "https://x.example/a.png",
      imageWidth: null,
      imageHeight: null,
    });
  });

  it("refuse un renommage vers un slug déjà pris", async () => {
    await createContenu(publication({ titre: "Occupé" }));
    const r = await createContenu(publication({ titre: "Libre" }));
    if (!r.ok) throw new Error("création KO");
    const up = await updateContenu(r.id, publication({ titre: "Occupé" }));
    expect(up.ok).toBe(false);
    if (!up.ok) expect(up.reason).toBe("slug");
  });

  it("supprime un contenu", async () => {
    const r = await createContenu(publication({ titre: "À supprimer" }));
    if (!r.ok) throw new Error("création KO");
    await deleteContenu(r.id);
    expect(await getContenuById(r.id)).toBeNull();
  });
});

describe("contenus — lectures publiques", () => {
  it("getContenuBySlug renvoie le contenu quel que soit le statut (édition orga)", async () => {
    const r = await createContenu(publication({ titre: "Brouillon éditable" }));
    if (!r.ok) throw new Error("création KO");
    const c = await getContenuBySlug(r.slug);
    expect(c?.titre).toBe("Brouillon éditable");
    expect(c?.statut).toBe("brouillon");
    expect(await getContenuBySlug("slug-inexistant")).toBeNull();
  });

  it("getContenuPublieBySlug ignore les brouillons", async () => {
    const r = await createContenu(publication({ titre: "Brouillon" }));
    if (!r.ok) throw new Error("création KO");
    expect(await getContenuPublieBySlug(r.slug)).toBeNull();
    await setStatut(r.id, "publie");
    expect((await getContenuPublieBySlug(r.slug))?.titre).toBe("Brouillon");
  });

  it("listPublications exclut les brouillons et trie par date décroissante", async () => {
    const a = await createContenu(publication({ titre: "Ancien" }));
    const b = await createContenu(publication({ titre: "Recent" }));
    const c = await createContenu(publication({ titre: "Brouillon reste caché" }));
    if (!a.ok || !b.ok || !c.ok) throw new Error("création KO");
    // publie a puis b avec des dates explicites (sinon même CURRENT_DATE)
    await h.holder.db!.query("UPDATE contenus SET statut='publie', publie_le=$2 WHERE id=$1", [a.id, "2026-01-01"]);
    await h.holder.db!.query("UPDATE contenus SET statut='publie', publie_le=$2 WHERE id=$1", [b.id, "2026-06-01"]);
    const list = await listPublications();
    expect(list.map((p) => p.titre)).toEqual(["Recent", "Ancien"]);
  });

  it("listPublicationsRecentes borne la liste en SQL et n'emporte pas le corps", async () => {
    // L'extrait de l'accueil : 4 cartes, pas toute la table — et surtout pas les
    // 50 000 caractères de corps qu'il n'affiche jamais. Seule la PRÉSENCE d'un
    // corps compte (elle décide de la destination de la carte).
    const corps = "## Titre\n\n" + "x".repeat(5_000);
    for (const [i, titre] of ["A", "B", "C"].entries()) {
      const r = await createContenu(publication({ titre, corps }));
      if (!r.ok) throw new Error("création KO");
      await h.holder.db!.query("UPDATE contenus SET statut='publie', publie_le=$2 WHERE id=$1", [
        r.id,
        `2026-0${i + 1}-01`,
      ]);
    }
    const recentes = await listPublicationsRecentes(2);
    // Les 2 plus récentes, récentes d'abord.
    expect(recentes.map((p) => p.titre)).toEqual(["C", "B"]);
    // Le corps est réduit : la carte sait qu'il y en a un, sans le transporter.
    for (const p of recentes) {
      expect(p.corps.trim()).not.toBe("");
      expect(p.corps.length).toBe(1);
    }
    // Une annonce sans corps reste reconnaissable comme telle.
    const annonce = await createContenu(publication({ titre: "Annonce", corps: "" }));
    if (!annonce.ok) throw new Error("création KO");
    await h.holder.db!.query("UPDATE contenus SET statut='publie', publie_le=$2 WHERE id=$1", [
      annonce.id,
      "2026-12-01",
    ]);
    expect((await listPublicationsRecentes(1))[0]?.corps.trim()).toBe("");
  });

  it("listPublicationsRecentes avecDestination : les publications SANS destination sortent en SQL (invariant du fil)", async () => {
    // Le fil charge `limite` entrées par source : une publication sans corps,
    // sans lien interne et sans lien externe serait écartée APRÈS coup
    // (`entreePublication` → null) et volerait sa place à une datée-liée plus
    // ancienne — le « résultat faux dès qu'une source domine » que la
    // conception §3.3 interdit. Le filtre doit donc partir en SQL.
    const morte = await createContenu(publication({ titre: "Sans destination", corps: "" }));
    const liee = await createContenu(
      publication({ titre: "Annonce liée", corps: "", lienExterne: "https://exemple.org/x" }),
    );
    const article = await createContenu(publication({ titre: "Article", corps: "## Corps" }));
    if (!morte.ok || !liee.ok || !article.ok) throw new Error("création KO");
    // La sans-destination est la PLUS récente : sans filtre SQL, elle prendrait
    // l'unique place demandée.
    for (const [id, date] of [
      [morte.id, "2026-12-03"],
      [liee.id, "2026-12-02"],
      [article.id, "2026-12-01"],
    ] as const) {
      await h.holder.db!.query(
        "UPDATE contenus SET statut='publie', publie_le=$2 WHERE id=$1",
        [id, date],
      );
    }

    const pourFil = await listPublicationsRecentes(2, { avecDestination: true });
    expect(pourFil.map((p) => p.titre)).toEqual(["Annonce liée", "Article"]);
    // Sans l'option, le comportement de l'accueil reste inchangé.
    const pourAccueil = await listPublicationsRecentes(2);
    expect(pourAccueil.map((p) => p.titre)).toEqual(["Sans destination", "Annonce liée"]);
  });

  it("avecDestination reste le MIROIR de destinationContenu (garde anti-dérive)", async () => {
    // Le filtre SQL doit vivre en SQL (avant le LIMIT), mais sa règle a une
    // source de vérité : destinationContenu (carte-actu.ts). Ce test DÉRIVE
    // l'attendu de la fonction au lieu de le récrire : si la règle gagne un
    // cas (nouveau champ, précédence changée) sans que le SQL suive, il tombe.
    const cas: { titre: string; over: Partial<ContenuInput> }[] = [
      { titre: "Corps seul", over: { corps: "## Corps" } },
      { titre: "Corps blanc", over: { corps: "   " } },
      { titre: "Lien interne seul", over: { lien: "/agenda" } },
      {
        titre: "Lien externe seul",
        over: { lienExterne: "https://exemple.org/x", lienLabel: "Voir" },
      },
      { titre: "Sans rien", over: {} },
    ];
    for (const [i, c] of cas.entries()) {
      const r = await createContenu(publication({ corps: "", ...c.over, titre: c.titre }));
      if (!r.ok) throw new Error("création KO");
      await h.holder.db!.query(
        "UPDATE contenus SET statut='publie', publie_le=$2 WHERE id=$1",
        [r.id, `2026-11-0${i + 1}`],
      );
    }

    const filtres = (await listPublicationsRecentes(10, { avecDestination: true })).map(
      (p) => p.titre,
    );
    const attendus = (await listPublicationsRecentes(10))
      .filter(
        (p) =>
          destinationContenu({
            type: p.type,
            slug: p.slug,
            titre: p.titre,
            aCorps: p.corps.trim() !== "",
            lien: p.lien,
            lienExterne: p.lienExterne,
            lienLabel: p.lienLabel,
          }).href !== null,
      )
      .map((p) => p.titre);
    expect(filtres).toEqual(attendus);
    expect(attendus).toEqual(["Lien externe seul", "Lien interne seul", "Corps seul"]);
  });

  it("listPublicationsRecentes avecDestination : une publication publiée sans date sort aussi", async () => {
    const sansDate = await createContenu(
      publication({ titre: "Sans date", corps: "## Corps" }),
    );
    if (!sansDate.ok) throw new Error("création KO");
    await h.holder.db!.query(
      "UPDATE contenus SET statut='publie', publie_le=NULL WHERE id=$1",
      [sansDate.id],
    );
    expect(await listPublicationsRecentes(3, { avecDestination: true })).toEqual([]);
  });

  it("listArticlesPublies exclut les publications sans corps", async () => {
    const lien = await createContenu(publication({ titre: "Annonce lien", corps: "" }));
    const article = await createContenu(publication({ titre: "Vrai article", corps: "## Contenu" }));
    if (!lien.ok || !article.ok) throw new Error("création KO");
    await setStatut(lien.id, "publie");
    await setStatut(article.id, "publie");
    const arts = await listArticlesPublies();
    expect(arts.map((a) => a.titre)).toEqual(["Vrai article"]);
  });

  it("listPagesPubliees écarte une page masquée par une route du code", async () => {
    // Sinon le sitemap annonce un second /a-propos, sur une URL qui sert la
    // route codée et non le contenu de la page.
    const r = await createContenu(publication({ type: "page", titre: "À propos" }));
    if (!r.ok) throw new Error("création KO");
    await h.holder.db!.query("UPDATE contenus SET statut='publie' WHERE id=$1", [r.id]);
    expect((await listPagesPubliees()).map((p) => p.slug)).not.toContain("a-propos");
  });

  it("listPagesPubliees ne renvoie que les pages publiées", async () => {
    const page = await createContenu(publication({ type: "page", titre: "Plan du site", corps: "Texte", categorie: null, tag: null }));
    const pub = await createContenu(publication({ titre: "Une actu" }));
    if (!page.ok || !pub.ok) throw new Error("création KO");
    await setStatut(page.id, "publie");
    await setStatut(pub.id, "publie");
    const pages = await listPagesPubliees();
    expect(pages.map((p) => p.slug)).toEqual(["plan-du-site"]);
  });
});

describe("contenus — flux RSS (au_flux)", () => {
  it("une publication créée est AU flux par défaut (true)", async () => {
    const r = await createContenu(publication({ titre: "Nouvelle actu" }));
    if (!r.ok) throw new Error("création KO");
    expect((await getContenuById(r.id))?.auFlux).toBe(true);
  });

  it("le seed importe les actus historiques HORS flux (au_flux=false), et est idempotent", async () => {
    const n = await seedContenus();
    expect(n).toBeGreaterThan(0);
    const pubs = await listPublications();
    expect(pubs.length).toBe(n);
    // Tout l'historique seedé est hors flux (pas de repost LinkedIn).
    expect(pubs.every((p) => p.auFlux === false)).toBe(true);
    expect(pubs.every((p) => p.statut === "publie")).toBe(true);
    // Rejouable : rien de nouveau au 2e passage.
    expect(await seedContenus()).toBe(0);
  });
});

describe("contenus — rattachement à une édition de conférence (040)", () => {
  it("crée un article rattaché à une édition et le relit", async () => {
    const editionId = await seedEdition();
    const r = await createContenu(
      publication({ titre: "DevFest 2026", corps: "## Programme", conferenceEditionId: editionId }),
    );
    if (!r.ok) throw new Error("création KO");
    expect((await getContenuById(r.id))?.conferenceEditionId).toBe(editionId);
  });

  it("met à jour le rattachement (poser puis retirer)", async () => {
    const editionId = await seedEdition();
    const r = await createContenu(publication({ titre: "Rattachable" }));
    if (!r.ok) throw new Error("création KO");
    expect((await getContenuById(r.id))?.conferenceEditionId).toBeNull();
    await updateContenu(r.id, publication({ titre: "Rattachable", conferenceEditionId: editionId }));
    expect((await getContenuById(r.id))?.conferenceEditionId).toBe(editionId);
    await updateContenu(r.id, publication({ titre: "Rattachable", conferenceEditionId: null }));
    expect((await getContenuById(r.id))?.conferenceEditionId).toBeNull();
  });

  it("supprimer l'édition remet le rattachement à NULL (ON DELETE SET NULL)", async () => {
    const editionId = await seedEdition();
    const r = await createContenu(
      publication({ titre: "Survivant", conferenceEditionId: editionId }),
    );
    if (!r.ok) throw new Error("création KO");
    await h.holder.db!.query("DELETE FROM conference_editions WHERE id = $1", [editionId]);
    const c = await getContenuById(r.id);
    expect(c).not.toBeNull();
    expect(c?.conferenceEditionId).toBeNull();
  });
});

/**
 * Le RÉCIT d'une conférence répertoriée : c'est ce mécanisme qui remplace le
 * texte en dur des pages. Deux surfaces s'y branchent (la page de la conférence
 * et celle de l'édition du Tremplin qui s'y tient), donc ce qu'il renvoie — et
 * ce qu'il refuse de renvoyer — décide de ce qui s'affiche publiquement.
 */
describe("contenus — le récit rattaché à une conférence répertoriée", () => {
  it("rend le titre et le chapô, de quoi faire une accroche sans ouvrir l'article", async () => {
    const editionId = await seedEdition();
    const r = await createContenu(
      publication({
        titre: "DevFest Toulouse 2025 : ça a marché !",
        chapo: "Le DevFest nous a ouvert sa salle des communautés.",
        corps: "Salle pleine.",
        conferenceEditionId: editionId,
      }),
    );
    if (!r.ok) throw new Error("création KO");
    await setStatut(r.id, "publie");

    expect(await getPublishedArticleByConferenceEdition(editionId)).toEqual({
      slug: "devfest-toulouse-2025-ca-a-marche",
      titre: "DevFest Toulouse 2025 : ça a marché !",
      chapo: "Le DevFest nous a ouvert sa salle des communautés.",
    });
  });

  it("un brouillon reste invisible : la vitrine ne montre rien tant que ce n'est pas publié", async () => {
    const editionId = await seedEdition();
    const r = await createContenu(
      publication({ titre: "Pas encore prêt", corps: "En cours.", conferenceEditionId: editionId }),
    );
    if (!r.ok) throw new Error("création KO");

    expect(await getPublishedArticleByConferenceEdition(editionId)).toBeNull();
  });

  it("une publication sans corps ne fait pas un récit (le lien mènerait à une page vide)", async () => {
    const editionId = await seedEdition();
    const r = await createContenu(
      publication({ titre: "Coquille vide", corps: "", conferenceEditionId: editionId }),
    );
    if (!r.ok) throw new Error("création KO");
    await setStatut(r.id, "publie");

    expect(await getPublishedArticleByConferenceEdition(editionId)).toBeNull();
  });

  it("aucun récit rattaché : null, et la page se passe du bloc", async () => {
    expect(await getPublishedArticleByConferenceEdition(await seedEdition())).toBeNull();
  });
});

describe("contenus — renvoi « où héberger tes slides » (formulaire de talk)", () => {
  it("null tant que l'article n'existe pas (jamais de lien mort)", async () => {
    expect(await getAideSlidesHref()).toBeNull();
  });

  it("null tant que l'article est en brouillon, le lien s'active à la publication", async () => {
    const r = await createContenu(
      publication({ titre: AIDE_SLIDES_TITRE, corps: "## Où héberger" }),
    );
    if (!r.ok) throw new Error("création KO");
    expect(await getAideSlidesHref()).toBeNull(); // brouillon
    await setStatut(r.id, "publie");
    expect(await getAideSlidesHref()).toBe("/articles/ou-heberger-tes-slides");
  });

  it("null si l'article publié n'a pas de corps (annonce-lien)", async () => {
    const r = await createContenu(publication({ titre: AIDE_SLIDES_TITRE, corps: "" }));
    if (!r.ok) throw new Error("création KO");
    await setStatut(r.id, "publie");
    expect(await getAideSlidesHref()).toBeNull();
  });

  it("null si une PAGE occupe le slug (le renvoi vise une publication)", async () => {
    const r = await createContenu(
      publication({ type: "page", titre: AIDE_SLIDES_TITRE, corps: "Texte", categorie: null, tag: null }),
    );
    if (!r.ok) throw new Error("création KO");
    await setStatut(r.id, "publie");
    expect(await getAideSlidesHref()).toBeNull();
  });
});

describe("contenus — lecture admin", () => {
  it("listContenus renvoie tous les statuts du type demandé", async () => {
    await createContenu(publication({ titre: "Pub brouillon" }));
    const page = await createContenu(publication({ type: "page", titre: "Page", categorie: null, tag: null }));
    if (!page.ok) throw new Error("création KO");
    expect((await listContenus("publication")).length).toBe(1);
    expect((await listContenus("page")).length).toBe(1);
  });
});

/**
 * La source de la recherche (⌘K) : publications ET pages, publiées seulement,
 * avec un corps TRONQUÉ en SQL. Un corps peut peser 50 000 caractères et la
 * palette les enverrait tous au navigateur à chaque ouverture.
 */
describe("listContenusPourRecherche", () => {
  async function publier(input: ContenuInput, publieLe = "2026-06-01") {
    const r = await createContenu(input);
    if (!r.ok) throw new Error("création KO");
    await h.holder.db!.query("UPDATE contenus SET statut='publie', publie_le=$2 WHERE id=$1", [
      r.id,
      publieLe,
    ]);
    return r.id;
  }

  it("rend les publications ET les pages publiées", async () => {
    await publier(publication({ titre: "Une actu" }));
    await publier(publication({ type: "page", titre: "Plan du site", tag: null, categorie: null }));
    const items = await listContenusPourRecherche();
    expect(items.map((c) => [c.type, c.titre]).sort()).toEqual([
      ["page", "Plan du site"],
      ["publication", "Une actu"],
    ]);
  });

  it("laisse les brouillons dehors", async () => {
    // Aucune promotion : le contenu reste au statut par défaut.
    const r = await createContenu(publication({ titre: "Pas encore prête" }));
    if (!r.ok) throw new Error("création KO");
    await publier(publication({ titre: "En ligne" }));
    const titres = (await listContenusPourRecherche()).map((c) => c.titre);
    expect(titres).toEqual(["En ligne"]);
  });

  it("tronque le corps et dit s'il y en a un, sans le transporter", async () => {
    const corps = "## Titre\n\n" + "x".repeat(5_000);
    await publier(publication({ titre: "Long", corps }), "2026-06-02");
    await publier(publication({ titre: "Annonce", corps: "   " }), "2026-06-01");

    const [long, annonce] = await listContenusPourRecherche();
    expect(long.titre).toBe("Long");
    expect(long.aCorps).toBe(true);
    expect(long.extraitCorps.length).toBe(RECHERCHE_CORPS_MAX);
    expect(long.extraitCorps.startsWith("## Titre")).toBe(true);

    // Un corps fait d'espaces n'est pas un corps : la destination doit suivre
    // le lien, pas une page d'article vide.
    expect(annonce.aCorps).toBe(false);
  });

  it("rend les liens dont la destination dépend", async () => {
    await publier(
      publication({
        titre: "Annonce-lien",
        corps: "",
        lienExterne: "https://exemple.test/article",
        lienLabel: "Lire ailleurs",
      }),
    );
    const [item] = await listContenusPourRecherche();
    expect(item.lienExterne).toBe("https://exemple.test/article");
    expect(item.lienLabel).toBe("Lire ailleurs");
    expect(item.lien).toBeNull();
  });

  it("normalise un lien interne sans « / » de tête", async () => {
    // Même normalisation au bord que `mapRow` : sans elle, la palette
    // construirait une URL relative, dont la cible dépend de la page courante.
    await publier(publication({ titre: "Annonce", corps: "" }));
    await h.holder.db!.query("UPDATE contenus SET lien = 'tremplin'");
    expect((await listContenusPourRecherche())[0].lien).toBe("/tremplin");
  });

  it("plafonne la liste : la palette la télécharge en entier", async () => {
    // Sans ce LIMIT, le poids envoyé au navigateur grandirait d'un article à
    // chaque publication, pour toujours. Rien ne le vérifiait.
    const { rows } = await h.holder.db!.query<{ id: number }>(
      `INSERT INTO contenus (type, slug, titre, corps, statut, publie_le)
       SELECT 'publication', 'actu-' || i, 'Actu ' || i, '', 'publie',
              DATE '2026-01-01' + i
         FROM generate_series(1, $1) AS i RETURNING id`,
      [RECHERCHE_MAX_CONTENUS + 5],
    );
    expect(rows.length).toBe(RECHERCHE_MAX_CONTENUS + 5);
    expect((await listContenusPourRecherche()).length).toBe(RECHERCHE_MAX_CONTENUS);
  });

  it("trie du plus récent au plus ancien", async () => {
    await publier(publication({ titre: "Vieille" }), "2026-01-01");
    await publier(publication({ titre: "Récente" }), "2026-07-01");
    expect((await listContenusPourRecherche()).map((c) => c.titre)).toEqual([
      "Récente",
      "Vieille",
    ]);
  });
});

/**
 * Migration 036 pas encore jouée en prod : la table `contenus` est absente.
 * Les LECTURES doivent replier sur du vide (pas de page « Oups », notamment
 * le hub orga /admin/contenus), pas propager le 42P01. On isole ce cas car il
 * détruit la table : on la recrée ensuite pour ne pas casser les autres suites.
 */
describe("contenus — table absente (migration 036 en attente)", () => {
  beforeAll(async () => {
    await h.holder.db!.exec("DROP TABLE IF EXISTS contenus CASCADE");
  });
  afterAll(async () => {
    await h.holder.db!.exec(fs.readFileSync("db/schema.sql", "utf8"));
  });

  it("les lectures replient sur du vide au lieu d'un Oups", async () => {
    expect(await listContenus("publication")).toEqual([]);
    expect(await listPublications()).toEqual([]);
    expect(await listPublicationsRecentes(4)).toEqual([]);
    expect(await listArticlesPublies()).toEqual([]);
    expect(await listPagesPubliees()).toEqual([]);
    expect(await listContenusPourRecherche()).toEqual([]);
    expect(await getContenuBySlug("peu-importe")).toBeNull();
    expect(await getContenuPublieBySlug("peu-importe")).toBeNull();
    expect(await getAideSlidesHref()).toBeNull();
  });
});
