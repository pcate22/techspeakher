import { describe, it, expect } from "vitest";
import {
  buildOrgaDigestEmail,
  buildSpeakeuseDigestEmail,
} from "@/lib/digest-email";
import type { Tache } from "@/lib/taches";

/** Le digest ne peut pas être nul dans les cas pleins : l'affirmer une fois. */
function digestPlein(taches: Tache[]): { subject: string; textContent: string } {
  const d = buildOrgaDigestEmail(taches);
  expect(d).not.toBeNull();
  return d!;
}

/**
 * LE DIGEST ORGA LIT LE MOTEUR (étape C) : il reçoit les tâches dérivées —
 * celles de l'écran, avec leurs libellés NOMINATIFS — et n'en publie que
 * l'AGRÉGAT : un compte par règle, les lignes à zéro tues, un seul lien.
 *
 * POURQUOI aucun nom ne doit sortir (conception §4, trois faits vérifiés) :
 * l'e-mail part à CONTACT_EMAIL, l'adresse PUBLIQUE de l'association — une
 * boîte Gmail partagée dont le périmètre n'est pas `users.is_orga` — et une
 * copie distribuée survit à la suppression du compte : ce serait la première
 * durée de conservation que personne n'outille.
 *
 * Ce banc est le test RGPD de §5, posé AVANT l'étape C : « y remettre un
 * libellé → le test tombe ». Il nourrit le digest de tâches PLEINES de noms
 * et d'URL de dossiers, et affirme que rien n'en ressort.
 */
describe("buildOrgaDigestEmail — l'agrégat du moteur, sans un nom", () => {
  const TACHES: Tache[] = [
    { libelle: "Valider la fiche d'Ada Lovelace", href: "/speakeuses/7", famille: "association", regle: "valider-fiche" },
    { libelle: "Valider la fiche de Grace Hopper", href: "/speakeuses/8", famille: "association", regle: "valider-fiche" },
    { libelle: "La fiche « Dev & mentor » est publiée sans nom réel", href: "/speakeuses/9", famille: "association", regle: "nommer-fiche", constat: true },
    { libelle: "Donner une date à 3 ateliers", href: "/admin/tremplins/1/ateliers?vue=a-dater", famille: "association", regle: "dater-atelier", nb: 3, contexte: "Tremplin DevFest 2026" },
    // Le slug d'un article de membre porte souvent le nom de l'autrice : la
    // donnée RÉELLE que la boucle de fermeture des href doit attraper.
    { libelle: "Relire l'article de Marie Curie", href: "/admin/contenus/publication/marie-curie-oser-le-cfp", famille: "association", regle: "relire-article" },
    { libelle: "Relier Camille Rivière à un compte", href: "/admin/tremplins/1/participantes/5/compte", famille: "association", regle: "relier-compte", contexte: "Tremplin DevFest 2026" },
    { libelle: "2 photos restent privées", href: "/admin/tremplins/1/photos", famille: "association", regle: "photos-privees", nb: 2, contexte: "Tremplin DevFest 2026", constat: true },
  ];

  it("compte par règle, contexte dit, lignes à zéro tues, UN lien", () => {
    const { textContent } = digestPlein(TACHES);
    expect(textContent).toMatch(/- 2 fiches à valider/);
    expect(textContent).toMatch(/- 3 ateliers à dater \(Tremplin DevFest 2026\)/);
    expect(textContent).toMatch(/- 1 article à relire/);
    expect(textContent).toMatch(/- 1 participante à relier à un compte \(Tremplin DevFest 2026\)/);
    // Une seule URL dans tout l'e-mail : la liste, en vue association.
    const urls = textContent.match(/https?:\/\/\S+/g) ?? [];
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("/mon-espace/a-faire?vue=association");
  });

  it("AUCUN nom, aucune URL de dossier individuel, aucune arobase", () => {
    // Le test RGPD de §5. Les entrées en sont pleines ; la sortie, jamais.
    const { subject, textContent } = digestPlein(TACHES);
    const tout = `${subject}\n${textContent}`;
    for (const nom of ["Ada", "Lovelace", "Grace", "Hopper", "Marie", "Curie", "Camille", "Rivière"]) {
      expect(tout, nom).not.toContain(nom);
    }
    expect(tout).not.toMatch(/\/speakeuses\/\d/);
    expect(tout).not.toMatch(/\/participantes\/\d/);
    expect(tout).not.toContain("@");
    // Fermeture TOTALE : aucun href NI LIBELLÉ d'entrée ne sort, quels qu'ils
    // soient — un slug d'article nominatif compris (relevé de la passe RGPD du
    // 2026-08-18 : les motifs ci-dessus laissaient passer 4 href sur 6), et un
    // titre de profil compris (« Marie, dev & mentor » serait du nominatif —
    // passe sécurité du 2026-08-22, avec la règle nommer-fiche).
    for (const t of TACHES) {
      expect(tout, t.href).not.toContain(t.href);
      expect(tout, t.libelle).not.toContain(t.libelle);
    }
    expect(tout).not.toContain("marie-curie");
    expect(tout).not.toContain("Dev & mentor");
  });

  it("les CONSTATS restent hors de l'e-mail : il notifie ce qu'un geste referme", () => {
    // La règle du point vaut pour tout signal : une notification qui
    // réclamerait un accord déjà refusé referait le défaut corrigé à l'écran,
    // et une qui réclamerait un nom que seule la speakeuse peut écrire
    // relancerait l'orga sur le geste d'une autre.
    const { textContent } = digestPlein(TACHES);
    expect(textContent).not.toMatch(/photos? .*privée/i);
    expect(textContent).not.toMatch(/sans nom/i);
  });

  it("le singulier s'accorde, et une liste sans geste ne fabrique rien", () => {
    const { textContent } = digestPlein([TACHES[0]]);
    expect(textContent).toMatch(/- 1 fiche à valider/);
    expect(textContent).not.toMatch(/1 fiches/);

    // Que des constats : `null` — un contrat que le compilateur tient, le
    // cron n'a aucune convention de chaîne vide à connaître.
    expect(buildOrgaDigestEmail(TACHES.filter((t) => t.constat))).toBeNull();
  });

  it("la même règle sur DEUX éditions donne deux lignes : le contexte sépare", () => {
    // Sans cette séparation, « 5 ateliers à dater » fondrait deux tremplins
    // en un chiffre que personne ne peut situer — le contexte est la seule
    // donnée d'édition que l'e-mail transporte, il doit rester exact.
    const { textContent } = digestPlein([
      { libelle: "Donner une date à 3 ateliers", href: "/x", famille: "association", regle: "dater-atelier", nb: 3, contexte: "Tremplin DevFest 2026" },
      { libelle: "Donner une date à 2 ateliers", href: "/y", famille: "association", regle: "dater-atelier", nb: 2, contexte: "Tremplin 2027" },
    ]);
    expect(textContent).toMatch(/- 3 ateliers à dater \(Tremplin DevFest 2026\)/);
    expect(textContent).toMatch(/- 2 ateliers à dater \(Tremplin 2027\)/);
  });

  it("les règles gardent l'ordre du moteur (les datées d'abord), une ligne par (règle, contexte)", () => {
    const { textContent } = digestPlein(TACHES);
    const lignes = textContent.split("\n").filter((l) => l.startsWith("- "));
    // Compte EXPLICITE, relu à la main sur le jeu : valider-fiche (2 tâches →
    // 1 ligne), dater-atelier, relire-article, relier-compte — les constats
    // (photos-privees, nommer-fiche) restent dehors. Un attendu recalculé
    // depuis la même clé `règle|contexte` que le code resterait vert si les
    // deux glissaient ensemble (principes-tests : un test se juge en le cassant).
    expect(lignes).toHaveLength(4);
    expect(lignes[0]).toContain("fiches à valider");
  });
});

describe("buildSpeakeuseDigestEmail", () => {
  it("annonce le nombre de messages et NE montre que le début du corps", () => {
    const longBody = "A".repeat(500);
    const { subject, textContent } = buildSpeakeuseDigestEmail({
      name: "Marie Curie",
      messages: [
        { motif: "conference", body: longBody },
        { motif: "jury", body: "Court message." },
      ],
    });
    expect(subject).toMatch(/message/i);
    expect(textContent).toMatch(/Salut Marie,/);
    // Extrait : jamais le corps complet.
    expect(textContent).not.toContain(longBody);
    expect(textContent).toMatch(/A{20}/); // un début est bien présent
    // Incite à se connecter pour lire / répondre.
    expect(textContent).toMatch(/\/mon-espace/);
    // Motif lisible (libellé, pas la valeur brute).
    expect(textContent).toMatch(/conférence|Interview|jury|Jury/i);
  });
});
