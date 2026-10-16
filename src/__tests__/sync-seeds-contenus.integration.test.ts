// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Chaque cas rejoue ~1900 lignes de SQL, parfois trois fois. Le plafond Vitest
// par défaut est de 5 s, contre ~2,8 s pour un seul déploiement : la marge est
// trop mince, et la suite tombe dès que la machine est chargée — un échec qui
// n'apprend rien sur le code et qui masque les vrais. On donne au fichier la
// marge que son coût réel exige. `hookTimeout` compte autant : le `beforeAll`
// déploie lui aussi un schéma complet, et un hook qui expire fait tomber TOUT le
// fichier d'un coup.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/**
 * UN SEED DE CONTENU SE POSE UNE FOIS — vérifié sur le VRAI fichier de
 * déploiement.
 *
 * `db/sync-to-latest.sql` est rejoué à CHAQUE déploiement, et c'est la référence
 * opérationnelle (cf. db/migrations/README.md). Un seed gardé par le seul
 * `ON CONFLICT (slug) DO NOTHING` ne tient que tant qu'une ligne porte ce slug :
 * supprimer l'article dans l'admin le faisait revenir au déploiement suivant.
 * Une demande de retrait (RGPD art. 17) s'annulait toute seule.
 *
 * Le test rejoue le fichier entier, dans son ordre réel — c'est ce qui attrape
 * aussi bien un seed mal gardé qu'une table de traces créée trop tard.
 *
 * Vrai Postgres (PGlite) sur base vierge.
 */

const sync = readFileSync("db/sync-to-latest.sql", "utf8");

const SLIDES = "ou-heberger-tes-slides";
const INTERVIEW = "interview-de-rachel-dubois";

/**
 * UNE SEULE instance PGlite, remise à l'état « déployé » entre les cas.
 *
 * Le fichier de sync fait ~1900 lignes et met ~2 s à s'appliquer ; PGlite est du
 * WASM, et chaque instance coûte cher. Treize instances tenaient quand ce
 * fichier tournait seul, et rougissaient au hasard dès qu'il partageait la
 * machine avec les 277 autres suites — un test instable finit ignoré, ce qui est
 * pire que pas de test.
 *
 * Une instance, donc, et une remise à zéro des deux SEULES tables que ces cas
 * touchent, depuis une copie prise juste après le premier déploiement. C'est du
 * SQL : aucun WASM de plus.
 *
 * L'isolation vaut donc POUR CES CAS, pas dans l'absolu : `contenus` et
 * `seeds_appliques` reviennent à l'état déployé, le reste du schéma reste tel
 * que le fichier de sync l'a laissé. C'est suffisant ici — aucun cas n'écrit
 * ailleurs — et il faut le savoir avant d'en ajouter un qui le ferait. Les deux
 * tables ÉTALON vivent d'ailleurs dans la base testée : le rejeu du fichier de
 * sync les traverse sans les connaître, ce qui est précisément ce qu'on veut
 * (elles ne portent aucune contrainte ni séquence à heurter).
 */
let db: PGlite;

async function figerEtatDeploye() {
  db = new PGlite();
  await db.exec(sync);
  await db.exec(`
    CREATE TABLE etalon_contenus AS TABLE contenus;
    CREATE TABLE etalon_seeds AS TABLE seeds_appliques;`);
}

/** Rend la base telle qu'un premier déploiement la laisse. */
async function baseDeployee(): Promise<PGlite> {
  await db.exec(`
    DELETE FROM contenus;
    INSERT INTO contenus SELECT * FROM etalon_contenus;
    DELETE FROM seeds_appliques;
    INSERT INTO seeds_appliques SELECT * FROM etalon_seeds;`);
  return db;
}

const slugs = async (db: PGlite): Promise<string[]> =>
  ((await db.query("SELECT slug FROM contenus ORDER BY id")).rows as { slug: string }[]).map(
    (r) => r.slug,
  );

const corps = async (db: PGlite, slug: string): Promise<string | null> => {
  const { rows } = await db.query("SELECT corps FROM contenus WHERE slug = $1", [slug]);
  return rows.length ? (rows[0] as { corps: string | null }).corps : null;
};

/** Les slugs qu'un premier déploiement pose. */
let depart: string[];

// Même délai que le cas qui démarre un moteur WASM plus bas : c'est le même
// coût (démarrage + 1900 lignes), et un dépassement de HOOK fait tomber tout le
// fichier, pas seulement un cas.
beforeAll(async () => {
  await figerEtatDeploye();
  depart = await slugs(db);
});

/** Un moteur WASM retient sa mémoire tant qu'on ne le ferme pas. */
afterAll(async () => {
  await db?.close();
});

describe("seeds de contenu de sync-to-latest.sql", () => {

  it("un premier déploiement pose les articles seedés", () => {
    expect(depart).toContain(SLIDES);
    expect(depart).toContain(INTERVIEW);
  });

  it("rejoué deux fois de plus, il ne double rien", async () => {
    const db = await baseDeployee();
    await db.exec(sync);
    await db.exec(sync);
    expect(await slugs(db)).toEqual(depart);
  });

  it.each([SLIDES, INTERVIEW])(
    "« %s » supprimé dans l'admin reste supprimé au déploiement suivant",
    async (slug) => {
      const db = await baseDeployee();
      await db.query("DELETE FROM contenus WHERE slug = $1", [slug]);

      await db.exec(sync);

      expect(await slugs(db)).toEqual(depart.filter((s) => s !== slug));
    },
  );

  /**
   * Renommer un contenu dans l'admin LIBÈRE son slug (`updateContenu` le dérive
   * du titre) : un seed mal gardé réinsère alors un doublon qui, à date de
   * publication égale, gagne l'affichage public (`ORDER BY … id DESC`).
   */
  it.each([SLIDES, INTERVIEW])("« %s » renommé ne revient pas en doublon", async (slug) => {
    const db = await baseDeployee();
    await db.query("UPDATE contenus SET slug = $1 WHERE slug = $2", [`${slug}-renomme`, slug]);

    await db.exec(sync);

    expect(await slugs(db)).toEqual(depart.map((s) => (s === slug ? `${s}-renomme` : s)));
  });

  /**
   * L'aide au choix d'un hébergement de slides s'édite dans l'admin : le seed la
   * pose et lui laisse le dernier mot (`ON CONFLICT DO NOTHING`).
   */
  it("le corps de l'aide aux slides, réécrit dans l'admin, survit au déploiement", async () => {
    const db = await baseDeployee();
    await db.query("UPDATE contenus SET corps = $1 WHERE slug = $2", ["Version de l'orga.", SLIDES]);

    await db.exec(sync);

    expect(await corps(db, SLIDES)).toBe("Version de l'orga.");
  });

  /**
   * L'interview, elle, est PILOTÉE PAR LE REPO — c'est un choix assumé de la
   * migration 047 : un long verbatim s'édite en PR, pas dans l'éditeur web. Le
   * corps est donc re-posé au déploiement. La garde ci-dessus ne change QUE le
   * sort d'une suppression, jamais celui d'une édition.
   */
  it("le corps de l'interview reste piloté par le repo", async () => {
    const db = await baseDeployee();
    const dOrigine = await corps(db, INTERVIEW);
    await db.query("UPDATE contenus SET corps = $1 WHERE slug = $2", ["Coupé.", INTERVIEW]);

    await db.exec(sync);

    expect(await corps(db, INTERVIEW)).toBe(dOrigine);
  });
});

/**
 * LE NOM DE L'ASSOCIATION NE SE COUPE PAS, Y COMPRIS DANS LA BASE (bloc 062).
 *
 * Les contenus affichés viennent de `contenus`, pas des fixtures : corriger
 * `src/data/actualites.ts` ne change RIEN à une base déjà en ligne, puisque les
 * seeds sont gardés. Le bloc 062 normalise donc les lignes existantes — une
 * fois, et une seule : ces textes s'éditent dans l'admin, et un fichier rejoué à
 * chaque déploiement n'a pas à réécrire indéfiniment la prose de l'orga.
 */
describe("nom insécable dans les contenus (bloc 062)", () => {
  /**
   * Les CONTENUS qui servent encore le nom avec une espace ORDINAIRE, donc
   * sécable. Les trois champs de prose sont interrogés : le nom vit surtout dans
   * les corps (l'aide aux slides et l'interview le citent), et les titres y
   * arrivent par l'import des actualités (`seedContenus`), pas par ce fichier.
   */
  const secables = async (base: PGlite): Promise<string[]> => {
    const { rows } = await base.query(
      `SELECT slug FROM contenus
        WHERE titre LIKE $1 OR titre LIKE $2 OR chapo LIKE $1 OR chapo LIKE $2
           OR corps LIKE $1 OR corps LIKE $2
        ORDER BY slug`,
      ["%Tech Speak\u0027Her%", "%Tech Speak\u2019Her%"],
    );
    return (rows as { slug: string }[]).map((r) => r.slug);
  };

  /** L'inverse : ceux qui portent bien l'insécable. Sans lui, « aucun sécable »
   *  passerait aussi sur une base où le nom n'apparaît nulle part. */
  const insecables = async (base: PGlite): Promise<string[]> => {
    const { rows } = await base.query(
      `SELECT slug FROM contenus
        WHERE titre LIKE $1 OR chapo LIKE $1 OR corps LIKE $1
           OR titre LIKE $2 OR chapo LIKE $2 OR corps LIKE $2
        ORDER BY slug`,
      ["%Tech\u00A0Speak\u0027Her%", "%Tech\u00A0Speak\u2019Her%"],
    );
    return (rows as { slug: string }[]).map((r) => r.slug);
  };

  it("un premier déploiement sert le nom, et jamais en sécable", async () => {
    expect(await insecables(db)).not.toEqual([]);
    expect(await secables(db)).toEqual([]);
  });

  it("une prod d'AVANT le mécanisme est rattrapée au déploiement", async () => {
    const base = await baseDeployee();
    await base.exec("DELETE FROM seeds_appliques");
    // L'état réel d'une prod d'avant ce lot : le nom y a été posé en sécable.
    await base.query(
      `UPDATE contenus SET titre = replace(replace(titre, $1, $3), $2, $4),
                           chapo = replace(replace(chapo, $1, $3), $2, $4),
                           corps = replace(replace(corps, $1, $3), $2, $4)`,
      [
        "Tech\u00A0Speak\u0027Her",
        "Tech\u00A0Speak\u2019Her",
        "Tech Speak\u0027Her",
        "Tech Speak\u2019Her",
      ],
    );
    const abimes = await secables(base);
    expect(abimes).not.toEqual([]);

    await base.exec(sync);

    expect(await secables(base)).toEqual([]);
    // Les mêmes contenus, réparés : le rattrapage ne s'est pas contenté de les
    // vider ni de les supprimer.
    expect(await insecables(base)).toEqual(expect.arrayContaining(abimes));
  });

  /**
   * LA CONTREPARTIE, et c'est elle qui compte : la normalisation est un
   * rattrapage, pas une police typographique permanente. Une orga qui tape le
   * nom avec une espace ordinaire dans l'admin garde son texte.
   */
  it("passée une fois, elle ne réécrit plus ce que l'orga saisit", async () => {
    const base = await baseDeployee();
    await base.exec(sync); // le rattrapage a eu lieu et laissé sa trace
    await base.query("UPDATE contenus SET chapo = $1 WHERE slug = $2", [
      "Un billet de Tech Speak\u0027Her.",
      SLIDES,
    ]);

    await base.exec(sync);

    const { rows } = await base.query("SELECT chapo FROM contenus WHERE slug = $1", [SLIDES]);
    expect((rows[0] as { chapo: string }).chapo).toBe("Un billet de Tech Speak\u0027Her.");
  });
});

/**
 * LE PASSAGE DE LA PROD À CETTE VERSION — le cas qui compte vraiment.
 *
 * La prod tourne depuis des mois : les articles sont là, et AUCUNE trace, parce
 * que le mécanisme arrive avec ce déploiement. Si les traces s'écrivaient après
 * les seeds qu'elles gardent, le tout premier rejeu du nouveau fichier verrait
 * la garde encore ouverte, reposerait le seed UNE dernière fois exactement comme
 * avant — puis figerait cet état.
 *
 * Concrètement : une suppression demandée la veille (RGPD art. 17) ressusciterait
 * au déploiement, et cette fois pour de bon, avec un fichier qui affirme par
 * ailleurs que la suppression est désormais respectée. Le pire des deux mondes.
 */
describe("montée de version d'une base déjà en ligne", () => {
  /** Une prod d'avant le mécanisme : les articles, et pas la moindre trace. */
  async function baseEnLigneSansTraces(): Promise<PGlite> {
    const base = await baseDeployee();
    await base.exec("DELETE FROM seeds_appliques");
    return base;
  }

  it.each([SLIDES, INTERVIEW])(
    "« %s » supprimé AVANT la montée de version reste supprimé",
    async (slug) => {
      const db = await baseEnLigneSansTraces();
      await db.query("DELETE FROM contenus WHERE slug = $1", [slug]);

      await db.exec(sync);

      expect(await slugs(db)).toEqual(depart.filter((s) => s !== slug));
    },
  );

  it.each([SLIDES, INTERVIEW])(
    "« %s » renommé AVANT la montée de version ne revient pas en doublon",
    async (slug) => {
      const db = await baseEnLigneSansTraces();
      await db.query("UPDATE contenus SET slug = $1 WHERE slug = $2", [`${slug}-renomme`, slug]);

      await db.exec(sync);

      expect(await slugs(db)).toEqual(depart.map((s) => (s === slug ? `${s}-renomme` : s)));
    },
  );

  it("une base VIERGE, elle, reçoit bien les articles", async () => {
    // La SEULE instance de plus du fichier : c'est le premier déploiement
    // lui-même qu'on vérifie, il lui faut une base réellement neuve. Démarrer un
    // second moteur WASM et lui appliquer 1900 lignes coûte cher — un coût réel,
    // pas une lenteur à masquer, d'où ce cas UNIQUE (le délai du fichier, posé
    // par `vi.setConfig` en tête, le couvre).
    const vierge = new PGlite();
    try {
      await vierge.exec(sync);
      expect(await slugs(vierge)).toEqual(depart);
    } finally {
      await vierge.close();
    }
  });
});
