import Link from "next/link";
import {
  libelleDateScene,
  libelleJourScene,
  type ScenePublique,
} from "@/lib/agenda-public";
import { nomInsecable } from "@/data/association";

/**
 * Carte d'une intervention publique (agenda des speakeuses, extrait de la home).
 *
 * TOUTE la carte mène à la FICHE de la speakeuse : c'est là que vivent le talk,
 * ses liens (site de la conf, slides, vidéo) et le moyen de la contacter. Une
 * seule cible par carte — le lien de la conférence en second n'apporterait qu'un
 * doute sur ce qu'on tape, et il est déjà sur la fiche.
 *
 * Hiérarchie : la DATE (on lit un agenda), puis le talk, puis où, puis qui.
 * `dansPeriode` dit que la carte est rangée sous un en-tête de mois : elle
 * n'affiche alors que le jour, au lieu de répéter « 3 septembre 2026 » sous
 * « SEPTEMBRE 2026 ». L'`aria-label`, lui, porte TOUJOURS la date complète : il
 * remplace le contenu du lien pour un lecteur d'écran, l'en-tête de tranche ne
 * l'accompagne pas dans une navigation par liens.
 *
 * Cet en-tête de mois est COLLANT (l'agenda se lit en défilant, le mois doit
 * rester lisible) : il s'ajoute aux deux barres du site, que le
 * `scroll-padding-top` de `globals.css` réserve déjà. La carte réserve donc sa
 * hauteur en plus (`scroll-mt-bande-mois`), sinon le lien qui prend le focus se
 * range derrière la bande (WCAG 2.4.11 « focus non masqué »). La marge va sur le
 * LIEN, cible réelle du focus — sur son `<li>`, elle resterait sans effet.
 *
 * SA HAUTEUR, ET RIEN DE PLUS. Cette marge valait 10 rem, quatre fois la bande :
 * le lien focalisé se posait alors si bas que la bande affichée au-dessus était
 * celle du mois PRÉCÉDENT — la version clavier du défaut remonté de la prod le
 * 16/08/2026 (cf. `docs/principes-conception-ui.md`). Une hauteur, un token, et
 * un test qui refuse les nombres recopiés (`bande-mois-collante.test.ts`).
 */
export default function SceneCard({
  scene: s,
  headingLevel: Heading = "h3",
  dansPeriode = false,
}: {
  scene: ScenePublique;
  headingLevel?: "h3" | "h4";
  dansPeriode?: boolean;
}) {
  // Le nom de l'asso peut venir de la SAISIE d'une membre (« Meetup Tech
  // Speak'Her »), donc en espace ordinaire : replié à l'affichage pour qu'il ne
  // se coupe pas en fin de ligne. Rien n'est réécrit en base.
  const ou = nomInsecable([s.conference, s.ville, s.pays].filter(Boolean).join(" · "));
  const titre = nomInsecable(s.talkTitre);
  const quand = dansPeriode ? libelleJourScene(s.date) : libelleDateScene(s.date);
  return (
    <Link
      href={s.speakeuseHref}
      aria-label={`${libelleDateScene(s.date)} : ${s.talkTitre}, par ${s.speakeuseNom}. Voir sa fiche`}
      className={`group flex h-full flex-col gap-1.5 rounded-xl border border-navy-lighter bg-navy-light p-5 transition-colors hover:border-cyan/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan${dansPeriode ? " scroll-mt-bande-mois" : ""}`}
    >
      {quand && (
        <p className="text-xs font-bold uppercase tracking-wider text-cyan">
          {quand}
        </p>
      )}
      <Heading className="font-semibold leading-snug text-white">
        {titre}
      </Heading>
      {ou && <p className="text-sm text-gray-light">{ou}</p>}
      <p className="mt-auto pt-2 text-sm text-white">
        <span className="text-gray-light">Par </span>
        <span className="font-medium group-hover:text-cyan-light">
          {s.speakeuseNom}
        </span>
        <span aria-hidden="true" className="text-cyan">
          {" "}
          →
        </span>
      </p>
    </Link>
  );
}
