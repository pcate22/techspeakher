// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/**
 * Intégration BDD du lot N3 (les speakeuses écrivent) : TOUTE membre crée un
 * article (FK sur users), la relecture le tient hors du public jusqu'à la
 * publication par une orga, le nom est FIGÉ à la publication (zéro
 * anonymisation, droits cédés : l'article signé survit à la suppression du
 * compte), le motif d'un renvoi revient à l'autrice. Vrai Postgres (PGlite) +
 * db/schema.sql, comme les autres tests d'intégration.
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
  // Le harnais joue la transaction sur la même base (sémantique suffisante
  // ici : on vérifie CE QUI RESTE après `effacerCompteEnBase`, pas le rollback).
  withTransaction: async (fn: (client: unknown) => Promise<unknown>) => fn(h.pool),
}));

import {
  PLAFOND_ARTICLES_EN_COURS,
  creerArticle,
  listMesArticles,
  getMonArticle,
  majMonArticle,
  soumettreMonArticle,
  listArticlesEnRelecture,
  renvoyerArticle,
  countMesArticles,
} from "@/lib/articles-membres";
import { listPublicationsRecentes, setStatut } from "@/lib/contenus";
import { effacerCompteEnBase } from "@/lib/profiles";

let db: PGlite;

// Boot PGlite (wasm) : au-delà des 10 s de `hookTimeout` par défaut dès que la
// suite sature les workers. Sans cette ligne, ce fichier tombe par
// INTERMITTENCE — un rouge qui n'accuse rien et qu'on relance jusqu'au vert,
// exactement ce que `docs/principes-tests.md` § 3 range dans « le silence
// ressemble au succès ». Les autres fichiers PGlite la posent déjà.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

beforeAll(async () => {
  db = new PGlite();
  h.holder.db = db;
  await db.exec(fs.readFileSync("db/schema.sql", "utf8"));
});
afterAll(async () => {
  await db.close();
});

let uid = 0;
async function membre(nom: string, image: string | null = null): Promise<number> {
  uid += 1;
  const email = `m${uid}@example.org`;
  const { rows } = await db.query(
    `INSERT INTO users (name, email, image) VALUES ($1, $2, $3) RETURNING id`,
    [nom, email, image],
  );
  return (rows[0] as { id: number }).id;
}

const BROUILLON = {
  titre: "Gérer le trac avant de monter",
  corps: "Respirer, répéter, arriver en avance.",
  chapo: "Trois gestes qui marchent.",
  categorie: "Conseils de speakeuse",
};

beforeEach(async () => {
  await db.exec(`DELETE FROM contenus; DELETE FROM users;`);
});

describe("écrire (toute membre, brouillon signé)", () => {
  it("crée un brouillon relié à SON compte, invisible du public", async () => {
    const ada = await membre("Ada Lovelace");
    const res = await creerArticle(ada, BROUILLON);
    expect(res.ok).toBe(true);

    const miens = await listMesArticles(ada);
    expect(miens).toHaveLength(1);
    expect(miens[0].statut).toBe("brouillon");

    expect(await listPublicationsRecentes(10, { avecDestination: true })).toHaveLength(0);
  });

  it("titre déjà pris (slug) : refus dit, rien d'écrit", async () => {
    const ada = await membre("Ada");
    await creerArticle(ada, BROUILLON);
    const res = await creerArticle(ada, BROUILLON);
    expect(res).toEqual({ ok: false, reason: "slug" });
  });

  it("le slug esquive le segment réservé « nouveau » et ne sort jamais vide", async () => {
    // « Nouveau » slugifié tel quel donnerait /admin/contenus/publication/nouveau,
    // où la route statique de CRÉATION gagne sur [slug] : l'article deviendrait
    // injoignable par URL. Et un titre sans lettres (« ??? ») slugifie à vide.
    const ada = await membre("Ada");
    const r1 = await creerArticle(ada, { ...BROUILLON, titre: "Nouveau" });
    expect(r1.ok).toBe(true);
    const id = r1.ok ? r1.id : 0;
    expect((await getMonArticle(id, ada))?.slug).not.toBe("nouveau");
    // La mise à jour recalcule le slug avec la même règle (titre sans lettres).
    expect(await majMonArticle(id, ada, { ...BROUILLON, titre: "???" })).toBe(true);
    const maj = await getMonArticle(id, ada);
    expect(maj?.slug).toBeTruthy();
    expect(maj?.slug).not.toBe("nouveau");
  });

  it("le plafond d'articles EN COURS tient l'abus à distance (anti-spam du « À faire » orga)", async () => {
    const ada = await membre("Ada");
    for (let i = 0; i < PLAFOND_ARTICLES_EN_COURS; i++) {
      const r = await creerArticle(ada, { ...BROUILLON, titre: `Astuce n° ${i}` });
      expect(r.ok).toBe(true);
    }
    expect(await creerArticle(ada, { ...BROUILLON, titre: "Une de trop" })).toEqual({
      ok: false,
      reason: "plafond",
    });
    // Un article PUBLIÉ libère sa place (le plafond compte l'EN COURS).
    const [premier] = await listMesArticles(ada);
    await soumettreMonArticle(premier.id, ada);
    await setStatut(premier.id, "publie");
    expect((await creerArticle(ada, { ...BROUILLON, titre: "La place libérée" })).ok).toBe(true);
  });

  it("chacune ne modifie que SON brouillon", async () => {
    const ada = await membre("Ada");
    const eve = await membre("Eve");
    const res = await creerArticle(ada, BROUILLON);
    const id = res.ok ? res.id : 0;

    expect(await majMonArticle(id, eve, { ...BROUILLON, titre: "Piraté" })).toBe(false);
    expect(await getMonArticle(id, eve)).toBeNull();
    expect(await majMonArticle(id, ada, { ...BROUILLON, corps: "Mieux." })).toBe(true);
    expect((await getMonArticle(id, ada))?.corps).toBe("Mieux.");
  });

  it("un article soumis cesse d'être modifiable par l'autrice (il est chez l'orga)", async () => {
    const ada = await membre("Ada");
    const res = await creerArticle(ada, BROUILLON);
    const id = res.ok ? res.id : 0;
    await soumettreMonArticle(id, ada);
    expect(await majMonArticle(id, ada, { ...BROUILLON, corps: "Trop tard" })).toBe(false);
  });
});

describe("relire (orga)", () => {
  it("soumettre : en relecture chez l'orga (nom du compte), toujours hors du public", async () => {
    const ada = await membre("Ada Lovelace");
    const res = await creerArticle(ada, BROUILLON);
    const id = res.ok ? res.id : 0;
    expect(await soumettreMonArticle(id, ada)).toBe(true);

    const aRelire = await listArticlesEnRelecture();
    expect(aRelire).toHaveLength(1);
    expect(aRelire[0].auteurNom).toBe("Ada Lovelace");
    expect(await listPublicationsRecentes(10, { avecDestination: true })).toHaveLength(0);
  });

  it("soumettre l'article d'une autre : refus, rien ne bouge", async () => {
    const ada = await membre("Ada");
    const eve = await membre("Eve");
    const res = await creerArticle(ada, BROUILLON);
    const id = res.ok ? res.id : 0;
    expect(await soumettreMonArticle(id, eve)).toBe(false);
    expect(await listArticlesEnRelecture()).toHaveLength(0);
  });

  it("renvoyer avec motif : retour brouillon, le motif revient à l'autrice", async () => {
    const ada = await membre("Ada");
    const res = await creerArticle(ada, BROUILLON);
    const id = res.ok ? res.id : 0;
    await soumettreMonArticle(id, ada);
    await renvoyerArticle(id, "Précise la partie répétition.");

    const [article] = await listMesArticles(ada);
    expect(article.statut).toBe("brouillon");
    expect(article.relectureMotif).toBe("Précise la partie répétition.");
    // Modifiable à nouveau : le renvoi rend la main.
    expect(await majMonArticle(id, ada, { ...BROUILLON, corps: "Précisé." })).toBe(true);
  });

  it("publier (le CTA de l'éditeur, setStatut) : date du jour, nom FIGÉ, motif effacé, public avec la photo", async () => {
    const ada = await membre("Ada Lovelace", "https://example.org/ada.jpg");
    const res = await creerArticle(ada, BROUILLON);
    const id = res.ok ? res.id : 0;
    await soumettreMonArticle(id, ada);
    await setStatut(id, "publie");

    const [publie] = await listPublicationsRecentes(10, { avecDestination: true });
    expect(publie.auteurNom).toBe("Ada Lovelace");
    expect(publie.auteurImage).toBe("https://example.org/ada.jpg");
    expect(publie.publieLe).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(publie.relectureMotif).toBeNull();
  });

  it("renvoyer un article déjà traité : zéro ligne écrite, et l'appelante le sait (null)", async () => {
    // La course de deux orgas : l'une publie pendant que l'autre renvoie.
    const ada = await membre("Ada");
    const res = await creerArticle(ada, BROUILLON);
    const id = res.ok ? res.id : 0;
    await soumettreMonArticle(id, ada);
    await setStatut(id, "publie");
    expect(await renvoyerArticle(id, "Trop tard")).toBeNull();
    const [article] = await listMesArticles(ada);
    expect(article.statut).toBe("publie");
    expect(article.relectureMotif).toBeNull();
  });
});

describe("zéro anonymisation : les droits sont cédés à Tech Speak'Her", () => {
  it("le compte supprimé, l'article publié RESTE, signé — seul le lien vivant tombe", async () => {
    const ada = await membre("Ada Lovelace");
    const res = await creerArticle(ada, BROUILLON);
    const id = res.ok ? res.id : 0;
    await soumettreMonArticle(id, ada);
    await setStatut(id, "publie");

    await db.query(`DELETE FROM users WHERE id = $1`, [ada]);

    const [publie] = await listPublicationsRecentes(10, { avecDestination: true });
    expect(publie.titre).toBe(BROUILLON.titre);
    expect(publie.auteurNom).toBe("Ada Lovelace");
    expect(publie.auteurUserId).toBeNull();
    expect(publie.auteurImage).toBeNull();
  });

  it("supprimer son compte emporte les articles JAMAIS publiés (la cession porte sur la publication)", async () => {
    const ada = await membre("Ada");
    await creerArticle(ada, { ...BROUILLON, titre: "Brouillon intime" });
    const r = await creerArticle(ada, { ...BROUILLON, titre: "Soumis en relecture" });
    await soumettreMonArticle(r.ok ? r.id : 0, ada);
    const p = await creerArticle(ada, { ...BROUILLON, titre: "Publié lui" });
    await soumettreMonArticle(p.ok ? p.id : 0, ada);
    await setStatut(p.ok ? p.id : 0, "publie");

    await effacerCompteEnBase(ada);

    // Seul l'article PUBLIÉ survit (signé) : un brouillon ou un article en
    // relecture est un contenu personnel sans base de conservation.
    const { rows } = await db.query(`SELECT titre, statut FROM contenus ORDER BY id`);
    expect(rows).toEqual([{ titre: "Publié lui", statut: "publie" }]);
  });

  it("countMesArticles : le compteur de la rangée du profil", async () => {
    const ada = await membre("Ada");
    expect(await countMesArticles(ada)).toBe(0);
    await creerArticle(ada, BROUILLON);
    expect(await countMesArticles(ada)).toBe(1);
  });
});
