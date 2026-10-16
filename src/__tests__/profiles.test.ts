import { describe, it, expect, vi, beforeEach } from "vitest";

// Pool Postgres mocké : on vérifie les requêtes SQL + paramètres, sans vraie BDD.
const query = vi.fn();
vi.mock("@/lib/db", () => ({
  pool: { query: (...args: unknown[]) => query(...args) },
  // withTransaction unitaire : fournit un « client » = le même espion `query`
  // (on vérifie les requêtes métier, pas le BEGIN/COMMIT).
  withTransaction: async (fn: (client: unknown) => Promise<unknown>) =>
    fn({ query: (...args: unknown[]) => query(...args) }),
}));

import {
  getProfileByUserId,
  getProfileBySlug,
  getProfileByHandle,
  isSlugAvailable,
  deriveAvailableSlug,
  speakeuseHref,
  upsertProfile,
  canSubmitToDirectory,
  raisonBlocageAnnuaire,
  toPublicSpeaker,
  effacerCompteEnBase,
  type SpeakerProfile,
  mapRow,
} from "@/lib/profiles";

import { makeProfile } from "./test-helpers";

beforeEach(() => query.mockReset());

const baseProfile: SpeakerProfile = makeProfile({ titreProfil: "Spécialiste IA" });

describe("canSubmitToDirectory", () => {
  it("refuse un profil null", () => {
    expect(canSubmitToDirectory(null)).toBe(false);
  });
  it("refuse un profil sans LinkedIn", () => {
    expect(canSubmitToDirectory({ ...baseProfile, linkedin: null })).toBe(false);
  });
  // Le prédicat couvre les TROIS conditions depuis qu'il dérive du motif :
  // l'attestation n'était vérifiée qu'à part, dans l'action.
  it("accepte un profil avec LinkedIn", () => {
    expect(
      canSubmitToDirectory({ ...baseProfile, linkedin: "https://lk/moi", isWoman: true }),
    ).toBe(true);
  });
  it("accepte un profil avec contact e-mail (sans LinkedIn)", () => {
    expect(
      canSubmitToDirectory({ ...baseProfile, contactEmailOk: true, isWoman: true }),
    ).toBe(true);
  });
  it("refuse un profil sans attestation", () => {
    expect(
      canSubmitToDirectory({ ...baseProfile, contactEmailOk: true, isWoman: false }),
    ).toBe(false);
  });
  // Sans nom, `SpeakeuseCard` retombe sur « Speakeuse » : la fiche partirait en
  // validation puis s'afficherait anonyme dans un annuaire de personnes.
  it("refuse un profil sans nom de compte (fiche anonyme)", () => {
    for (const name of [null, "", "   "]) {
      expect(
        canSubmitToDirectory({ ...baseProfile, contactEmailOk: true, name }),
        `name = ${JSON.stringify(name)}`,
      ).toBe(false);
    }
  });
});

/**
 * La règle de publication était écrite en deux temps : un booléen
 * (`canSubmitToDirectory`) plus, dans l'action, une vérification du nom en
 * DOUBLE trois lignes au-dessus, uniquement pour produire un autre message. Un
 * MOTIF la porte une seule fois, et chaque appelant en tire ce qu'il lui faut.
 */
describe("raisonBlocageAnnuaire", () => {
  const complet = { ...baseProfile, contactEmailOk: true, isWoman: true };

  it("rien ne bloque une fiche complète", () => {
    expect(raisonBlocageAnnuaire(complet)).toBeNull();
  });

  it("nomme le nom manquant en premier", () => {
    for (const name of [null, "", "   "]) {
      expect(raisonBlocageAnnuaire({ ...complet, name })).toBe("nom");
    }
  });

  it("nomme le moyen de contact manquant", () => {
    expect(
      raisonBlocageAnnuaire({ ...complet, linkedin: null, contactEmailOk: false }),
    ).toBe("contact");
  });

  it("nomme l'attestation manquante", () => {
    expect(raisonBlocageAnnuaire({ ...complet, isWoman: false })).toBe("attestation");
  });

  it("une fiche absente bloque sur le nom (rien n'est encore rempli)", () => {
    expect(raisonBlocageAnnuaire(null)).toBe("nom");
  });

  // Le prédicat historique reste, dérivé du motif : le hub s'en sert pour
  // n'afficher «\u00a0Soumettre\u00a0» que quand il aboutira.
  it("canSubmitToDirectory dérive du motif", () => {
    expect(canSubmitToDirectory(complet)).toBe(true);
    expect(canSubmitToDirectory({ ...complet, name: null })).toBe(false);
  });
});

describe("toPublicSpeaker (frontière de fuite de données)", () => {
  it("n'expose QUE les champs publics", () => {
    const pub = toPublicSpeaker({
      ...baseProfile,
      bio: "secret-ish",
      linkedin: "https://lk/x",
      contactEmailOk: true,
      isWoman: true,
      refusMotif: "motif interne",
    });
    expect(Object.keys(pub).sort()).toEqual(
      [
        "entreprise",
        "id",
        "image",
        "langues",
        "name",
        // Dérivé de name/titreProfil, déjà publics — aucune donnée nouvelle.
        "nomAffiche",
        "poste",
        "regions",
        "secteurs",
        "slug",
        "sujets",
        "titreProfil",
      ].sort(),
    );
    // Minimisation : la ville (donnée de localisation) ne part jamais dans le
    // payload de la LISTE de l'annuaire — fiche individuelle uniquement.
    expect((pub as Record<string, unknown>).ville).toBeUndefined();
    // Aucune métadonnée interne ne doit fuiter.
    const leaked = pub as Record<string, unknown>;
    expect(leaked.userId).toBeUndefined();
    expect(leaked.status).toBeUndefined();
    expect(leaked.refusMotif).toBeUndefined();
    expect(leaked.contactEmailOk).toBeUndefined();
    expect(leaked.validatedBy).toBeUndefined();
  });
});

describe("getProfileByUserId", () => {
  it("fait un SELECT filtré par userId et mappe la ligne", async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          userId: 7,
          titre_profil: "Spécialiste IA",
          poste: "Dev",
          entreprise: "OVH",
          bio: "Salut",
          website: null,
          linkedin: "https://lk/x",
          instagram: null,
          secteurs: ["MedTech / Santé"],
          sujets: ["IA / Machine Learning / Data"],
          status: "publie",
          published_at: null,
        },
      ],
    });

    const p = await getProfileByUserId(7);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/from speaker_profiles/i);
    expect(String(sql)).toMatch(/where "userId" = \$1/i);
    expect(params).toEqual([7]);
    expect(p).not.toBeNull();
    expect(p?.bio).toBe("Salut");
    expect(p?.secteurs).toEqual(["MedTech / Santé"]);
    expect(p?.sujets).toEqual(["IA / Machine Learning / Data"]);
  });

  it("retourne null si aucune ligne", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await getProfileByUserId(99)).toBeNull();
  });

  it("un consentement moissonneur illisible vaut REFUS, jamais « suggestions »", async () => {
    // Le repli d'avant la migration 073 était `suggestions` : une valeur
    // inattendue faisait moissonner la fiche et lui écrire. La base ferme la
    // liste, ceci est la ceinture qui va avec — les deux disent la même chose,
    // et c'est la lecture qui doit rester prudente si la base change un jour.
    query.mockResolvedValueOnce({
      rows: [{ id: 1, userId: 7, status: "publie", cfp_sync_mode: "suggestion" }],
    });
    expect((await getProfileByUserId(7))?.cfpSyncMode).toBe("aucun");
  });

  it("lit les trois modes que le code connaît", async () => {
    for (const mode of ["aucun", "suggestions", "auto"] as const) {
      query.mockResolvedValueOnce({
        rows: [{ id: 1, userId: 7, status: "publie", cfp_sync_mode: mode }],
      });
      expect((await getProfileByUserId(7))?.cfpSyncMode).toBe(mode);
    }
  });
});

describe("upsertProfile", () => {
  it("fait un INSERT ... ON CONFLICT (userId) DO UPDATE avec les bons paramètres", async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await upsertProfile(7, {
      titreProfil: "Spécialiste IA",
      poste: "Dev",
      entreprise: "OVH",
      bio: "b",
      website: "https://w",
      linkedin: "https://lk",
      instagram: null,
      sessionizeUrl: "https://sessionize.com/moi",
      conferenceHallUrl: null,
      secteurs: ["MedTech / Santé"],
      sujets: ["IA / Machine Learning / Data"],
      contactEmailOk: false,
      isWoman: true,
      cfpSyncMode: "suggestions",
  ville: null,
  codePostal: null,
  codeInsee: null,
  regionResidence: null,
  regions: [],
  langues: [],
  slug: "marie-curie",
    });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/insert into speaker_profiles/i);
    expect(String(sql)).toMatch(/on conflict \("userId"\) do update/i);
    expect(params[0]).toBe(7);
    expect(params).toContain("Spécialiste IA");
    expect(params).toContain("Dev");
    expect(params).toContainEqual(["MedTech / Santé"]);
    expect(params).toContainEqual(["IA / Machine Learning / Data"]);
    expect(String(sql)).toMatch(/is_woman/i);
    expect(params[11]).toBe(true);
    // Liens CFP et consentement ajoutés après isWoman (isWoman reste en 11).
    expect(String(sql)).toMatch(/sessionize_url/i);
    expect(params).toContain("https://sessionize.com/moi");
    expect(String(sql)).toMatch(/cfp_sync_mode/i);
    expect(params).toContain("suggestions");
    // Slug écrit (colonne + valeur), en dernier paramètre pour ne pas décaler
    // les positions existantes.
    expect(String(sql)).toMatch(/slug/i);
    expect(params).toContain("marie-curie");
  });
});

describe("speakeuseHref", () => {
  it("utilise le slug quand il existe", () => {
    expect(speakeuseHref({ id: 57, slug: "cateline-puccetti" })).toBe(
      "/speakeuses/cateline-puccetti",
    );
  });
  it("retombe sur l'id numérique sans slug", () => {
    expect(speakeuseHref({ id: 57, slug: null })).toBe("/speakeuses/57");
  });
});

describe("getProfileBySlug", () => {
  it("fait un SELECT filtré par slug et mappe la ligne", async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 1, userId: 7, slug: "marie-curie", name: "Marie Curie", status: "publie" }],
    });
    const p = await getProfileBySlug("marie-curie");
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/where sp\.slug = \$1/i);
    expect(params).toEqual(["marie-curie"]);
    expect(p?.slug).toBe("marie-curie");
  });
  it("retourne null si aucune ligne", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await getProfileBySlug("inconnue")).toBeNull();
  });
});

describe("getProfileByHandle", () => {
  it("résout un handle numérique par id (jamais par slug)", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 57, userId: 7, slug: "x", status: "publie" }] });
    await getProfileByHandle("57");
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/where sp\.id = \$1/i);
    expect(params).toEqual([57]);
  });
  it("résout un handle texte par slug", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, userId: 7, slug: "marie-curie", status: "publie" }] });
    await getProfileByHandle("marie-curie");
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/where sp\.slug = \$1/i);
    expect(params).toEqual(["marie-curie"]);
  });
});

describe("isSlugAvailable", () => {
  it("vrai si aucune AUTRE fiche ne porte le slug", async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const ok = await isSlugAvailable("marie-curie", 7);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toMatch(/where slug = \$1 and "userId" <> \$2/i);
    expect(params).toEqual(["marie-curie", 7]);
    expect(ok).toBe(true);
  });
  it("faux si une autre fiche le porte déjà", async () => {
    query.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });
    expect(await isSlugAvailable("marie-curie", 7)).toBe(false);
  });
});

describe("deriveAvailableSlug", () => {
  it("renvoie la base slugifiée quand elle est libre", async () => {
    query.mockResolvedValueOnce({ rows: [] }); // base libre
    expect(await deriveAvailableSlug("Marie Curie", 7)).toBe("marie-curie");
  });
  it("suffixe -2 quand la base est prise", async () => {
    query
      .mockResolvedValueOnce({ rows: [{ x: 1 }] }) // marie-curie pris
      .mockResolvedValueOnce({ rows: [] }); // marie-curie-2 libre
    expect(await deriveAvailableSlug("Marie Curie", 7)).toBe("marie-curie-2");
  });
  it("retombe sur -{userId} quand -2..-9 sont pris", async () => {
    // base + 8 candidats (-2..-9) tous pris → repli garanti unique.
    query.mockResolvedValue({ rows: [{ x: 1 }] });
    expect(await deriveAvailableSlug("Marie Curie", 7)).toBe("marie-curie-7");
  });
  it("renvoie null si le texte ne produit aucun slug", async () => {
    expect(await deriveAvailableSlug("   ", 7)).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("suffixe l'id si la base est tout en chiffres (jamais routée comme slug)", async () => {
    query.mockResolvedValueOnce({ rows: [] }); // "1234-7" libre
    // Sans garde, « 1234 » serait résolu comme un id par getProfileByHandle.
    expect(await deriveAvailableSlug("1234", 7)).toBe("1234-7");
  });
});

describe("effacerCompteEnBase (RGPD)", () => {
  it("purge d'abord les inscriptions Tremplin SANS nom, puis supprime le compte", async () => {
    query.mockResolvedValue({ rowCount: 1, rows: [] });
    await effacerCompteEnBase(7);

    // 1. Les inscriptions anonymes (invitées par e-mail) : sans ce DELETE, le
    //    ON DELETE SET NULL violerait le CHECK d'identité et tout échouerait.
    const [sql1, params1] = query.mock.calls[0];
    expect(String(sql1)).toMatch(/delete from tremplin_registrations/i);
    expect(String(sql1)).toMatch(/participante_nom is null/i);
    expect(params1).toEqual([7]);

    // 2. Anonymisation des inscriptions NON publiques conservées (droit à
    //    l'effacement) : nom neutralisé, champs perso vidés.
    const [sql2, params2] = query.mock.calls[1];
    expect(String(sql2)).toMatch(/update tremplin_registrations/i);
    expect(String(sql2)).toMatch(/"public" = false/i);
    expect(String(sql2)).toMatch(/bio = null/i);
    // privé : rien à archiver → le titre primé part aussi (contraste avec le public).
    expect(String(sql2)).toMatch(/titre_palmares = null/i);
    expect(params2).toEqual([7]);

    // 3. Inscriptions PUBLIQUES (archive) : on garde nom/titre primé/classement
    //    mais on efface les données perso qui ne sont plus affichées (minimisation).
    const [sql3, params3] = query.mock.calls[2];
    expect(String(sql3)).toMatch(/update tremplin_registrations/i);
    expect(String(sql3)).toMatch(/"public" = true/i);
    expect(String(sql3)).toMatch(/bio = null/i);
    expect(String(sql3)).not.toMatch(/participante_nom =/i); // nom d'archive préservé
    // titre primé FIGÉ du palmarès préservé (après retrait de `sujet`, migration
    // 035 : c'est `titre_palmares` qui porte l'archive, plus `sujet`).
    expect(String(sql3)).not.toMatch(/titre_palmares = null/i);
    expect(params3).toEqual([7]);

    // 4. Consentements DE PHASE révoqués : supprimer son compte, c'est retirer
    //    son nom. Contrairement au palmarès (§3), qui archive un résultat
    //    proclamé devant un public, appartenir à une cohorte d'accompagnement
    //    n'est pas un fait observé de l'extérieur. L'appartenance, elle, reste :
    //    l'effectif anonyme de la phase doit tenir.
    const [sql4, params4] = query.mock.calls[3];
    expect(String(sql4)).toMatch(/update tremplin_registration_phases/i);
    expect(String(sql4)).toMatch(/"public" = false/i);
    expect(String(sql4)).toMatch(/public_consent_at = null/i);
    expect(String(sql4)).not.toMatch(/delete from tremplin_registration_phases/i);
    expect(params4).toEqual([7]);

    // 5. Articles JAMAIS publiés (lot N3) : contenu personnel sans base de
    //    conservation — la cession de droits porte sur la PUBLICATION.
    const [sql5, params5] = query.mock.calls[4];
    expect(String(sql5)).toMatch(/delete from contenus/i);
    expect(String(sql5)).toMatch(/statut <> 'publie'/i);
    expect(params5).toEqual([7]);

    // 6. Le compte lui-même (profil, fiche coach et talks partent en cascade).
    const [sql6, params6] = query.mock.calls[5];
    expect(String(sql6)).toMatch(/delete from users/i);
    expect(String(sql6)).toMatch(/where id = \$1/i);
    expect(params6).toEqual([7]);
  });
});

describe("mapRow — le nom affiché se calcule AU BORD", () => {
  it("un nom en blanc retombe sur le titre, jamais sur du vide", () => {
    // C'est LE défaut d'origine : `??` à l'affichage laissait passer `"   "`.
    // Le calcul vit ici, une fois — six écrans le lisent tel quel.
    const p = mapRow({
      id: 1,
      userId: 7,
      name: "   ",
      titre_profil: "Dev & mentor",
      status: "publie",
    } as never);
    expect(p.nomAffiche).toBe("Dev & mentor");
  });
});
