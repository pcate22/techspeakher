import { describe, it, expect } from "vitest";
import {
  parseDocumentForm,
  parseAttachForm,
  parseRegistrationDetailsForm,
  parsePhotoForm,
  parseAtelierForm,
  parseEditionForm,
  parseEditionUpdateForm,
  slugify,
} from "@/lib/tremplin-form";
import { fd } from "./test-helpers";

describe("parseDocumentForm", () => {
  it("portée atelier : valide un support avec lien http(s)", () => {
    const r = parseDocumentForm(
      fd({ portee: "atelier", type: "support_atelier", titre: "Slides", lien: "https://docs.google.com/x", atelierId: "10" }),
      1,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.atelierId).toBe(10);
      expect(r.data.registrationId).toBeNull();
      expect(r.data.lien).toBe("https://docs.google.com/x");
      expect(r.data.auteurId).toBe(1);
    }
  });

  it("portée générale (défaut) : ignore atelierId/registrationId fournis → document pour toutes", () => {
    const r = parseDocumentForm(
      fd({ titre: "Charte", lien: "https://x.fr", atelierId: "10", registrationId: "5" }),
      1,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.atelierId).toBeNull();
      expect(r.data.registrationId).toBeNull();
    }
  });

  it("portée participante : ne garde que registrationId", () => {
    const r = parseDocumentForm(
      fd({ portee: "participante", titre: "Retour", contenu: "Bravo", registrationId: "5", atelierId: "10" }),
      1,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.registrationId).toBe(5);
      expect(r.data.atelierId).toBeNull();
    }
  });

  it("portée atelier sans atelier choisi : invalide", () => {
    expect(parseDocumentForm(fd({ portee: "atelier", titre: "X", lien: "https://x.fr" }), 1).ok).toBe(false);
  });

  it("portée participante sans participante choisie : invalide", () => {
    expect(parseDocumentForm(fd({ portee: "participante", titre: "X", contenu: "y" }), 1).ok).toBe(false);
  });

  it("refuse sans support (ni lien ni contenu)", () => {
    expect(parseDocumentForm(fd({ titre: "Vide" }), 1).ok).toBe(false);
  });

  it("refuse un lien non http(s) (javascript:)", () => {
    const r = parseDocumentForm(fd({ titre: "X", lien: "javascript:alert(1)" }), 1);
    expect(r.ok).toBe(false);
  });

  it("accepte un document en contenu texte seul", () => {
    const r = parseDocumentForm(fd({ type: "note", titre: "Consignes", contenu: "Bravo !" }), 1);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.lien).toBeNull();
      expect(r.data.contenu).toBe("Bravo !");
    }
  });

  it("garde RGPD : un retour du jury / une vidéo de pitch exige une participante cible", () => {
    // En portée générale ou atelier, un document personnel partirait en
    // « partagé » (servi à toutes les inscrites) : refusé.
    expect(parseDocumentForm(fd({ type: "feedback_jury", titre: "Retour", contenu: "Bravo" }), 1).ok).toBe(false);
    expect(
      parseDocumentForm(
        fd({ portee: "atelier", type: "video_pitch", titre: "Vidéo", lien: "https://x.fr/v", atelierId: "10" }),
        1,
      ).ok,
    ).toBe(false);
    // Sur la fiche de la participante : accepté.
    expect(
      parseDocumentForm(
        fd({ portee: "participante", type: "feedback_jury", titre: "Retour", contenu: "Bravo", registrationId: "5" }),
        1,
      ).ok,
    ).toBe(true);
  });
});

describe("parseAttachForm", () => {
  it("chemin e-mail : valide editionId / registrationId / email ; compteId null ; nom facultatif → null", () => {
    const r = parseAttachForm(fd({ editionId: "1", registrationId: "5", email: "A@B.fr" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.compteId).toBeNull(); // pas de compte choisi
      expect(r.data.email).toBe("a@b.fr"); // normalisé en minuscules
      expect(r.data.nom).toBeNull(); // pas de nom saisi
    }
  });

  it("chemin compte : un compteId choisi → rattachement direct, sans e-mail requis", () => {
    const r = parseAttachForm(fd({ editionId: "1", registrationId: "5", compteId: "42" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.compteId).toBe(42);
      expect(r.data.email).toBeNull(); // le compte existe déjà, pas d'invitation
    }
  });

  it("capture le prénom/nom quand il est saisi (trim)", () => {
    const r = parseAttachForm(
      fd({ editionId: "1", registrationId: "5", email: "a@b.fr", nom: "  Ada Lovelace  " }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.nom).toBe("Ada Lovelace");
  });

  it("sans compte choisi, refuse un e-mail invalide", () => {
    expect(parseAttachForm(fd({ editionId: "1", registrationId: "5", email: "pas-un-email" })).ok).toBe(false);
  });

  it("refuse des identifiants manquants", () => {
    expect(parseAttachForm(fd({ email: "a@b.fr" })).ok).toBe(false);
  });
});

describe("parseRegistrationDetailsForm", () => {
  it("garde le classement + les identifiants, ignore le reste", () => {
    const r = parseRegistrationDetailsForm(
      fd({ editionId: "1", registrationId: "5", classement: "1" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.editionId).toBe(1);
      expect(r.data.registrationId).toBe(5);
      expect(r.data.classement).toBe(1);
    }
  });

  it("classement vide → null (non classée)", () => {
    const r = parseRegistrationDetailsForm(fd({ editionId: "1", registrationId: "5" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.classement).toBeNull();
  });

  it("refuse un classement invalide (0, non entier)", () => {
    const ids = { editionId: "1", registrationId: "5" };
    // Classement : entier >= 1 ou vide (0 / négatif / non entier refusés).
    expect(parseRegistrationDetailsForm(fd({ ...ids, classement: "0" })).ok).toBe(false);
    expect(parseRegistrationDetailsForm(fd({ ...ids, classement: "1er" })).ok).toBe(false);
    expect(parseRegistrationDetailsForm(fd({ ...ids, classement: "2" })).ok).toBe(true);
  });

  it("refuse des identifiants manquants", () => {
    expect(parseRegistrationDetailsForm(fd({ classement: "1" })).ok).toBe(false);
  });
});

describe("parsePhotoForm", () => {
  it("valide URL + légende + type + personnes taguées", () => {
    const f = new FormData();
    f.append("editionId", "1");
    f.append("url", "exemple.fr/photo.jpg");
    f.append("legende", "  Le podium  ");
    f.append("kind", "podium");
    f.append("personnes", "5");
    f.append("personnes", "8");
    const r = parsePhotoForm(f);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.editionId).toBe(1);
      expect(r.data.url).toBe("https://exemple.fr/photo.jpg"); // schéma préfixé
      expect(r.data.legende).toBe("Le podium");
      expect(r.data.kind).toBe("podium");
      expect(r.data.registrationIds).toEqual([5, 8]);
    }
  });

  it("URL obligatoire (vide → invalide)", () => {
    expect(parsePhotoForm(fd({ editionId: "1" })).ok).toBe(false);
  });

  it("refuse une URL non http(s) (anti-XSS)", () => {
    expect(parsePhotoForm(fd({ editionId: "1", url: "javascript:alert(1)" })).ok).toBe(false);
  });

  it("type inconnu → 'autre' par défaut ; personnes vides → []", () => {
    const r = parsePhotoForm(fd({ editionId: "1", url: "https://x.fr/p.jpg", kind: "n_importe_quoi" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.kind).toBe("autre");
      expect(r.data.registrationIds).toEqual([]);
    }
  });

  it("refuse une édition invalide", () => {
    expect(parsePhotoForm(fd({ editionId: "0", url: "https://x.fr/p.jpg" })).ok).toBe(false);
  });

  it("filtre les personnes non numériques / ≤ 0 et conserve l'ordre (dédup déféré au lib)", () => {
    const f = new FormData();
    f.append("editionId", "1");
    f.append("url", "https://x.fr/p.jpg");
    for (const v of ["5", "abc", "-1", "0", "8", "5"]) f.append("personnes", v);
    const r = parsePhotoForm(f);
    expect(r.ok).toBe(true);
    // Seuls les entiers > 0 survivent ; les doublons sont laissés à setPhotoPersons.
    if (r.ok) expect(r.data.registrationIds).toEqual([5, 8, 5]);
  });
});

describe("parseAtelierForm", () => {
  it("valide titre + date + lien visio + coachs + membres", () => {
    const f = new FormData();
    f.append("editionId", "1");
    f.append("titre", "  Coaching DevFest  ");
    f.append("date", "2026-09-15");
    f.append("description", "Préparer ses slides");
    f.append("lienVisio", "meet.example/x");
    f.append("coachs", "Lucile, Sandrine");
    f.append("membres", "5");
    f.append("membres", "8");
    const r = parseAtelierForm(f);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.editionId).toBe(1);
      expect(r.data.atelier.titre).toBe("Coaching DevFest"); // trim
      expect(r.data.atelier.date).toBe("2026-09-15");
      expect(r.data.atelier.lienVisio).toBe("https://meet.example/x"); // schéma préfixé
      expect(r.data.atelier.coachs).toBe("Lucile, Sandrine");
      expect(r.data.registrationIds).toEqual([5, 8]);
    }
  });

  it("titre requis", () => {
    expect(parseAtelierForm(fd({ editionId: "1", titre: "" })).ok).toBe(false);
  });

  it("date au mauvais format → invalide", () => {
    expect(parseAtelierForm(fd({ editionId: "1", titre: "A", date: "15/09/2026" })).ok).toBe(false);
  });

  it("date au bon format mais impossible (2026-02-31) → invalide", () => {
    expect(parseAtelierForm(fd({ editionId: "1", titre: "A", date: "2026-02-31" })).ok).toBe(false);
  });

  it("date vide → null (atelier sans date)", () => {
    const r = parseAtelierForm(fd({ editionId: "1", titre: "A", date: "" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.atelier.date).toBeNull();
  });

  it("lien visio non http(s) → invalide", () => {
    expect(parseAtelierForm(fd({ editionId: "1", titre: "A", lienVisio: "javascript:alert(1)" })).ok).toBe(false);
  });

  it("sans membre → liste vide (atelier ouvert à toutes)", () => {
    const r = parseAtelierForm(fd({ editionId: "1", titre: "A" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.registrationIds).toEqual([]);
  });

  it("édition invalide → refus", () => {
    expect(parseAtelierForm(fd({ editionId: "0", titre: "A" })).ok).toBe(false);
  });
});

describe("slugify", () => {
  it("nom de conf → identifiant d'URL (minuscules, accents, tirets)", () => {
    expect(slugify("Devoxx France")).toBe("devoxx-france");
    expect(slugify(" Éé àù — Web2Day ! ")).toBe("ee-au-web2day");
    expect(slugify("DevFest Toulouse")).toBe("devfest-toulouse");
  });
});

describe("parseEditionForm", () => {
  const base = {
    nom: "Tremplin 2027",
    annee: "2027",
    confNom: "Devoxx France",
  };

  it("valide et déduit le slug du nom de la conférence ; statut = preparation", () => {
    const r = parseEditionForm(
      fd({ ...base, confDate: "2027-04-15", confLien: "devoxx.fr", finaleLieu: "Paris" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.confSlug).toBe("devoxx-france"); // déduit
      expect(r.data.statut).toBe("preparation"); // invisible du public à la création
      expect(r.data.annee).toBe(2027);
      expect(r.data.confLien).toBe("https://devoxx.fr"); // schéma préfixé
      expect(r.data.finaleDate).toBeNull();
    }
  });

  it("slug explicite prioritaire (normalisé en minuscules)", () => {
    const r = parseEditionForm(fd({ ...base, confSlug: "Devoxx" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.confSlug).toBe("devoxx");
  });

  it("lieu (ville ou pays) : conservé, et intégré au slug déduit (marque + lieu)", () => {
    const r = parseEditionForm(fd({ nom: "Tremplin 2027", annee: "2027", confNom: "DevFest", confLieu: "Toulouse" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.confLieu).toBe("Toulouse");
      expect(r.data.confSlug).toBe("devfest-toulouse"); // slugify("DevFest Toulouse")
    }
  });

  it("lieu optionnel : absent → marque seule pour le slug", () => {
    const r = parseEditionForm(fd({ nom: "Mix-IT 2027", annee: "2027", confNom: "Mix-IT" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.confLieu).toBeNull();
      expect(r.data.confSlug).toBe("mix-it");
    }
  });

  it("refuse une année dans le nom de la conférence (c'est l'édition, pas la conf)", () => {
    expect(parseEditionForm(fd({ ...base, confNom: "DevFest Toulouse 2026" })).ok).toBe(false);
    expect(parseEditionForm(fd({ ...base, confNom: "Devoxx 2027" })).ok).toBe(false);
    // Un nom sans année reste valide.
    expect(parseEditionForm(fd({ ...base, confNom: "DevFest Toulouse" })).ok).toBe(true);
  });

  it("refuse un slug invalide, une année hors bornes, une date impossible", () => {
    expect(parseEditionForm(fd({ ...base, confSlug: "devoxx france" })).ok).toBe(false);
    expect(parseEditionForm(fd({ ...base, annee: "1999" })).ok).toBe(false);
    expect(parseEditionForm(fd({ ...base, annee: "27" })).ok).toBe(false);
    expect(parseEditionForm(fd({ ...base, confDate: "2027-02-31" })).ok).toBe(false);
  });

  it("refuse nom / conférence manquants, et un nom de conf sans slug possible", () => {
    expect(parseEditionForm(fd({ ...base, nom: "" })).ok).toBe(false);
    expect(parseEditionForm(fd({ ...base, confNom: "" })).ok).toBe(false);
    expect(parseEditionForm(fd({ ...base, confNom: "!!!" })).ok).toBe(false); // slugify → vide
  });

  it("accepte la fenêtre d'inscriptions ; refuse fin avant début", () => {
    const r = parseEditionForm(
      fd({ ...base, inscriptionsDebut: "2027-01-10", inscriptionsFin: "2027-02-28" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.inscriptionsDebut).toBe("2027-01-10");
      expect(r.data.inscriptionsFin).toBe("2027-02-28");
    }
    const bad = parseEditionForm(
      fd({ ...base, inscriptionsDebut: "2027-02-28", inscriptionsFin: "2027-01-10" }),
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/fin des inscriptions/i);
  });

  it("une seule borne d'inscriptions suffit (début OU fin)", () => {
    const debutSeul = parseEditionForm(fd({ ...base, inscriptionsDebut: "2027-01-10" }));
    expect(debutSeul.ok).toBe(true);
    if (debutSeul.ok) expect(debutSeul.data.inscriptionsFin).toBeNull();
    const finSeule = parseEditionForm(fd({ ...base, inscriptionsFin: "2027-02-28" }));
    expect(finSeule.ok).toBe(true);
  });
});

describe("parseEditionUpdateForm", () => {
  const base = {
    editionId: "3",
    nom: "Tremplin 2027",
    confNom: "Devoxx France",
  };

  it("valide les champs éditoriaux (le statut a sa propre action, sous-page dédiée)", () => {
    const r = parseEditionUpdateForm(fd({ ...base, finaleDate: "2027-06-10", finaleLieu: "Paris" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.editionId).toBe(3);
      expect(r.data.update.finaleDate).toBe("2027-06-10");
      expect("statut" in r.data.update).toBe(false);
    }
  });

  it("refuse une date impossible, une édition invalide", () => {
    expect(parseEditionUpdateForm(fd({ ...base, confDate: "2027-02-31" })).ok).toBe(false);
    expect(parseEditionUpdateForm(fd({ ...base, editionId: "0" })).ok).toBe(false);
  });

  it("lieu conservé ; année dans le nom de conf refusée (même garde qu'à la création)", () => {
    const r = parseEditionUpdateForm(fd({ ...base, confNom: "DevFest", confLieu: "Toulouse" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.update.confLieu).toBe("Toulouse");
    expect(parseEditionUpdateForm(fd({ ...base, confNom: "DevFest Toulouse 2026" })).ok).toBe(false);
  });

  it("fenêtre d'inscriptions : acceptée dans l'ordre, refusée à l'envers", () => {
    const r = parseEditionUpdateForm(
      fd({ ...base, inscriptionsDebut: "2027-01-10", inscriptionsFin: "2027-02-28" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.update.inscriptionsDebut).toBe("2027-01-10");
    expect(
      parseEditionUpdateForm(
        fd({ ...base, inscriptionsDebut: "2027-02-28", inscriptionsFin: "2027-01-10" }),
      ).ok,
    ).toBe(false);
  });
});

describe("parseEditionForm / parseEditionUpdateForm — conferenceEditionId (référence)", () => {
  const base = {
    nom: "Tremplin 2027",
    annee: "2027",
    confNom: "DevFest Toulouse",
  };

  it("vide → null (édition non reliée) ; entier → relayé", () => {
    const sans = parseEditionForm(fd(base));
    expect(sans).toMatchObject({ ok: true, data: { conferenceEditionId: null } });

    const avec = parseEditionForm(fd({ ...base, conferenceEditionId: "42" }));
    expect(avec).toMatchObject({ ok: true, data: { conferenceEditionId: 42 } });
  });

  it("valeur douteuse → erreur explicite (jamais NaN en base)", () => {
    const r = parseEditionForm(fd({ ...base, conferenceEditionId: "abc" }));
    expect(r.ok).toBe(false);
  });

  it("le formulaire de modification relaie aussi le lien", () => {
    const r = parseEditionUpdateForm(
      fd({
        editionId: "3",
        nom: "Tremplin 2027",
        statut: "ouvert",
        confNom: "DevFest Toulouse",
        conferenceEditionId: "7",
      }),
    );
    expect(r).toMatchObject({ ok: true, data: { update: { conferenceEditionId: 7 } } });
  });
});
