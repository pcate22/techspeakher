import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getScenesRecentes } from "@/lib/agenda-public";
import { getNouvellesVenues } from "@/lib/fil-communaute";
import { listPublicationsRecentes } from "@/lib/contenus";
import {
  FIL_MAX,
  carteScene,
  carteVenue,
  carteAsso,
  fusionnerFil,
  type CarteFil as Carte,
} from "@/lib/fil-cartes";
import { aujourdhuiParis } from "@/lib/tremplin-statut";
import { getCompte } from "@/lib/users";
import { getProfileByUserId } from "@/lib/profiles";
import { getReactionsPourFil } from "@/lib/reactions";
import Avatar from "@/components/Avatar";
import ReactionRow from "@/components/ReactionRow";
import { CARTE_BOITE } from "@/components/carte-lien";
import CarteFil from "@/components/CarteFil";

export const metadata: Metadata = {
  title: "Mon espace | Tech Speak'Her",
  description: "Ton espace membre Tech Speak'Her.",
  robots: { index: false },
  alternates: { canonical: "/mon-espace" },
};

export const dynamic = "force-dynamic";

/**
 * L'ACCUEIL CONNECTÉ = LE FIL, PUR (conception v2 §4, lot N2 — maquette
 * v5.1 validée le 2026-08-07) : ce qui se passe chez nous, et l'envie qui va
 * avec. L'incitation passe PAR L'EXEMPLE (« Léa · sur scène »), jamais par
 * des injonctions — ZÉRO carte personnelle : le perso vit sur « Mon profil »
 * (marche, accès) et sur « Ma fiche publique » (complétude, soumission) ;
 * la redistribution du hub est tracée dans conception-lot-n2-fil.md §4.
 *
 * Antichronologique, fin de fil « Tu es à jour ✓ » : on veut que les membres
 * passent PEU de temps ici et beaucoup sur scène (doctrine §0). Pas
 * d'archive : les listes complètes restent publiques, le fil pointe.
 */
export default async function Accueil() {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");
  const uid = Number(session.user.id);

  const aujourdhui = aujourdhuiParis();
  // L'invariant « limite par source » : chaque source livre jusqu'à FIL_MAX
  // cartes, la fusion trie et plafonne — une carte écartée après coup ne
  // vole jamais la place d'une plus ancienne. Le nom vient de la BASE (le
  // JWT le fige à la connexion — sans ça, « Bonjour » resterait sans prénom
  // juste après une saisie).
  const [scenes, venues, contenus, compte, monProfil] = await Promise.all([
    getScenesRecentes(FIL_MAX, aujourdhui),
    getNouvellesVenues(FIL_MAX),
    listPublicationsRecentes(FIL_MAX, { avecDestination: true }),
    getCompte(uid),
    // Ma fiche (lot N4) : le bouton Bravo s'efface sur MES cartes.
    getProfileByUserId(uid),
  ]);
  const fil: Carte[] = fusionnerFil([
    ...scenes.map(carteScene),
    ...venues.map(carteVenue),
    ...contenus.map(carteAsso).filter((c): c is Carte => c !== null),
  ]);
  // Les bravos de tout le fil (lot N4) : un aller-retour APRÈS la fusion —
  // assumé, c'est le prix des cartes dérivées (conception N4 §4).
  const reactions = await getReactionsPourFil(fil);
  const estLaMienne = (carte: Carte) =>
    (carte.proprioProfileId !== null && carte.proprioProfileId === monProfil?.id) ||
    (carte.proprioUserId !== null && carte.proprioUserId === uid);
  // On applaudit une PERSONNE pour son geste : une carte INCARNÉE (une scène,
  // une arrivée, l'article d'une membre). L'actualité de l'association n'a
  // personne à féliciter — pas de rangée du tout (le SQL le borne aussi).
  const estIncarnee = (carte: Carte) =>
    carte.proprioProfileId !== null || carte.proprioUserId !== null;

  const nom = compte?.name ?? session.user.name ?? "";
  const prenom = nom.trim().split(" ")[0];

  return (
    // <div>, pas <main> : le layout racine fournit déjà le landmark principal.
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <header className="flex items-center gap-4 mb-2">
          <Avatar name={nom || "?"} image={session.user.image ?? null} size="md" />
          <div>
            <h1 className="text-2xl font-bold">
              {prenom ? `Bonjour ${prenom} 👋` : "Bonjour 👋"}
            </h1>
            <p className="text-sm text-gray-light">Quoi de neuf chez nous</p>
          </div>
        </header>

        <section aria-labelledby="fil-titre" className="flex flex-col gap-3">
          <h2 id="fil-titre" className="sr-only">
            Le fil de la communauté
          </h2>

          {fil.length > 0 ? (
            <>
              <ul role="list" className="flex flex-col gap-3 list-none">
                {fil.map((carte) => (
                  // L'ancre `carte-{cle}` : le repère du repli sans JS
                  // (conception N4 §5). La boîte vit ICI : le lien-carte et la
                  // rangée Bravo la partagent (rangée HORS du lien, RGAA).
                  <li
                    key={carte.cle}
                    id={`carte-${carte.cle}`}
                    className={CARTE_BOITE}
                  >
                    <CarteFil carte={carte} aujourdhui={aujourdhui} nue />
                    {estIncarnee(carte) && (
                    <div className="border-t border-navy-lighter px-4 py-1.5">
                      <ReactionRow
                        cible={{ type: carte.type, id: carte.id }}
                        carteNom={`${carte.nom}${carte.fait ? `, ${carte.fait}` : carte.titre ? `, ${carte.titre}` : ""}`}
                        reactions={reactions.get(carte.cle)}
                        mienne={estLaMienne(carte)}
                      />
                    </div>
                    )}
                  </li>
                ))}
              </ul>
              {/* La fin de fil est un ÉTAT, dit en mots (jamais la coche
                  seule) : pas d'archive, pas de « voir plus ». */}
              <p className="text-center text-sm text-gray-light py-4">
                <span aria-hidden="true">✓ </span>Tu es à jour.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-light bg-navy-light border border-navy-lighter rounded-2xl p-6">
              Le fil s&apos;anime avec la communauté&nbsp;: les scènes
              qu&apos;on vient de faire, les nouvelles venues de
              l&apos;annuaire et les actualités de l&apos;association arrivent ici.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
