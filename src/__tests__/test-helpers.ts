import type { SpeakerProfile } from "@/lib/profiles";
import { nomAffiche } from "@/lib/profile-status";
import type { SousGroupe, MonSousGroupe } from "@/lib/tremplin-ateliers";
import type { TalkOccurrence } from "@/lib/talks";
import type { EcheanceAgenda } from "@/lib/mon-agenda";

/** Construit un FormData à partir d'un objet plat (helper de test partagé).
 * Un tableau produit des entrées répétées (champs multi : `getAll`). */
export function fd(fields: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const val of Array.isArray(v) ? v : [v]) f.append(k, val);
  }
  return f;
}

/** Requête POST multipart pour tester une route d'upload (champ `file`).
 * `file: null` simule un formulaire soumis sans fichier choisi. */
export function requestWithFile(url: string, file: File | null): Request {
  const f = new FormData();
  if (file) f.set("file", file);
  return new Request(url, { method: "POST", body: f });
}

/** Ce que le multipart transporte d'un fichier : nom, type, octets. La route
 * reçoit une RECONSTRUCTION (`Request.formData()`), pas l'objet envoyé :
 * l'égalité profonde avec l'original dépend du moteur, ce contenu non. */
export async function contenuFichier(f: File) {
  return { name: f.name, type: f.type, octets: [...new Uint8Array(await f.arrayBuffer())] };
}

/**
 * Fixture SpeakerProfile partagée : UNE seule définition de la forme complète.
 * Quand une colonne est ajoutée au profil, seule cette factory change (au lieu
 * de littéraux dupliqués dans chaque fichier de test).
 */
export function makeProfile(over: Partial<SpeakerProfile> = {}): SpeakerProfile {
  return {
    id: 1,
    userId: 7,
    slug: null,
    name: "Marie Curie",
    // Comme au bord (mapRow) : la MÊME fonction que lui — la fixture ne peut
    // pas diverger du calcul qu'elle représente.
    nomAffiche: nomAffiche(
      ("name" in over ? over.name : "Marie Curie") ?? null,
      over.titreProfil ?? null,
    ),
    image: null,
    titreProfil: null,
    poste: null,
    entreprise: null,
    bio: null,
    website: null,
    linkedin: null,
    instagram: null,
    sessionizeUrl: null,
    conferenceHallUrl: null,
    ville: null,
    codePostal: null,
    codeInsee: null,
    regionResidence: null,
    regions: [],
    langues: [],
    secteurs: [],
    sujets: [],
    contactEmailOk: false,
    isWoman: false,
    status: "brouillon",
    publishedAt: null,
    updatedAt: null,
    submittedAt: null,
    validatedBy: null,
    validatedAt: null,
    refusMotif: null,
    cfpSyncMode: "suggestions",
    ...over,
  };
}

/**
 * Fixtures de SOUS-GROUPE partagées : une seule définition de chaque forme.
 *
 * Elles ont été ajoutées après coup, au prix qu'elles évitent : le passage d'UNE
 * coach à PLUSIEURS a dû être appliqué à la main dans cinq blocs de trois
 * fichiers, tous castés `as never` — et ces casts masquaient justement la dérive
 * entre les tests et le DTO. Ici, un champ ajouté au DTO casse la compilation à
 * un seul endroit.
 */
export function makeSousGroupe(
  over: Partial<SousGroupe & { membres: number[] }> = {},
): SousGroupe & { membres: number[] } {
  return {
    id: 5,
    atelierId: 10,
    coachs: [],
    coachHeriteNom: null,
    lienVisio: null,
    faitLe: null,
    membres: [],
    ...over,
  };
}

export function makeMonSousGroupe(over: Partial<MonSousGroupe> = {}): MonSousGroupe {
  return {
    atelierId: 10,
    atelierTitre: "Lancement et structure du talk",
    sousGroupeId: 3,
    nbCoachs: 0,
    coachNoms: [],
    lienVisio: null,
    faitLe: null,
    coMembres: [],
    ...over,
  };
}

/**
 * Fixture de FICHE speakeuse publiée — une seule définition de la forme complète,
 * comme `makeProfile` pour le profil. Elle était recopiée à l'identique dans cinq
 * fichiers de test : ajouter une colonne non nullable à `SpeakerProfile` laissait
 * les cinq `as SpeakerProfile` compiler pendant que les fixtures cessaient de
 * représenter une vraie ligne.
 */
export function makeFiche(over: Partial<SpeakerProfile> = {}): SpeakerProfile {
  return {
    id: 1,
    userId: 7,
    slug: "lea-dubois",
    name: "Léa Dubois",
    // Comme au bord (mapRow) : le cast `as SpeakerProfile` en fin de factory
    // laisserait sinon le champ absent — une fixture qui ment sur le DTO.
    nomAffiche: nomAffiche(
      ("name" in over ? over.name : "Léa Dubois") ?? null,
      ("titreProfil" in over ? over.titreProfil : "Développeuse plateforme") ?? null,
    ),
    image: null,
    titreProfil: "Développeuse plateforme",
    poste: "Staff engineer",
    entreprise: "Airbus",
    bio: "Dix ans de systèmes distribués.",
    website: null,
    linkedin: "https://linkedin.com/in/lea",
    instagram: null,
    sessionizeUrl: null,
    conferenceHallUrl: null,
    ville: "Toulouse",
    codePostal: "31000",
    codeInsee: "31555",
    regionResidence: "Occitanie",
    regions: ["Occitanie"],
    langues: ["Français"],
    secteurs: ["Industrie / Manufacturing"],
    sujets: ["Cloud / DevOps / Infra"],
    contactEmailOk: true,
    isWoman: true,
    cfpSyncMode: "suggestions",
    status: "publie",
    ...over,
  } as SpeakerProfile;
}

/**
 * Une occurrence de talk (DTO `TalkOccurrence`), surchargeable.
 *
 * Même motif que `makeFiche` : le littéral était recopié dans cinq fichiers, et
 * la migration 068 (ajout de `propositionId` + `etat`) a dû les éditer un par
 * un. Une colonne de plus, un seul fichier à changer — et une fixture qui reste
 * une VRAIE ligne au lieu d'un `as TalkOccurrence` qui compile en mentant.
 */
export function makeOccurrence(over: Partial<TalkOccurrence> = {}): TalkOccurrence {
  return {
    id: 1,
    conferenceId: null,
    conferenceSlug: null,
    editionId: null,
    conference: "DevFest Toulouse",
    ville: "Toulouse",
    codeInsee: "31555",
    region: "Occitanie",
    pays: "France",
    date: "2026-11-19",
    lienConf: null,
    lienSlides: null,
    lienVideo: null,
    lienFeedback: null,
    propositionId: null,
    etat: "publiee",
    ...over,
  };
}

/**
 * Fixture d'échéance d'agenda (atelier du Tremplin) : UNE seule définition de la
 * forme, comme `makeProfile`. `ProchainAtelier` porte onze champs — recopiés
 * dans chaque fichier de test, un champ ajouté se répare autant de fois qu'il y
 * a de copies, et les copies divergent en attendant.
 */
export function makeAtelierAgenda(
  over: Partial<Extract<EcheanceAgenda, { genre: "atelier" }>> & { atelierId: number; date: string },
): EcheanceAgenda {
  return {
    genre: "atelier",
    titre: `Atelier ${over.atelierId}`,
    dateFin: null,
    heureDebut: null,
    heureFin: null,
    lieu: null,
    lienVisio: null,
    role: "participe",
    editionId: 2,
    editionNom: "Tremplin 2026",
    ...over,
  };
}
