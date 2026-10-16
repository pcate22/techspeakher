import { accompagnement } from "@/data/tremplin";
import type { Participante, Resultat } from "@/types";
import type { EditionInput } from "@/lib/tremplin-editions";
import type { AtelierInput } from "@/lib/tremplin-ateliers";
import type { RegistrationInput } from "@/lib/tremplin-registrations";

/**
 * Construit une édition « Tremplin 1 » de démonstration (DevFest 2026) à partir
 * des figurantes ci-dessous et des thèmes d'ateliers de `src/data/tremplin.ts`.
 *
 * Fonction **pure** (pas d'accès DB). Elle ne sert plus qu'aux TESTS : l'action
 * orga qui l'insérait a été retirée (619229ea), et ni le décor de preview
 * (`db/seed-preview.sql`) ni `scripts/seed-e2e.mjs` ne l'importent. Si on la
 * rebranchait un jour : sa détection « déjà importée » se fait par nom et année,
 * elle créerait donc une édition de figurantes à côté d'une édition renommée.
 *
 * Ne produit **aucune** donnée réelle de personne (figurantes, ateliers). Les
 * données privées (liens des retours jury, vidéos, les 4 inscrites non
 * finalistes) sont ajoutées ensuite par l'orga via l'admin, jamais committées.
 */

/** Identité de la 1ʳᵉ édition — source unique (seed + détection « déjà importée »). */
export const TREMPLIN1_NOM = "Tremplin 2026";
export const TREMPLIN1_ANNEE = 2026;

/** Slug d'URL de la conf (cf. /tremplin/[conf]/[annee]). */
export const TREMPLIN1_CONF_SLUG = "devfest-toulouse";

const EDITION: EditionInput = {
  nom: TREMPLIN1_NOM,
  annee: TREMPLIN1_ANNEE,
  confSlug: TREMPLIN1_CONF_SLUG,
  // L'édition vit jusqu'au DevFest (19 nov.) : coachings post-soirée en cours.
  // La fenêtre d'inscriptions (12 mars → 17 avril, cf. actualités) est passée :
  // le libellé affiché est « En cours », jamais « Inscriptions ouvertes ».
  // À archiver après la conférence.
  statut: "en_cours",
  description:
    "Première édition du Tremplin Tech Speak'Her : 12 inscrites, 8 finalistes à la soirée du 4 juin, 3 gagnantes.",
  confNom: "DevFest",
  confLieu: "Toulouse",
  confDate: "2026-11-19",
  confLien: "https://devfesttoulouse.fr/",
  finaleDate: "2026-06-04",
  finaleLieu: "BPCE Solutions informatiques, Toulouse",
  inscriptionsDebut: "2026-03-12",
  inscriptionsFin: "2026-04-17",
};

// Les 5 ateliers se sont tenus le midi (12h45-13h45).
const HEURE_DEBUT = "12:45";
const HEURE_FIN = "13:45";

/**
 * FIGURANTES du Tremplin 1, pour les TESTS (voir plus haut).
 *
 * Ce fichier portait les vraies finalistes (nom, bio, LinkedIn). Le code
 * devient public : une donnée personnelle n'a rien à y faire, consentement ou
 * pas, et un retrait de consentement doit pouvoir s'appliquer partout. Les
 * vraies données du Tremplin 1 vivent en base de production, où l'admin
 * applique les accords et les retraits (depuis le lot 4). Remplacées par des
 * figurantes le 2026-10-15 ; même nombre, même forme, même palmarès (rangs).
 */
export const TREMPLIN1_PARTICIPANTES: Participante[] = [
  {
    name: "Alice Moreau",
    role: "Ingénieure innovation · Figurante SAS",
    bio: "Ingénieure et coach, elle pilote des projets d'innovation dans l'industrie depuis quinze ans.",
    sujet: "Tenir tête à un géant du logiciel grâce aux standards ouverts",
    linkedin: "https://www.linkedin.com/in/alice-moreau-demo/",
  },
  {
    name: "Inès Bernard",
    role: "Directrice de programmes",
    bio: "Docteure en biologie devenue directrice de programmes, elle range le chaos des grands projets.",
    sujet: "Dire oui à tout, c'est dire non à son projet",
    linkedin: "https://www.linkedin.com/in/ines-bernard-demo/",
  },
  {
    name: "Julie Lambert",
    role: "Développeuse front-end · Exemple Air",
    bio: "Développeuse Angular, elle travaille sur des applications qui doivent durer dix ans.",
    sujet: "Votre projet devient legacy plus vite que prévu",
    linkedin: "https://www.linkedin.com/in/julie-lambert-demo/",
  },
  {
    name: "Clara Fontaine",
    role: "Ingénieure pédagogique",
    bio: "Ingénieure pédagogique indépendante, elle aide les équipes produit à former leurs utilisatrices.",
    sujet: "Apprendre fait partie de l'expérience produit",
    linkedin: "https://www.linkedin.com/in/clara-fontaine-demo/",
  },
  {
    name: "Nina Rousseau",
    role: "Responsable développement · Association Exemple",
    bio: "Elle anime des ateliers pour donner envie aux jeunes filles d'aller vers la tech et l'IA.",
    sujet: "Votre IA a un biais, et il porte un nom",
    linkedin: "https://www.linkedin.com/in/nina-rousseau-demo/",
  },
  {
    name: "Sarah Lemoine",
    role: "Ingénieure docteure · IA appliquée",
    bio: "Dix ans de R&D en simulation numérique, elle accompagne aujourd'hui l'IA en production.",
    sujet: "L'IA face au monde physique",
    linkedin: "https://www.linkedin.com/in/sarah-lemoine-demo/",
  },
  {
    name: "Hélène Garnier",
    role: "Product Manager",
    bio: "Product Manager et co-organisatrice d'une communauté IA, elle forme régulièrement des équipes.",
    sujet: "Superviser un agent de plus, sans s'épuiser",
    linkedin: "https://www.linkedin.com/in/helene-garnier-demo/",
  },
  {
    name: "Zoé Marchand",
    role: "Cheffe de projets IT",
    bio: "Cheffe de projets IT, elle a déployé un agent IA sur un support informatique.",
    sujet: "L'IA avait faim, et les données manquaient",
    linkedin: "https://www.linkedin.com/in/zoe-marchand-demo/",
  },
];

/** Palmarès des figurantes (mêmes rangs que la soirée du 4 juin 2026). */
export const TREMPLIN1_RESULTATS: Resultat[] = [
  {
    place: "1ᵉʳ prix",
    nom: "Sarah Lemoine",
    titreTalk: "L'IA face au monde physique",
    linkedin: "https://www.linkedin.com/in/sarah-lemoine-demo/",
  },
  {
    place: "2ᵉ prix",
    nom: "Alice Moreau",
    titreTalk: "Tenir tête à un géant du logiciel grâce aux standards ouverts",
    linkedin: "https://www.linkedin.com/in/alice-moreau-demo/",
  },
  {
    place: "3ᵉ prix",
    nom: "Nina Rousseau",
    titreTalk: "Votre IA a un biais, et il porte un nom",
    linkedin: "https://www.linkedin.com/in/nina-rousseau-demo/",
  },
];

export interface Tremplin1Seed {
  edition: EditionInput;
  ateliers: AtelierInput[];
  registrations: RegistrationInput[];
}

export function buildTremplin1Seed(): Tremplin1Seed {
  const ateliers: AtelierInput[] = accompagnement.map((theme, i) => {
    // `number` est "01".."05" ; si un libellé non numérique apparaît un jour,
    // on retombe sur la position dans la liste (jamais NaN → pas de rollback).
    const n = Number(theme.number);
    return {
      ordre: Number.isNaN(n) ? i + 1 : n,
      titre: theme.title,
      date: theme.dateEnd ?? null,
      heureDebut: HEURE_DEBUT,
      heureFin: HEURE_FIN,
      description: theme.description,
      lienVisio: null,
      // Parcours PUBLIC du Tremplin 1 : ces ateliers étaient ouverts à toutes
      // (même état que le backfill de la migration 030 en prod).
      audience: "toutes" as const,
    };
  });

  // Classement des gagnantes (palmarès public), par nom : le rang entier dérivé
  // du libellé (« 1ᵉʳ prix » → 1). Le libellé se recalcule à l'affichage.
  const classementParNom = new Map(
    TREMPLIN1_RESULTATS.map((r) => [r.nom, Number.parseInt(r.place, 10) || null]),
  );

  // Les 8 finalistes (figurantes, `public = true` pour exercer la galerie). Saisies orga (userId null) : rattachées à un compte quand
  // chacune se connecte (Lot A3). Le palmarès public lit nom/sujet/classement.
  // ⚠️ Depuis que bio/rôle/site/photo viennent de la FICHE speakeuse (compte
  // relié, publiée) et NON plus de l'inscription, ces champs ci-dessous ne
  // s'affichent dans la galerie qu'une fois la finaliste reliée + sa fiche
  // publiée (cf. docs/dette-technique.md : « galerie finalistes T1 »).
  const registrations: RegistrationInput[] = TREMPLIN1_PARTICIPANTES.map((p) => ({
    userId: null,
    participanteNom: p.name,
    participanteRole: p.role,
    participanteLinkedin: p.linkedin,
    statut: "acceptee",
    // Titre primé figé pour les seules classées (palmarès) : sans compte ni
    // talk, leur titre ne vit que là. Les autres finalistes T1 n'ont pas de
    // titre en galerie tant qu'elles ne relient pas un compte + un talk.
    titrePalmares: classementParNom.get(p.name) != null ? p.sujet : null,
    finalePresente: true,
    public: true,
    classement: classementParNom.get(p.name) ?? null,
    bio: p.bio,
    siteWeb: p.website ?? null,
    photoUrl: null, // photos hébergées hors repo, ajoutées via l'admin plus tard
  }));

  return { edition: EDITION, ateliers, registrations };
}
