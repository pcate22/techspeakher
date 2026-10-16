import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ListPageTemplate from "@/components/ListPageTemplate";
import ListeTaches from "@/components/ListeTaches";
import PucesVue from "@/components/PucesVue";
import BandeauVue from "@/components/BandeauVue";
import { getSession } from "@/lib/auth-guards";
import { chargerTaches } from "@/lib/taches-chargement";
import { ORDRE_FAMILLES, reclameUnGeste } from "@/lib/taches";
import { VUES, cleVue, messageVide } from "@/lib/vue-liste";
import { nb } from "@/lib/format";

export const metadata: Metadata = {
  title: "À faire | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * À FAIRE — les notifications de la plateforme, dans l'espace connecté (étape
 * B, conception D5). Une seule liste par personne, trois familles possibles :
 * `chargerTaches` charge ce que la session a le droit de lire, et la page
 * n'affiche que ce qui est chargé.
 *
 * La VUE vit dans l'URL (`?vue=association`) et elle est INTERSECTÉE avec les
 * familles réellement chargées, jamais l'inverse : le paramètre filtre une
 * liste déjà autorisée, il ne sélectionne aucune donnée. Une clé absente —
 * étrangère, inventée, ou d'une famille que cette personne ne lit pas — donne
 * « Tout », silencieusement : ni erreur, ni message qui révélerait le modèle
 * de rôles (S5, R4).
 *
 * Aucun fil d'Ariane : la page devient une destination d'onglet (étape B,
 * lot 6), elle n'a plus de parent. Et le `h1` nomme l'endroit, rien d'autre —
 * le compte vit dans la méta.
 */
export default async function AFaire({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string | string[] }>;
}) {
  const session = await getSession();
  // Le proxy garde déjà le préfixe /mon-espace ; ceci est la seconde garde,
  // comme sur chaque page de l'espace (et elle sert aux rendus hors proxy).
  if (!session?.user?.id) redirect("/connexion");

  const { taches, aujourdhui } = await chargerTaches();

  // Les familles PRÉSENTES, dans l'ordre CANONIQUE (jamais celui des
  // échéances : un meuble de navigation ne change pas de place d'une visite à
  // l'autre) : ce sont elles — et rien d'autre — qui ouvrent des vues. Une
  // famille que la session ne lit pas n'est jamais chargée, donc jamais
  // filtrable : c'est l'intersection avec les capacités, par construction.
  const presentes = new Set(taches.map((t) => t.famille));
  const familles = ORDRE_FAMILLES.filter((f) => presentes.has(f));
  const vue = cleVue((await searchParams).vue, familles);
  const visibles = vue ? taches.filter((t) => t.famille === vue) : taches;

  // Puces dès que le filtre distingue quelque chose (≥ 2 familles) ; sinon,
  // une vue active garde un retour visible vers « Tout » par le bandeau —
  // c'est le cas d'une personne à famille unique arrivant par le 308 de
  // /admin/taches. Jamais les deux : deux commandes pour une destination,
  // c'est déjà dans le registre des erreurs (D4).
  const avecPuces = familles.length >= 2;
  const aFaire = taches.filter(reclameUnGeste).length;
  const constats = taches.length - aFaire;

  return (
    <ListPageTemplate
      title="À faire"
      meta={[
        aFaire > 0 ? `${nb(aFaire, "tâche")} à faire.` : "Tout ce qui attend une action.",
        "La liste se met à jour toute seule : une tâche disparaît quand c'est fait.",
        constats > 0
          ? "Les lignes « Pour information » situent, elles n'attendent aucun geste."
          : null,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {avecPuces && (
        <PucesVue
          base="/mon-espace/a-faire"
          vues={familles.map((f) => ({ cle: f, titre: VUES[f].titre }))}
          active={vue}
        />
      )}
      {vue && !avecPuces && (
        <BandeauVue
          titre={VUES[vue].titre}
          // « la liste entière », pas « N sur N » : à famille unique le filtre
          // ne retient jamais rien de moins que tout, et un second compte
          // divergerait de la méta dès qu'un constat existe (gestes vs
          // lignes). Le résumé dit ce qui EST (contrat de BandeauVue).
          resume="la liste entière"
          hrefTout="/mon-espace/a-faire"
          // Le patron du dépôt (« Voir toutes les participantes », « Voir tous
          // les ateliers ») — jamais une quatrième grammaire pour le même geste.
          libelleTout="Voir toutes les tâches"
        />
      )}
      <ListeTaches
        taches={visibles}
        aujourdhui={aujourdhui}
        // La liste porte le nom de sa vue (D5) — et un nom stable en « Tout ».
        label={vue ? `Tâches : ${VUES[vue].titre}` : "Tâches"}
        // L'étiquette de famille suit les puces : jamais dans une vue filtrée,
        // où chaque ligne dirait le nom de la vue (B5, C6).
        montreFamilles={avecPuces && vue === null}
        // Une vue valide ne peut pas être vide aujourd'hui (une clé permise
        // vient d'une famille présente) — on branche quand même son message :
        // le jour où l'intersection s'assouplit, il est déjà là.
        vide={
          vue ? messageVide(vue, taches.length > 0) : "Rien à faire pour l'instant. Tout roule."
        }
      />
    </ListPageTemplate>
  );
}

