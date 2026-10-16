import BottomNav from "@/components/BottomNav";
import RailEspace from "@/components/RailEspace";
import { getSession } from "@/lib/auth-guards";
import { getFeuilleDonnees, type FeuilleDonnees } from "@/lib/feuille-creer";
import { desTachesAttendent } from "@/lib/taches-chargement";

/** Repli de la feuille quand sa lecture échoue : aucun geste qu'on ne saurait
 * honorer. Le rôle orga, lui, vient de la SESSION, pas de la lecture qui a
 * échoué : il est gardé (le groupe Organisation du rail reste). */
const feuilleNeutre = (orga: boolean): FeuilleDonnees => ({
  creation: null,
  orga,
  editions: [],
  talks: [],
});

/**
 * Les deux navigations de l'espace côté serveur — la barre basse (mobile) et
 * le rail (bureau, refonte du 2026-10-15) — avec leurs données : session,
 * feuille ➕, point de « À faire ». PARTAGÉE par les layouts `/mon-espace` et
 * `/admin` via `CoquilleEspace` (la coquille d'app reste cohérente quand une
 * orga passe d'un espace à l'autre). Rendue dans un `<Suspense>` : le contenu
 * de la page streame sans attendre ces lectures.
 *
 * Sans session, rien — chaque page fait déjà sa redirection vers /connexion.
 */
export default async function NavEspaceServeur() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const user = session.user;

  const [feuille, attend] = await Promise.all([
    // Même filet que le point, pour la même raison : ces navigations sont
    // montées par les deux layouts, elles n'ont pas le droit d'emporter
    // chaque écran. La feuille était la branche SANS filet de ce Promise.all
    // (dette du 2026-08-18, soldée ici) ; un repli neutre ne promet rien.
    getFeuilleDonnees({
      id: user.id,
      isOrga: user.isOrga === true,
    }).catch((e) => {
      console.error("getFeuilleDonnees a échoué, navigation sans création :", e);
      return feuilleNeutre(user.isOrga === true);
    }),
    // Le point de « À faire » (D3) : la porte gardée par la session, mémoïsée
    // par requête — sur la page « À faire » elle-même, la barre et l'écran
    // partagent un seul chargement. Et si le signal ÉCHOUE, l'onglet
    // s'affiche sans point : la barre est montée par les deux layouts, elle
    // n'a pas le droit d'emporter chaque écran avec elle. Un onglet muet est
    // honnête ; une app blanche ne l'est pas.
    desTachesAttendent().catch((e) => {
      // La trace, parce que ce silence est double : la page « À faire »
      // échoue bruyamment sur la même panne, mais une base durablement
      // malade éteindrait le point pour toujours sans une ligne de log
      // (relevé par les passes sécurité ET justesse du 2026-08-18).
      console.error("desTachesAttendent a échoué, onglet muet :", e);
      return false;
    }),
  ]);

  return (
    <>
      <RailEspace feuille={feuille} attend={attend} />
      <BottomNav
        nom={user.name ?? user.email ?? "?"}
        image={user.image ?? null}
        feuille={feuille}
        attend={attend}
      />
    </>
  );
}
