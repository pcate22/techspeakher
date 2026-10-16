import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumb";
import EcheanceCard from "@/components/EcheanceCard";
import EnTetePeriode from "@/components/EnTetePeriode";
import ListPageTemplate from "@/components/ListPageTemplate";
import AmenerEnVue from "@/components/AmenerEnVue";
import { getSession, requireUserId } from "@/lib/auth-guards";
import { jourAgendaFr, moisAgendaFr } from "@/lib/format";
import {
  getMonAgenda,
  grouperParMois,
  avecAujourdhui,
  cleEcheance,
  separerEcheances,
} from "@/lib/mon-agenda";
import { aujourdhuiParis } from "@/lib/tremplin-statut";

export const metadata: Metadata = {
  title: "Mon agenda | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * MON AGENDA (onglet, refonte §11 v2) : toutes mes échéances façon app
 * calendrier — le MOIS en en-tête collant, puis les jours, chaque carte menant
 * à son détail. Ateliers du Tremplin (participation, animation, et pour une
 * orga le programme des éditions actives) ET talks.
 *
 * Il REMONTE : un calendrier qui ne montre que devant n'est pas un calendrier.
 * Une coach perdait sinon toute la phase 1 qu'elle avait animée dès le lendemain
 * de la dernière séance. Le passé est donc au-dessus, la page s'ouvre sur
 * aujourd'hui (`AmenerEnVue`), et on remonte le fil en défilant.
 *
 * AUJOURD'HUI EST UNE DATE DU FIL, pas une frontière entre deux zones : sa
 * ligne existe toujours (`avecAujourdhui`), avec son mois au-dessus, même
 * quand la journée est vide. Sans elle, un agenda qui saute d'une séance de mai
 * à une de septembre n'affichait AUCUN titre portant le mois courant, et celui
 * du passé — collant — se lisait comme la date du jour (remonté le 16/08/2026).
 */
export default async function MonAgenda() {
  const uid = await requireUserId();
  const session = await getSession(); // mémoïsé par requête (gratuit)
  const aujourdhui = aujourdhuiParis();
  const items = await getMonAgenda(uid, {
    orga: session?.user?.isOrga === true,
    aujourdhui,
    avecPasse: true,
  });

  // La coupure vit dans la lib (`separerEcheances`), à côté du tri qu'elle
  // complète : une activité à période en cours reste au présent, et le passé
  // n'est jamais coupé par index (il n'est pas un préfixe du tri par début).
  const { passees: passe, aVenir } = separerEcheances(items, aujourdhui);
  const moisPasses = grouperParMois(passe);
  const moisAVenir = avecAujourdhui(grouperParMois(aVenir), aujourdhui);
  // Ce que la journée du jour affiche quand elle est vide. « Rien à l'agenda »
  // reprend mot pour mot l'état vide de la page. La seconde phrase remplace
  // l'ancien « À jour, rien devant » : sans elle, une page qui s'arrête là ne
  // dirait plus qu'il n'y a rien devant.
  const journeeVide = `Rien à l'agenda aujourd'hui.${aVenir.length === 0 ? " Tu es à jour." : ""}`;

  // `zone` distingue les ids : le mois COURANT vit souvent des deux côtés du
  // jour même (du passé et de l'à-venir), deux `id="mois-2026-07"` seraient
  // dupliqués dans la page (HTML invalide, ancres ambiguës). Il décide AUSSI de
  // la ligne du jour : `avecAujourdhui` ne l'ajoute qu'à l'à-venir, et deux
  // `id="aujourdhui"` seraient deux ancres pour un même jour.
  const sectionsMois = (mois: ReturnType<typeof grouperParMois>, zone: "passe" | "avenir") =>
    mois.map((m) => (
      <section key={m.mois} aria-labelledby={`mois-${zone}-${m.mois}`}>
        {/* Façon calendrier : le mois reste visible en défilant. */}
        <EnTetePeriode id={`mois-${zone}-${m.mois}`}>
          {moisAgendaFr(m.mois)}
        </EnTetePeriode>
        <div className="flex flex-col gap-4 mt-3">
          {m.jours.map((j) => {
            const cestAujourdhui = zone === "avenir" && j.date === aujourdhui;
            return (
              <div key={j.date}>
                {/* Un jour parmi les jours, mis en avant : la taille et la
                    graisse d'abord, la couleur en renfort, et le mot écrit —
                    l'information ne passe jamais par la couleur seule (WCAG
                    1.4.1). `scroll-mt-bande-mois` : la ligne se range sous la
                    bande de mois, qui est la troisième barre collante du site. */}
                <h3
                  id={cestAujourdhui ? "aujourdhui" : undefined}
                  className={
                    cestAujourdhui
                      ? "scroll-mt-bande-mois mb-1.5 text-sm font-bold text-cyan"
                      : "mb-1.5 text-xs font-semibold text-gray-light"
                  }
                >
                  {cestAujourdhui
                    ? `${jourAgendaFr(j.date) ?? j.date} · aujourd'hui`
                    : jourAgendaFr(j.date)}
                </h3>
                {/* Seule la journée du jour peut être vide (les autres naissent
                    d'une échéance) : un en-tête sans rien dessous se lirait
                    comme un chargement à moitié fait. */}
                {j.echeances.length === 0 ? (
                  <p className="text-xs text-gray-light">{journeeVide}</p>
                ) : (
                  <ul role="list" className="flex flex-col gap-2 list-none">
                    {j.echeances.map((e) => (
                      // La marge de défilement vit sur le LIEN de la carte, pas
                      // ici : c'est lui qui prend le focus (cf. `EcheanceCard`).
                      <li key={cleEcheance(e)}>
                        <EcheanceCard e={e} montreDate={false} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
    ));

  return (
    <>
      <Breadcrumb
        items={[{ label: "Mon espace", href: "/mon-espace" }, { label: "Mon agenda" }]}
      />
      <ListPageTemplate
        title="Mon agenda"
        meta="Tes ateliers du Tremplin et tes talks, à venir comme passés. Remonte le fil en défilant vers le haut. Chaque carte mène à son détail."
      >
        {items.length === 0 ? (
          <p className="text-sm text-gray-light">
            Rien à l&apos;agenda pour l&apos;instant. Tes ateliers et talks
            apparaîtront ici.
          </p>
        ) : (
          <>
            {sectionsMois(moisPasses, "passe")}
            {sectionsMois(moisAVenir, "avenir")}
            {/* La page s'ouvre sur le jour même — feuille cliente, tout le reste
                du fil reste rendu par le serveur. */}
            <AmenerEnVue cible="aujourdhui" />
          </>
        )}
      </ListPageTemplate>
    </>
  );
}
