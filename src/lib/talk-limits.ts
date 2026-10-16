// Limites de saisie d'un talk, ISOLÉES de `talk-form.ts` (qui charge Zod).
// Un composant client qui n'a besoin que de ces constantes (ex. `TalkForm`)
// les importe d'ici pour NE PAS embarquer Zod dans le bundle navigateur.

/** Limite partagée avec l'import CFP : un talk importé doit repasser ici. */
export const TITRE_MAX = 200;
// Un résumé de conférence (abstract) fait couramment 1500 à 2500 caractères :
// une limite trop basse (1000) rejetait des saisies légitimes, en silence.
export const DESCRIPTION_MAX = 3000;
