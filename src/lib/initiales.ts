/**
 * Initiales d'un nom : premières lettres des deux premiers mots (« Cateline
 * Puccetti » → « CP », « DevFest Toulouse » → « DT »). Sert de repli visuel
 * partout où une image manque : avatar sans photo, logo de conférence non
 * déposé. Fonction PURE, sans dépendance : utilisable côté serveur comme côté
 * client (`Avatar` est un composant client, `ConferenceLogo` un composant
 * serveur — d'où l'extraction ici plutôt qu'un import de l'un vers l'autre).
 */
export function initials(name: string): string {
  const mots = name.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return "?";
  const first = mots[0]!.charAt(0);
  const second = mots.length > 1 ? mots[mots.length - 1]!.charAt(0) : "";
  return (first + second).toUpperCase();
}
