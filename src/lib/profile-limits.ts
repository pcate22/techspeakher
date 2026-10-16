// Limites de saisie d'un profil speakeuse, ISOLÉES de `profile-form.ts` (qui
// charge Zod). Un composant client qui n'a besoin que de ces constantes (ex.
// `ProfileForm`, pour son compteur de caractères) les importe d'ici pour NE PAS
// embarquer Zod dans le bundle navigateur. Même découpage que `talk-limits.ts`.

/** Bio de la fiche : le champ long du profil. */
export const BIO_MAX = 1000;
/** Champs d'une ligne (titre de profil, poste, entreprise, ville…). */
export const SHORT_MAX = 120;

/** Nom du COMPTE (`users.name`, VARCHAR(255)). Ici plutôt que dans le parseur
 * Zod : le champ du formulaire a besoin de la borne pour son `maxLength`, et il
 * ne peut pas importer un module qui charge Zod. */
export const NOM_COMPTE_MAX = 255;
