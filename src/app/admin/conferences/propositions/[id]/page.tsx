import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrgaPage } from "@/lib/auth-guards";
import {
  getPropositionEnAttente,
  type SaisieEnAttente,
} from "@/lib/conference-propositions";
import { getRegistreIndex } from "@/lib/talks";
import { rapprocher } from "@/lib/proposition-rapprochement";
import { formatOccurrenceDateLieu } from "@/lib/talk-date";
import { idDepuis } from "@/lib/id-url";
import { effetDuRefus } from "@/lib/proposition-arbitrage";
import Breadcrumb from "@/components/Breadcrumb";
import Button from "@/components/Button";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import ConfirmationBanner from "@/components/ConfirmationBanner";
import ExternalLink from "@/components/ExternalLink";
import LienRetour from "@/components/LienRetour";
import LienTexte, { LIEN_TEXTE } from "@/components/LienTexte";
import NavRow from "@/components/NavRow";
import RapprochementIndice from "../RapprochementIndice";
import {
  validateConferencePropositionAction,
  refuseConferencePropositionAction,
} from "../../actions";

export const metadata: Metadata = {
  title: "Une conférence proposée | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Titre de section : le plan de la page se lit par ses titres.
 *
 * Pas `SegmentLabel` : celui-là porte l'espacement d'un hub (`mt-8`, non
 * annulable par l'appelant, et c'est voulu) — ici les blocs sont déjà espacés
 * par le `gap-8` de la colonne, et le titre appartient au bloc qu'il nomme.
 */
function Titre({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-sm font-bold text-cream mb-2">
      {children}
    </h2>
  );
}

/** Une ligne « champ : valeur » de la proposition telle qu'elle a été déposée. */
function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2 py-1 text-sm">
      <dt className="text-gray-light">{label}&nbsp;:</dt>
      <dd className="text-white">{children}</dd>
    </div>
  );
}

/**
 * UNE saisie qui attend derrière la proposition — telle que la speakeuse l'a
 * remplie. C'est la réponse à « je ne peux pas voir le formulaire des
 * conférences pour comprendre si la saisie est ok » : rien n'est reconstitué,
 * on lit ce qui est en base, avec le même format d'occurrence que la fiche
 * publique (`formatOccurrenceDateLieu`).
 */
function Saisie({ s }: { s: SaisieEnAttente }) {
  const liens = [
    { href: s.lienConf, label: "Page de la conférence" },
    { href: s.lienSlides, label: "Slides" },
    { href: s.lienVideo, label: "Vidéo" },
    { href: s.lienFeedback, label: "Retours" },
  ].filter((l): l is { href: string; label: string } => Boolean(l.href));
  const dateLieu = formatOccurrenceDateLieu(s);

  return (
    <li className="rounded-lg border border-navy-lighter bg-navy p-4">
      <p className="text-sm font-semibold text-white">{s.titre}</p>
      <p className="mt-0.5 text-xs text-gray-light">
        {s.autriceNom ?? "Autrice inconnue"}
        {dateLieu ? ` · ${dateLieu}` : ""}
      </p>
      {liens.length > 0 && (
        <ul role="list" className="mt-2 flex flex-wrap gap-x-5 gap-y-1 list-none">
          {liens.map((l) => (
            <li key={l.label} className="text-xs">
              {/* Liens saisis par la speakeuse : `ugc`, comme partout où
                  l'association ne choisit pas la destination. */}
              <ExternalLink href={l.href} ugc className={LIEN_TEXTE}>
                {l.label}
              </ExternalLink>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs">
        <LienTexte href={`/speakeuses/${s.profileId}`}>
          Voir la fiche de {s.autriceNom ?? "cette speakeuse"}
        </LienTexte>
      </p>
    </li>
  );
}

/**
 * Une proposition qui n'attend plus : arbitrée entre-temps, ou jamais existé.
 * Un écran court qui NOMME l'état et rend le chemin — le 404 global n'a ni fil
 * d'Ariane, ni retour vers la file.
 */
function DejaTraitee() {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Conférences", href: "/admin/conferences" },
          { label: "Conférences proposées", href: "/admin/conferences/propositions" },
          { label: "Déjà traitée" },
        ]}
      />
      <div className="py-10 px-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          <h1 className="text-2xl font-bold">
            <span className="text-magenta">Déjà traitée</span>
          </h1>
          <p className="text-sm text-gray-light">
            Cette proposition a été validée ou écartée entre-temps. La file dit ce
            qu&apos;il reste à arbitrer.
          </p>
          <LienRetour
            href="/admin/conferences/propositions"
            label="Retour aux conférences proposées"
          />
        </div>
      </div>
    </>
  );
}

/**
 * UNE proposition de conférence. Un rôle : JUGER celle-ci — et pour la première
 * fois avec de quoi le faire (`docs/conception-arbitrage-conferences.md`,
 * défauts B, C et D). Trois blocs dans l'ordre où la décision se prend : ce qui
 * a été déposé, ce qui a été saisi derrière, ce que le répertoire en dit. Puis
 * les gestes — un CTA (« Valider »), une action secondaire (« Écarter »), et
 * une rangée vers la sous-page de correction (patron sommaire → sous-page
 * mono-fonction, comme une conférence et son « Modifier »).
 */
export default async function PropositionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** `corrige` : le nom qui vient d'être enregistré par « Reprendre ce nom ».
   * La confirmation le NOMME — c'est tout l'objet du geste. */
  searchParams: Promise<{ corrige?: string }>;
}) {
  await requireOrgaPage();
  const propositionId = idDepuis((await params).id);
  if (propositionId === null) notFound();

  const proposition = await getPropositionEnAttente(propositionId);
  // Déjà arbitrée (ou jamais existé) : la ligne « À faire » et la file pointent
  // cette adresse EN DIRECT, donc deux orgas — ou un onglet resté ouvert — y
  // arrivent normalement après coup. Un 404 global les laissait sans fil
  // d'Ariane et sans retour vers la file ; un `redirect()` depuis la page
  // n'était pas la parade (rendu derrière `admin/loading.tsx`, il streame un
  // 200 puis redirige côté client — le piège documenté dans `next.config.ts`).
  // Alors l'écran le DIT, et rend le chemin qui reste.
  if (!proposition) return <DejaTraitee />;

  const corrige = (await searchParams).corrige;
  const repertoire = await getRegistreIndex().catch(() => []);
  const rapprochement = rapprocher(proposition, repertoire);

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Espace organisatrices", href: "/admin" },
          { label: "Conférences", href: "/admin/conferences" },
          { label: "Conférences proposées", href: "/admin/conferences/propositions" },
          { label: proposition.nom },
        ]}
      />
      <div className="py-10 px-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-8">
          {corrige && corrige.length <= 160 && (
            <ConfirmationBanner
              message={`«\u00a0${corrige}\u00a0» est le nom enregistré. Valide quand tu veux.`}
            />
          )}

          <header>
            <h1 className="text-2xl font-bold">
              <span className="text-magenta">{proposition.nom}</span>
              {proposition.annee != null && (
                <span className="text-gray-light font-normal"> · {proposition.annee}</span>
              )}
            </h1>
          </header>

          <div>
            <Titre id="prop-title">Ce qui a été proposé</Titre>
            <dl
              aria-labelledby="prop-title"
              className="rounded-xl border border-navy-lighter bg-navy-light p-4"
            >
              <Champ label="Nom">{proposition.nom}</Champ>
              <Champ label="Année">{proposition.annee ?? "aucune"}</Champ>
              <Champ label="Ville">{proposition.ville ?? "aucune"}</Champ>
              <Champ label="Lien">
                {proposition.url ? (
                  <ExternalLink
                    href={proposition.url}
                    ugc
                    className={`${LIEN_TEXTE} break-all`}
                  >
                    {proposition.url}
                  </ExternalLink>
                ) : (
                  "aucun"
                )}
              </Champ>
              <Champ label="Moisson Sessionize">
                {proposition.endpoint ? <code>{proposition.endpoint}</code> : "aucune"}
              </Champ>
              <Champ label="Proposée par">
                {proposition.proposeParNom ?? "un compte depuis supprimé"}
              </Champ>
            </dl>
          </div>

          <div>
            <Titre id="saisies-title">Ce qui a été saisi</Titre>
            {proposition.saisies.length === 0 ? (
              <p className="text-sm text-gray-light">
                Aucune saisie derrière cette proposition\u00a0: valider n&apos;ajoutera
                la conférence qu&apos;au répertoire.
              </p>
            ) : (
              <>
                <p className="mb-2 text-sm text-gray-light">
                  {proposition.saisies.length > 1
                    ? `${proposition.saisies.length} talks passeront en ligne à la validation, tels que saisis.`
                    : "1 talk passera en ligne à la validation, tel que saisi."}
                </p>
                <ul
                  role="list"
                  aria-labelledby="saisies-title"
                  className="flex flex-col gap-3 list-none"
                >
                  {proposition.saisies.map((s) => (
                    <Saisie key={s.occurrenceId} s={s} />
                  ))}
                </ul>
              </>
            )}
          </div>

          <div>
            <Titre id="repertoire-title">Ce que le répertoire en dit</Titre>
            {rapprochement.identique === null && rapprochement.proches.length === 0 ? (
              <p className="text-sm text-gray-light">
                Aucune conférence proche au répertoire&nbsp;: valider en ajoutera une.
              </p>
            ) : (
              <>
                <RapprochementIndice rapprochement={rapprochement} />
                {/* La conférence IDENTIQUE règle la question : la validation
                    rattachera. Proposer alors « corrige le nom » et lister les
                    ressemblances (« Agile Tour Nantes » quand on tient « Agile
                    Tour Toulouse ») offrait le seul geste qui CASSE le
                    rattachement — l'écran se contredisait d'une ligne à l'autre
                    (relevé par la passe justesse). Un état, une voix. */}
                {rapprochement.identique ? (
                  <ul role="list" aria-labelledby="repertoire-title" className="mt-2 list-none">
                    <li className="text-xs">
                      <LienTexte href={`/admin/conferences/${rapprochement.identique.slug}`}>
                        Ouvrir «&nbsp;{rapprochement.identique.nom}&nbsp;» au répertoire
                      </LienTexte>
                    </li>
                  </ul>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-gray-light">
                      Si c&apos;est la même conférence, corrige le nom pour reprendre
                      celui du répertoire&nbsp;: la validation rattachera la saisie à
                      la conférence existante au lieu d&apos;en créer une seconde.
                    </p>
                    <ul
                      role="list"
                      aria-labelledby="repertoire-title"
                      className="mt-2 flex flex-col gap-1 list-none"
                    >
                      {rapprochement.proches.map((v) => (
                        <li key={v.id} className="text-xs">
                          <LienTexte href={`/admin/conferences/${v.slug}`}>
                            Ouvrir «&nbsp;{v.nom}&nbsp;» au répertoire
                          </LienTexte>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <NavRow
              href={`/admin/conferences/propositions/${proposition.id}/corriger`}
              title="Corriger la proposition"
              subtitle="Nom, année, ville, lien, moisson Sessionize"
            />
            <div className="flex flex-wrap items-center gap-3">
              <form action={validateConferencePropositionAction}>
                <input type="hidden" name="propositionId" value={proposition.id} />
                <input type="hidden" name="nom" value={proposition.nom} />
                <Button type="submit">Valider</Button>
              </form>
              {/* PALIER 2 (principes UI §10) : écarter est définitif, et son
                  périmètre dépasse cette ligne — le nom est ensuite refusé à son
                  autrice TOUTES ANNÉES confondues (`findPropositionByNom`), et
                  rien, dans le produit, ne dés-écarte. La modale annonce donc le
                  périmètre chiffré avant le clic, comme la suppression d'une
                  édition deux dossiers plus loin. */}
              <form action={refuseConferencePropositionAction}>
                <input type="hidden" name="propositionId" value={proposition.id} />
                <input type="hidden" name="nom" value={proposition.nom} />
                <ConfirmSubmitButton
                  title={`Écarter «\u00a0${proposition.nom}\u00a0» ?`}
                  message={effetDuRefus({
                    nom: proposition.nom,
                    nbSaisies: proposition.saisies.length,
                    proposeParNom: proposition.proposeParNom,
                  })}
                  confirmLabel="Écarter cette proposition"
                  pendingLabel="On écarte…"
                  variant="secondary"
                  className="min-h-[44px]"
                >
                  Écarter
                </ConfirmSubmitButton>
              </form>
            </div>
          </div>

          <LienRetour
            href="/admin/conferences/propositions"
            label="Retour aux conférences proposées"
          />
        </div>
      </div>
    </>
  );
}
