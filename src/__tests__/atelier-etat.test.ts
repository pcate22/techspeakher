import { describe, it, expect } from "vitest";
import {
  atelierEtat,
  type AtelierEtatEntrees,
  type AtelierEtatSource,
} from "@/lib/atelier-etat";

/**
 * Lot C — la fiche atelier devient un ÉVÉNEMENT : quand / où / qui /
 * avancement, dérivés d'une seule fonction pure. Quatre règles gouvernent les
 * alertes, et ce fichier les tient :
 *
 * 1. rien ne se réclame avant que l'atelier soit DATÉ ;
 * 2. l'avancement dépend de la NATURE (présences pour un collectif, réalisation
 *    par sous-groupe sinon) ;
 * 3. l'absence de coach sur un atelier autonome est un état NORMAL ;
 * 4. deux situations distinctes n'ont jamais le même TEXTE (la couleur ne porte
 *    jamais l'information seule).
 */

const AUJOURDHUI = "2026-09-20";

const atelier = (o: Partial<AtelierEtatSource> = {}): AtelierEtatSource => ({
  date: "2026-09-01",
  dateFin: null,
  heureDebut: "18:30",
  heureFin: "20:00",
  lieu: null,
  lienVisio: null,
  nature: "collectif",
  audience: "selection" as const,
  // Réservée à l'espace des inscrites : le défaut d'une séance en sélection.
  auProgrammePublic: false,
  phase: "cfp_et_pitch",
  coachs: null,
  ...o,
});

const base = (o: Partial<AtelierEtatEntrees> = {}): AtelierEtatEntrees => ({
  atelier: atelier(),
  nbMembres: 0,
  nbInscritesEdition: 8,
  nbCoachs: 0,
  presences: null,
  sousGroupes: { total: 0, faits: 0, avecCoach: 0, ranges: 0 },
  aujourdhui: AUJOURDHUI,
  ...o,
  // La COHORTE (qui l'atelier concerne) porte le total des présences. Par
  // défaut on la cale sur les présences fournies : le cas intéressant — une
  // cohorte plus grande que les lignes déjà créées — se demande explicitement.
  nbCohorte: o.nbCohorte ?? o.presences?.length ?? 0,
});

/** Raccourci : ne surcharger que des champs d'atelier. */
const avec = (o: Partial<AtelierEtatSource>, reste: Partial<AtelierEtatEntrees> = {}) =>
  atelierEtat(base({ atelier: atelier(o), ...reste }));

describe("atelierEtat — QUAND", () => {
  it("date simple : la date, sans consigne de fenêtre", () => {
    const e = atelierEtat(base());
    expect(e.quand.texte).toMatch(/1 sept\. 2026/);
    expect(e.quand.consigne).toBeNull();
  });

  it("fenêtre à venir : période + consigne qui dit QUI cale (l'heure ne veut rien dire)", () => {
    const e = avec({
      date: "2026-10-07",
      dateFin: "2026-10-13",
      heureDebut: null,
      heureFin: null,
    });
    expect(e.quand.texte).toMatch(/du 7 au 13 oct\. 2026/);
    expect(e.quand.consigne).toMatch(/chaque sous-groupe choisit son créneau/i);
  });

  it("fenêtre REFERMÉE : plus de consigne (le passé ne s'injonctionne pas)", () => {
    const e = avec({ date: "2026-09-01", dateFin: "2026-09-07" });
    expect(e.quand.consigne).toBeNull();
  });

  it("une fin qui répète le début n'est pas une fenêtre", () => {
    const e = avec({ date: "2026-09-01", dateFin: "2026-09-01" });
    expect(e.quand.texte).toMatch(/1 sept\. 2026/);
    expect(e.quand.texte).not.toMatch(/du 1/);
    expect(e.quand.consigne).toBeNull();
  });

  it("sans date : l'état est dit, et c'est la seule alerte de date", () => {
    const e = avec({ date: null });
    expect(e.quand.texte).toBe("Date à définir");
    expect(e.quand.alerte).toBe(true);
  });
});

describe("atelierEtat — OÙ", () => {
  it("lieu physique : le lieu", () => {
    expect(avec({ lieu: "BPCE, Toulouse" }).ou.texte).toBe("BPCE, Toulouse");
  });

  it("visio seule : « En visio »", () => {
    const e = avec({ lienVisio: "https://meet.example.org/x" });
    expect(e.ou.texte).toBe("En visio");
    expect(e.ou.lienVisio).toBe("https://meet.example.org/x");
  });

  it("hybride : lieu et visio", () => {
    expect(avec({ lieu: "BPCE, Toulouse", lienVisio: "https://x.fr/v" }).ou.texte).toBe(
      "BPCE, Toulouse et en visio",
    );
  });

  it("sous-groupes AVEC un lien : on situe et on précise d'où vient le lien", () => {
    const e = avec({ nature: "sous_groupes", lienVisio: "https://x.fr/v" });
    expect(e.ou.texte).toBe("En visio, lien par sous-groupe");
    expect(e.ou.alerte).toBe(false);
  });

  it("sous-groupes SANS rien : on ne promet pas un lien qui n'existe pas", () => {
    const e = avec({ nature: "sous_groupes" });
    expect(e.ou.texte).toMatch(/à préciser/i);
    expect(e.ou.texte).toMatch(/sous-groupe/i);
    expect(e.ou.alerte).toBe(false);
  });

  it("collectif à venir sans lieu ni visio : à préciser (alerte)", () => {
    const e = avec({ date: "2026-10-01" });
    expect(e.ou.texte).toBe("À préciser");
    expect(e.ou.alerte).toBe(true);
  });

  it("collectif PASSÉ sans lieu : un texte DIFFÉRENT, pas la même phrase en gris", () => {
    // Règle 4 : sans ça, « À préciser » servait aux deux états et seule la
    // couleur les distinguait.
    const e = avec({ date: "2026-09-01" });
    expect(e.ou.texte).toBe("Lieu non consigné");
    expect(e.ou.alerte).toBe(false);
  });

  it("atelier PAS ENCORE DATÉ : le lieu ne se réclame pas (règle 1)", () => {
    const e = avec({ date: null });
    expect(e.ou.alerte).toBe(false);
  });
});

describe("atelierEtat — QUI", () => {
  it("ouvert à toutes : le compte des inscrites de l'édition", () => {
    const e = avec({ audience: "toutes" as const });
    expect(e.qui.texte).toMatch(/ouvert à toutes/i);
    expect(e.qui.texte).toMatch(/8 inscrites/);
    expect(e.qui.alerte).toBe(false);
  });

  it("réservé avec participantes : leur nombre", () => {
    expect(atelierEtat(base({ nbMembres: 6 })).qui.texte).toMatch(/6 participantes/);
  });

  it("ni ouvert ni pourvu, atelier à venir : visible de personne (LA vraie alerte)", () => {
    const e = avec({ date: "2026-10-01" }, { nbMembres: 0 });
    expect(e.qui.texte).toMatch(/visible de personne/i);
    expect(e.qui.alerte).toBe(true);
  });

  it("roster vide sur un atelier PASSÉ : un constat, plus une tâche", () => {
    const e = avec({ date: "2026-09-01" }, { nbMembres: 0 });
    expect(e.qui.texte).toMatch(/visible de personne/i);
    expect(e.qui.alerte).toBe(false);
  });

  it("coach relié : il est compté dans le QUI", () => {
    expect(atelierEtat(base({ nbMembres: 6, nbCoachs: 1 })).qui.texte).toMatch(/1 coach/);
  });

  it("sous-groupes sans coach : « autonome », jamais « à trouver »", () => {
    const e = avec({ nature: "sous_groupes" }, { nbMembres: 6 });
    expect(e.qui.texte).toMatch(/autonome/i);
    expect(e.qui.texte).not.toMatch(/trouver/i);
  });

  it("sous-groupes : leur nombre entre dans le QUI", () => {
    const e = avec(
      { nature: "sous_groupes" },
      {
        nbMembres: 4,
        nbCohorte: 4,
        sousGroupes: { total: 2, faits: 1, avecCoach: 0, ranges: 4 },
      },
    );
    expect(e.qui.texte).toMatch(/2 sous-groupes/);
  });

  it("collectif à venir sans coach ni texte : coach à trouver (alerte légitime)", () => {
    const e = avec({ date: "2026-10-01" }, { nbMembres: 6 });
    expect(e.qui.texte).toMatch(/coach à trouver/i);
    expect(e.qui.alerte).toBe(true);
  });

  it("atelier PAS ENCORE DATÉ : le coach ne se réclame pas (règle 1)", () => {
    const e = avec({ date: null }, { nbMembres: 6 });
    expect(e.qui.texte).not.toMatch(/trouver/i);
    expect(e.qui.alerte).toBe(false);
  });

  it("un manque ne teinte que SON segment, pas le fait sain d'à côté", () => {
    const e = avec({ date: "2026-10-01" }, { nbMembres: 6 });
    const participantes = e.qui.segments.find((s) => s.texte.includes("participantes"));
    const coach = e.qui.segments.find((s) => s.texte.includes("coach"));
    expect(participantes?.alerte).toBe(false);
    expect(coach?.alerte).toBe(true);
  });

  it("atelier neuf (titre seul) : UNE seule alerte, celle de la date", () => {
    // Le défaut que le lot supprime : trois faits orange sur quatre sur un
    // atelier qui vient d'être créé.
    const e = avec({ date: null, dateFin: null, heureDebut: null, heureFin: null });
    const alertes = [e.quand.alerte, e.ou.alerte, e.qui.alerte, e.avancement?.alerte ?? false];
    expect(alertes.filter(Boolean)).toHaveLength(1);
    expect(e.quand.alerte).toBe(true);
  });
});

describe("atelierEtat — AVANCEMENT (dépend de la nature)", () => {
  it("collectif passé : ce qui est fait ET ce qui reste, en mots", () => {
    const e = atelierEtat(
      base({ nbMembres: 3, presences: ["presente", "absente", "non_renseignee"] }),
    );
    expect(e.avancement?.texte).toMatch(/2 pointées sur 3/);
    expect(e.avancement?.texte).toMatch(/1 présence à pointer/);
    expect(e.avancement?.alerte).toBe(true);
  });

  it("collectif passé, rien de pointé : on ne dit jamais « 0 pointée »", () => {
    const e = atelierEtat(base({ nbMembres: 2, presences: ["non_renseignee", "non_renseignee"] }));
    expect(e.avancement?.texte).toBe("2 présences à pointer");
  });

  it("collectif passé et tout pointé : dit sans alerte", () => {
    const e = atelierEtat(base({ nbMembres: 2, presences: ["presente", "absente"] }));
    expect(e.avancement?.texte).toMatch(/présences complètes/i);
    expect(e.avancement?.alerte).toBe(false);
  });

  it("collectif À VENIR : aucun avancement réclamé (fini la fausse alerte)", () => {
    const e = avec({ date: "2026-10-01" }, { nbMembres: 3, presences: ["non_renseignee"] });
    expect(e.avancement).toBeNull();
  });

  it("sous-groupes : la réalisation par sous-groupe, JAMAIS les présences", () => {
    const e = avec(
      { nature: "sous_groupes" },
      {
        nbMembres: 4,
        presences: ["non_renseignee", "non_renseignee"],
        sousGroupes: { total: 2, faits: 1, avecCoach: 1, ranges: 4 },
      },
    );
    expect(e.avancement?.texte).toMatch(/1 faite sur 2/);
    expect(e.avancement?.texte).not.toMatch(/présence/i);
  });

  it("sous-groupes tous faits : dit sans alerte", () => {
    const e = avec(
      { nature: "sous_groupes" },
      { sousGroupes: { total: 1, faits: 1, avecCoach: 0, ranges: 0 } },
    );
    expect(e.avancement?.texte).toMatch(/séances faites/i);
    expect(e.avancement?.alerte).toBe(false);
  });

  it("sous-groupes à venir : rien à réclamer encore", () => {
    const e = avec(
      { date: "2026-10-01", nature: "sous_groupes" },
      { sousGroupes: { total: 1, faits: 0, avecCoach: 0, ranges: 0 } },
    );
    expect(e.avancement).toBeNull();
  });

  it("sous-groupes en cours de fenêtre : suivi dès le début, sans alerte", () => {
    // Fenêtre 15 → 25 sept., aujourd'hui le 20 : les binômes travaillent, on
    // veut voir qui a fait — sans que ce soit une alerte (la fenêtre court).
    const e = avec(
      { date: "2026-09-15", dateFin: "2026-09-25", nature: "sous_groupes" },
      { sousGroupes: { total: 2, faits: 1, avecCoach: 0, ranges: 0 } },
    );
    expect(e.avancement?.texte).toMatch(/1 faite sur 2/);
    expect(e.avancement?.texte).not.toMatch(/fenêtre/i);
    expect(e.avancement?.alerte).toBe(false);
  });

  it("fenêtre REFERMÉE avec du reste : le texte le dit, pas seulement la couleur", () => {
    const e = avec(
      { date: "2026-09-01", dateFin: "2026-09-07", nature: "sous_groupes" },
      { sousGroupes: { total: 2, faits: 1, avecCoach: 0, ranges: 0 } },
    );
    expect(e.avancement?.texte).toMatch(/la fenêtre est fermée/i);
    expect(e.avancement?.alerte).toBe(true);
  });
});

describe("atelierEtat — surfaces d'édition selon la nature", () => {
  it("collectif : le lien de connexion se règle sur l'atelier", () => {
    expect(atelierEtat(base()).montreVisio).toBe(true);
  });

  it("sous-groupes : pas de lien d'atelier à régler (il vit par sous-groupe)", () => {
    expect(avec({ nature: "sous_groupes" }).montreVisio).toBe(false);
  });

  it("sous-groupes AVEC un lien déjà saisi : la surface reste (rien d'orphelin)", () => {
    expect(avec({ nature: "sous_groupes", lienVisio: "https://x.fr/v" }).montreVisio).toBe(true);
  });

  it("libellé de la page participantes selon la nature", () => {
    expect(atelierEtat(base()).libelleParticipantes).toBe("Participantes et présences");
    // En sous-groupes, « qui participe » et « comment c'est réparti » sont deux
    // pages : la première ne promet donc plus les sous-groupes.
    expect(avec({ nature: "sous_groupes" }).libelleParticipantes).toBe("Participantes");
  });

  it("sous-titre participantes : le public RÉEL quand c'est ouvert à toutes", () => {
    const e = avec({ audience: "toutes" as const });
    expect(e.sousTitreParticipantes).toMatch(/8 inscrites/);
  });

  it("sous-titre participantes : le pointage n'est réclamé que s'il reste à faire", () => {
    const aVenir = avec({ date: "2026-10-01", audience: "toutes" as const });
    expect(aVenir.sousTitreParticipantes).not.toMatch(/pointer/i);
    const passe = avec({ audience: "toutes" as const }, { presences: ["non_renseignee"] });
    expect(passe.sousTitreParticipantes).toMatch(/présences à pointer/i);
  });

  it("sous-titre coachs : la rangée raconte la MÊME chose que le QUI", () => {
    // La fiche affichait « Par sous-groupe » deux centimètres sous « autonome ».
    const autonome = avec({ nature: "sous_groupes" });
    expect(autonome.qui.texte).toMatch(/autonome/i);
    expect(autonome.sousTitreCoachs).toBe("Autonome");

    const parSousGroupe = avec(
      { nature: "sous_groupes" },
      { sousGroupes: { total: 2, faits: 0, avecCoach: 2, ranges: 0 } },
    );
    expect(parSousGroupe.qui.texte).toMatch(/coach par sous-groupe/i);
    expect(parSousGroupe.sousTitreCoachs).toBe("Coach par sous-groupe");
  });

  it("sous-titre coachs : « à trouver » seulement quand il y a lieu de chercher", () => {
    expect(avec({ date: "2026-10-01" }).sousTitreCoachs).toBe("À trouver");
    expect(avec({ date: "2026-09-01" }).sousTitreCoachs).toBe("Non consigné");
    expect(avec({ date: null }).sousTitreCoachs).toBe("Non consigné");
  });
});

describe("atelierEtat — RÉPARTITION en sous-groupes (« tout le monde a-t-il un sous-groupe ? »)", () => {
  // La raison d'être des sous-groupes, et ce que l'orga ne voyait nulle part :
  // faute de le lire sur la liste, un sous-groupe a fini par être créé comme un
  // ATELIER de plus (12 doublons en prod le 01/08).
  const enSousGroupes = (reste: Partial<AtelierEtatEntrees>) =>
    avec({ nature: "sous_groupes" }, reste);

  it("le RESTE À RANGER entre dans le QUI, en toutes lettres", () => {
    const e = enSousGroupes({
      nbMembres: 6,
      nbCohorte: 6,
      sousGroupes: { total: 2, faits: 0, avecCoach: 0, ranges: 4 },
    });
    expect(e.qui.texte).toMatch(/2 participantes à ranger/);
  });

  it("tout le monde rangé : on dit le nombre de sous-groupes, pas un manque", () => {
    const e = enSousGroupes({
      nbMembres: 6,
      nbCohorte: 6,
      sousGroupes: { total: 3, faits: 0, avecCoach: 0, ranges: 6 },
    });
    expect(e.qui.texte).toMatch(/3 sous-groupes/);
    expect(e.qui.texte).not.toMatch(/à ranger/);
  });

  it("des participantes mais aucun sous-groupe : « sous-groupes à créer »", () => {
    const e = enSousGroupes({ nbMembres: 6, nbCohorte: 6 });
    expect(e.qui.texte).toMatch(/sous-groupes à créer/);
  });

  it("personne à répartir : on ne réclame RIEN (pas de manque dans le vide)", () => {
    const e = enSousGroupes({ nbMembres: 0, nbCohorte: 0 });
    expect(e.qui.texte).not.toMatch(/à ranger|à créer/);
  });

  it("atelier PAS ENCORE DATÉ : le manque se DIT, mais ne s'alarme pas (règle 1)", () => {
    const e = avec(
      { nature: "sous_groupes", date: null },
      { nbMembres: 6, nbCohorte: 6, sousGroupes: { total: 1, faits: 0, avecCoach: 0, ranges: 2 } },
    );
    const segment = e.qui.segments.find((seg) => seg.texte.includes("à ranger"));
    expect(segment?.texte).toMatch(/4 participantes à ranger/);
    expect(segment?.alerte).toBe(false);
  });

  it("atelier À VENIR : le reste à ranger est une alerte", () => {
    const e = avec(
      { nature: "sous_groupes", date: "2026-10-01" },
      { nbMembres: 6, nbCohorte: 6, sousGroupes: { total: 1, faits: 0, avecCoach: 0, ranges: 2 } },
    );
    expect(e.qui.segments.find((seg) => seg.texte.includes("à ranger"))?.alerte).toBe(true);
  });

  it("plus de rangées que d'ensemble (participante sortie depuis) : jamais de négatif", () => {
    const e = enSousGroupes({
      nbMembres: 2,
      nbCohorte: 2,
      sousGroupes: { total: 1, faits: 0, avecCoach: 0, ranges: 3 },
    });
    expect(e.qui.texte).not.toMatch(/-\d/);
    expect(e.sousTitreSousGroupes).toMatch(/tout le monde est rangé/);
  });

  it("rangée « Sous-groupes » : elle dit le manque, pas seulement un compte", () => {
    expect(
      enSousGroupes({
        nbMembres: 6,
        nbCohorte: 6,
        sousGroupes: { total: 2, faits: 0, avecCoach: 0, ranges: 4 },
      }).sousTitreSousGroupes,
      // Le DÉNOMINATEUR est écrit : la rangée voisine « Participantes » compte
      // toutes les inscrites d'un atelier ouvert à toutes, et sans « sur 6 »
      // les deux nombres semblaient se contredire.
    ).toBe("2 sous-groupes · 2 à ranger sur 6");

    expect(enSousGroupes({ nbMembres: 6, nbCohorte: 6 }).sousTitreSousGroupes).toBe(
      "Créer les sous-groupes\u00a0: 6 participantes à répartir",
    );

    expect(
      enSousGroupes({
        nbMembres: 4,
        nbCohorte: 4,
        sousGroupes: { total: 2, faits: 0, avecCoach: 0, ranges: 4 },
      }).sousTitreSousGroupes,
    ).toBe("2 sous-groupes · tout le monde est rangé");
  });

  it("atelier collectif : aucune rangée « Sous-groupes » (rien à répartir)", () => {
    expect(atelierEtat(base()).sousTitreSousGroupes).toBeNull();
  });

  it("des sous-groupes mais PERSONNE à répartir : on compte, on ne rassure pas", () => {
    // Cas banal : l'orga crée ses binômes AVANT de dire qui participe. Dire
    // « tout le monde est rangé » serait une fausse réassurance — et la page de
    // répartition annonce, elle, « personne à répartir ». Les deux écrans
    // doivent raconter la même chose.
    const e = enSousGroupes({
      nbMembres: 0,
      nbCohorte: 0,
      sousGroupes: { total: 1, faits: 0, avecCoach: 0, ranges: 0 },
    });
    expect(e.sousTitreSousGroupes).toBe("1 sous-groupe");
    expect(e.sousTitreSousGroupes).not.toMatch(/tout le monde/i);
    expect(e.qui.texte).not.toMatch(/à ranger/);
  });
});

describe("Présences à pointer : la COHORTE porte le total, pas les lignes déjà créées", () => {
  /**
   * Sur une audience de phase ou « toutes », personne n'est inscrit
   * nominativement : la ligne de présence n'existe qu'une fois la personne
   * pointée. En comptant les lignes, une séance passée où PERSONNE n'avait
   * encore été pointé n'affichait aucune alerte — le cas le plus fréquent, et
   * précisément celui où l'orga a besoin qu'on le lui rappelle.
   */
  it("séance passée, aucune ligne encore créée : les présences se réclament quand même", () => {
    const e = avec(
      { audience: "phase" as const, date: "2026-09-01" },
      { presences: [], nbCohorte: 4 },
    );
    expect(e.avancement?.texte).toMatch(/4 présences à pointer/);
    expect(e.avancement?.alerte).toBe(true);
  });

  it("cohorte plus grande que les lignes : le reste se compte sur la cohorte", () => {
    const e = avec(
      { audience: "phase" as const, date: "2026-09-01" },
      { presences: ["presente", "presente"], nbCohorte: 5 },
    );
    expect(e.avancement?.texte).toMatch(/2 pointées sur 5/);
    expect(e.avancement?.texte).toMatch(/3 présences à pointer/);
  });

  it("toute la cohorte pointée : complet, sans alerte", () => {
    const e = avec(
      { audience: "phase" as const, date: "2026-09-01" },
      { presences: ["presente", "absente"], nbCohorte: 2 },
    );
    expect(e.avancement?.texte).toMatch(/complètes \(2\/2\)/);
    expect(e.avancement?.alerte).toBe(false);
  });

  it("cohorte vide : rien à réclamer", () => {
    const e = avec(
      { audience: "phase" as const, date: "2026-09-01" },
      { presences: [], nbCohorte: 0 },
    );
    expect(e.avancement).toBeNull();
  });
});
