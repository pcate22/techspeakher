import Link from "next/link";
import ExternalLink, { isSafeHttpUrl } from "@/components/ExternalLink";
import Heures from "@/components/Heures";
import QuandAtelier from "@/components/QuandAtelier";
import { metaLine } from "@/components/AtelierDetail";
import { hrefEcheance, type EcheanceAgenda } from "@/lib/mon-agenda";

/**
 * UNE échéance de l'agenda personnel (home « À venir » + onglet Agenda), façon
 * rangée d'app calendrier : barre de couleur, titre (+ badge), méta, heures en
 * colonne droite. La carte ENTIÈRE se tape et mène au détail (`e.href`, lien
 * étiré sur le titre) ; le lien visio/conférence reste un raccourci secondaire
 * (au-dessus du lien étiré, `z-10`).
 *
 * - `montreDate` : la home affiche la date sur la rangée ; l'onglet Agenda la
 *   porte déjà en en-tête de jour (seule la PÉRIODE d'une fenêtre reste dite).
 * - La couleur de barre distingue les genres, l'info reste portée par le texte
 *   (badge « Talk », « Tu animes », nom de la conférence — RGAA, jamais la
 *   couleur seule).
 */
export default function EcheanceCard({
  e,
  montreDate = true,
}: {
  e: EcheanceAgenda;
  montreDate?: boolean;
}) {
  const estAtelier = e.genre === "atelier";
  const barre = !estAtelier
    ? "bg-cyan"
    : e.role === "anime"
      ? "bg-magenta"
      : e.role === "organise"
        ? "bg-silver"
        : "bg-gold";
  // Le rôle est toujours DIT (jamais la couleur de barre seule, RGAA).
  const badge = estAtelier
    ? e.role === "anime"
      ? { texte: "Tu animes", cls: "border-magenta/40 text-magenta-light" }
      : e.role === "organise"
        ? { texte: "Tu organises", cls: "border-silver/40 text-silver" }
        : null
    : { texte: "Talk", cls: "border-cyan/40 text-cyan" };
  const dateFin = estAtelier ? e.dateFin : null;
  // Sous un en-tête de jour (montreDate=false), seule une FENÊTRE reste dite.
  const quand =
    montreDate || dateFin ? (
      <QuandAtelier key="q" date={e.date} dateFin={dateFin} weekday={montreDate} />
    ) : null;
  // Home (montreDate) : le « quand » complet vit dans la méta. Agenda : la
  // colonne droite porte les heures, sous l'en-tête de jour.
  const heures = estAtelier ? { debut: e.heureDebut, fin: e.heureFin } : null;
  const heuresMeta =
    montreDate && heures?.debut ? (
      <Heures key="h" debut={heures.debut} fin={heures.fin} />
    ) : null;
  const meta = estAtelier
    ? metaLine([quand, heuresMeta, e.lieu, e.editionNom])
    : metaLine([quand, e.conference, e.ville]);
  const secondaire = estAtelier ? e.lienVisio : e.lienConf;
  const lienSecondaire =
    secondaire && isSafeHttpUrl(secondaire)
      ? { href: secondaire, label: estAtelier ? "Rejoindre la visio" : "Voir la conférence" }
      : null;

  return (
    <article className="relative flex gap-3 rounded-xl border border-navy-lighter bg-navy-light p-3 transition-colors hover:border-cyan/40 focus-within:border-cyan/40">
      <span aria-hidden="true" className={`w-1 shrink-0 self-stretch rounded-full ${barre}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">
          <Link
            href={hrefEcheance(e)}
            // Sous un en-tête de jour, c'est-à-dire dans l'agenda : une
            // troisième barre collante (la bande de mois) s'ajoute aux deux du
            // site, et le `scroll-padding-top` global ne réserve que celles-ci.
            // On ajoute donc SA hauteur, et rien d'autre — le token, jamais un
            // nombre (`bande-mois-collante.test.ts`). La marge va sur le LIEN,
            // seul à prendre le focus : sur la carte ou sur le `<li>`, elle
            // reste sans effet et le titre tabulé se glisse sous la bande
            // (WCAG 2.4.11, même règle que `SceneCard` sur l'agenda public).
            className={`rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan after:absolute after:inset-0 after:rounded-xl${montreDate ? "" : " scroll-mt-bande-mois"}`}
          >
            {e.titre}
          </Link>
          {badge && (
            <span
              // `whitespace-nowrap` : la pastille se coupait en deux (« TU » sur une
              // ligne, « ANIMES » sur la suivante) — deux mots, un seul objet.
              className={`ml-2 inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${badge.cls}`}
            >
              {badge.texte}
            </span>
          )}
        </p>
        {meta && <p className="text-xs text-gray-light mt-0.5">{meta}</p>}
        {lienSecondaire && (
          <p className="mt-1">
            <ExternalLink
              href={lienSecondaire.href}
              aria-label={`${lienSecondaire.label}\u00a0: ${e.titre}`}
              className="relative z-10 inline-flex min-h-[44px] items-center py-3 -my-3 px-1 -mx-1 text-xs text-cyan underline underline-offset-2 hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
            >
              {lienSecondaire.label}
            </ExternalLink>
          </p>
        )}
      </div>
      {!montreDate && heures?.debut && (
        <Heures
          debut={heures.debut}
          fin={heures.fin}
          empile
          className="shrink-0 self-start text-right text-xs tabular-nums text-gray-light"
        />
      )}
      {/* Même chevron que NavRow : un seul langage d'affordance de navigation. */}
      <span aria-hidden="true" className="self-center text-base text-gray-light">
        ›
      </span>
    </article>
  );
}
