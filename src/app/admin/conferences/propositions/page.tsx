import type { Metadata } from "next";
import Link from "next/link";
import { requireOrgaPage } from "@/lib/auth-guards";
import {
  listConferencePropositions,
  countConferencePropositions,
} from "@/lib/conference-propositions";
import { getRegistreIndex } from "@/lib/talks";
import { rapprocher } from "@/lib/proposition-rapprochement";
import { estIdValide } from "@/lib/id-url";
import { nb } from "@/lib/format";
import Breadcrumb from "@/components/Breadcrumb";
import ConfirmationBanner from "@/components/ConfirmationBanner";
import LienRetour from "@/components/LienRetour";
import ListPageTemplate from "@/components/ListPageTemplate";
import RapprochementIndice from "./RapprochementIndice";
import type { ConferenceProposition } from "@/lib/conference-propositions";
import type { ConferenceRepertoriee } from "@/lib/proposition-rapprochement";

export const metadata: Metadata = {
  title: "Conférences proposées | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Combien de rangées par page. Un import de portefeuille en a déposé 113 d'un
 * coup (2026-08-21) : le catalogue les affichait toutes, en cartes à deux
 * boutons, sur une page dont le rôle est de consulter la référence. Le plafond
 * annonce son compte exact et ne masque jamais en silence (principes UI,
 * § listes).
 */
const PAR_PAGE = 25;

/**
 * Messages d'arbitrage (PRG). Chacun est une FONCTION du sujet, jamais une
 * phrase retouchée après coup : un `replace` sur de la copie affichée casse au
 * premier mot qu'on reformule, et il était déjà passé à côté des insécables.
 *
 * `alerte` dit ce que le bandeau doit annoncer : deux de ces quatre messages
 * sont des ÉCHECS, et les rendre en `role="status"` cyan disait le contraire de
 * ce qui venait de se passer (passe UX du lot).
 */
const PROP_MESSAGES: Record<
  string,
  { texte: (sujet: string) => string; alerte?: true }
> = {
  validee: { texte: (sujet) => `${sujet} a rejoint le répertoire.` },
  refusee: {
    texte: (sujet) =>
      `${sujet} est écartée. Les saisies qui l'attendaient restent hors ligne, dans l'espace de leur autrice.`,
  },
  // Le refus porte désormais la garde d'état de son jumeau : « déjà traitée »
  // est un message VRAI, là où l'écran annonçait un succès (dette soldée).
  introuvable: { texte: () => "Cette proposition a déjà été traitée.", alerte: true },
  conflit: {
    texte: () =>
      "Validation impossible\u00a0: l'id Sessionize de cette proposition est déjà utilisé par une autre conférence. Corrige-le, puis valide.",
    alerte: true,
  },
};

/**
 * Le message d'arbitrage, NOMMÉ. Le retour se fait en haut d'une file de
 * rangées qui se ressemblent : « Conférence validée » sans le nom laissait
 * chercher laquelle (principes UI §5 — un message de confirmation nomme la
 * chose concernée).
 */
function messageProp(
  prop: string,
  nom: string | undefined,
  talks: string | undefined,
): { texte: string; alerte?: true } | null {
  // `Object.hasOwn`, pas un accès direct : `?prop=__proto__` (ou `constructor`,
  // ou `toString`) rend un objet ou une fonction, que TypeScript croit être une
  // valeur du Record et que React refuse de rendre — écran cassé sur une URL
  // bricolée. Le motif vient du catalogue, où il vivait déjà : il ne repart pas
  // comme il est arrivé.
  if (!Object.hasOwn(PROP_MESSAGES, prop)) return null;
  const { texte, alerte } = PROP_MESSAGES[prop];
  // Le nom vient de l'URL, donc d'un aller-retour : borné à ce que le schéma
  // autorise, et rendu par React (donc échappé). Absent — vieux lien, paramètre
  // retiré à la main — la phrase reste juste, simplement moins précise.
  const sujet =
    nom && nom.trim() !== "" && nom.length <= 160
      ? `«\u00a0${nom}\u00a0»`
      : "La conférence proposée";
  const phrase = texte(sujet);
  if (prop !== "validee") return alerte ? { texte: phrase, alerte } : { texte: phrase };
  const n = Number(talks);
  if (!Number.isInteger(n) || n <= 0) return { texte: phrase };
  return {
    texte:
      n > 1
        ? `${phrase} ${n} talks qui l'attendaient sont désormais en ligne.`
        : `${phrase} 1 talk qui l'attendait est désormais en ligne.`,
  };
}

/**
 * Numéro de page demandé, ramené à un entier utilisable (paramètre non fiable).
 *
 * `estIdValide` plutôt qu'un `Number.isInteger` maison : la borne haute compte
 * ici aussi, `page=1e21` donnant un `OFFSET` que Postgres refuse — un 500 pour
 * une URL bricolée, là où la page voulait simplement se replier sur la première
 * (cf. `src/lib/id-url.ts`).
 */
function pageDemandee(brut: string | undefined): number {
  const n = Number(brut);
  return estIdValide(n) ? n : 1;
}

/**
 * Une proposition dans la file : une LIGNE cliquable vers sa page — le gabarit
 * de toutes les listes orga du dépôt, et celui de `ConferenceLigne` deux
 * dossiers plus haut, dont ceci est le jumeau.
 *
 * `NavRow` ne convient pas ici, et c'est instructif : son sous-titre est un
 * `<span>` en `line-clamp-2`, qui aurait TRONQUÉ l'indice du répertoire — la
 * ligne même pour laquelle cette page existe. On garde donc le patron (rangée
 * entière cliquable, chevron, focus visible) sans le composant.
 *
 * Le nom accessible est celui du lien entier : un seul lien par rangée, donc
 * aucun homonyme à distinguer par un `aria-label` (principes UI §6).
 */
function PropositionLigne({
  p,
  repertoire,
}: {
  p: ConferenceProposition;
  repertoire: ConferenceRepertoriee[];
}) {
  const contexte = [
    p.ville,
    p.proposeParNom ? `proposée par ${p.proposeParNom}` : null,
    p.talksEnAttente > 0
      ? `${nb(p.talksEnAttente, "talk")} à mettre en ligne`
      : "aucune saisie derrière",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="rounded-xl border border-navy-lighter bg-navy-light">
      <Link
        href={`/admin/conferences/propositions/${p.id}`}
        className="flex items-center justify-between gap-3 rounded-xl p-4 hover:bg-navy-lighter/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
      >
        <span className="min-w-0">
          <span className="block font-bold text-white">
            {p.nom}
            {p.annee != null && (
              <span className="font-normal text-gray-light"> · {p.annee}</span>
            )}
          </span>
          <span className="block text-xs text-gray-light">{contexte}</span>
          <RapprochementIndice className="mt-1" rapprochement={rapprocher(p, repertoire)} />
        </span>
        <span className="shrink-0 text-sm text-cyan" aria-hidden="true">
          →
        </span>
      </Link>
    </li>
  );
}

/**
 * LA FILE d'arbitrage des conférences proposées. Un rôle : choisir laquelle
 * arbitrer — et RIEN d'autre. Les deux gestes vivent sur la page de la
 * proposition, avec la saisie sous les yeux.
 *
 * C'est la décision de la passe UX du lot, et elle renverse le premier jet
 * (deux boutons par rangée). Trois raisons, chacune une règle du dépôt :
 *
 * 1. « Écarter » est un geste de PALIER 2 (définitif, périmètre borné) : il
 *    bloque ce nom pour son autrice, toutes années confondues, et rien ne
 *    dés-écarte dans le produit. Il lui faut sa modale nominative — 25 fois sur
 *    une liste, c'est intenable ; une fois sur la page de l'item, c'est juste ;
 * 2. 25 rangées × 2 boutons faisaient cinquante boutons homonymes, ce que les
 *    principes UI nomment explicitement comme un échec de conception (§6) ;
 * 3. c'est le gabarit de TOUTES les autres listes orga : la rangée entière est
 *    le lien, la décision se prend dans le contexte de son item.
 *
 * Le prix est assumé : deux gestes par proposition au lieu d'un. C'est
 * exactement l'argument que la conception opposait déjà au « tout valider » —
 * le débit tenable vient de l'écran qui donne à juger, pas d'un bouton qui
 * saute le jugement. Et l'indice du répertoire reste sur la rangée : il sert au
 * TRI (celles qui vont poser question se repèrent sans les ouvrir).
 */
export default async function PropositionsPage({
  searchParams,
}: {
  searchParams: Promise<{ prop?: string; nom?: string; talks?: string; page?: string }>;
}) {
  await requireOrgaPage();
  const sp = await searchParams;
  const confirmation = sp.prop ? messageProp(sp.prop, sp.nom, sp.talks) : null;

  const page = pageDemandee(sp.page);
  const [total, propositions, repertoire] = await Promise.all([
    countConferencePropositions(),
    listConferencePropositions({ limit: PAR_PAGE, offset: (page - 1) * PAR_PAGE }),
    // Le répertoire complet, pour l'indice de rapprochement. Une jointure sur
    // ~130 conférences, sur un écran d'orga : le prix d'un doublon de marque
    // dans la référence partagée est autrement plus élevé.
    getRegistreIndex().catch(() => []),
  ]);
  const premier = (page - 1) * PAR_PAGE + 1;
  const dernier = premier + propositions.length - 1;
  const aUneSuite = dernier < total;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Conférences", href: "/admin/conferences" },
          { label: "Conférences proposées" },
        ]}
      />
      <ListPageTemplate
        title="Conférences proposées"
        meta={
          total === 0
            ? "Rien en attente. Tout roule."
            : `${nb(total, "conférence")} proposée${total > 1 ? "s" : ""} par des membres. Ouvre-en une pour lire la saisie qui l'attend, puis valider ou écarter.`
        }
      >
        {confirmation && (
          <ConfirmationBanner
            message={confirmation.texte}
            ton={confirmation.alerte ? "alerte" : "succes"}
          />
        )}

        {propositions.length === 0 ? (
          <p className="text-sm text-gray-light">
            {total === 0 ? (
              "Les conférences proposées par des membres arrivent ici."
            ) : (
              <>
                Cette page est vide.{" "}
                <Link
                  href="/admin/conferences/propositions"
                  className="text-cyan underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
                >
                  Revenir à la première
                </Link>
                .
              </>
            )}
          </p>
        ) : (
          <>
            {total > PAR_PAGE && (
              <p className="text-sm text-gray-light">
                {premier} à {dernier} sur {total}.
              </p>
            )}
            <ul role="list" className="flex flex-col gap-2 list-none">
              {propositions.map((p) => (
                <PropositionLigne key={p.id} p={p} repertoire={repertoire} />
              ))}
            </ul>
          </>
        )}

        {(page > 1 || aUneSuite) && (
          <nav aria-label="Pages de la file" className="flex justify-between gap-4">
            {page > 1 ? (
              <Link
                href={`/admin/conferences/propositions?page=${page - 1}`}
                className="inline-flex min-h-[44px] items-center text-sm text-cyan underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
              >
                <span aria-hidden="true">← </span>
                Page précédente
              </Link>
            ) : (
              <span />
            )}
            {aUneSuite && (
              <Link
                href={`/admin/conferences/propositions?page=${page + 1}`}
                className="inline-flex min-h-[44px] items-center text-sm text-cyan underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
              >
                Page suivante ({dernier + 1} à {Math.min(dernier + PAR_PAGE, total)})
                <span aria-hidden="true"> →</span>
              </Link>
            )}
          </nav>
        )}

        <LienRetour href="/admin/conferences" label="Retour aux conférences" />
      </ListPageTemplate>
    </>
  );
}
