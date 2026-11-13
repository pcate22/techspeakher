/**
 * Publication express : un nom repris tel quel du compte Google ou LinkedIn
 * n'a pas été écrit à la main, la fiche peut paraître tout de suite. Tout autre
 * nom (modifié, ou compte sans nom) passe par la relecture d'une orga.
 */
export function doitEtreRelue(nomSaisi: string, nomCompte: string | null): boolean {
  const compte = nomCompte?.trim();
  if (!compte) return true;
  return nomSaisi.trim() !== compte;
}
