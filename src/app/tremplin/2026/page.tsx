import { permanentRedirect } from "next/navigation";

/**
 * L'édition 2026 est désormais servie par la route dynamique pilotée par la BDD
 * (`/tremplin/[conf]/[annee]`). On préserve l'ancienne URL avec une redirection
 * permanente (308) pour les liens existants et le SEO.
 */
export default function Tremplin2026Redirect() {
  permanentRedirect("/tremplin/devfest-toulouse/2026");
}
