/**
 * Nom d'édition proposé à la duplication : « Tremplin {conf} {année} », suivant
 * la convention nom de conf = « nom + lieu + année » (ex. DevFest Toulouse 2026).
 * L'année déjà présente en fin de nom de conf est REMPLACÉE par l'année cible
 * (« DevFest Toulouse 2026 » + 2027 → « Tremplin DevFest Toulouse 2027 ») ;
 * sans conf connue (nouvelle conférence), on retombe sur « Tremplin {année} ».
 * Pur et sans accès BDD (importable côté client — la modale recalcule la
 * proposition quand la conf ou l'année change).
 */
export function nomEditionPropose(confNom: string | null, annee: number | null): string {
  const base = (confNom ?? "").replace(/\s+(?:19|20)\d{2}\s*$/, "").trim();
  return ["Tremplin", base || null, annee !== null ? String(annee) : null]
    .filter(Boolean)
    .join(" ");
}
