import { permanentRedirect } from "next/navigation";

/**
 * La galerie des participantes est désormais servie par la page d'édition
 * pilotée par la BDD : c'est elle qui respecte le consentement (une personne
 * masquée via l'admin en disparaît immédiatement). L'ancienne page STATIQUE
 * court-circuitait ce mécanisme (noms/bios figés dans le code) — on la
 * redirige définitivement (308, préserve les liens existants et le SEO).
 */
export default function ParticipantesRedirect() {
  permanentRedirect("/tremplin/devfest-toulouse/2026#participantes");
}
