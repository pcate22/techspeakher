import type { Metadata } from "next";
import ExternalLink from "@/components/ExternalLink";
import Breadcrumb from "@/components/Breadcrumb";
import { ASSOCIATION, NOM_AFFICHE, formaterImmatriculation } from "@/data/association";
import LienTexte, { LIEN_TEXTE } from "@/components/LienTexte";
import { CONTACT_EMAIL } from "@/constants/site";
import {
  DUREE_INACTIVITE_JOURS,
  PREAVIS_SUPPRESSION_JOURS,
  dureeEnAns,
} from "@/lib/conservation-comptes";
import { nb } from "@/lib/format";

export const metadata: Metadata = {
  title: "Mentions légales | Tech Speak'Her",
  description:
    `${ASSOCIATION.nom}, ${ASSOCIATION.formeJuridique} déclarée le ${ASSOCIATION.dateDeclaration} (RNA ${ASSOCIATION.rna}) : éditeur du site, hébergement, protection des données et accessibilité.`,
  // Indexable à dessein : c'est la page qui porte l'identité juridique de
  // l'association (forme, RNA, siège). Les organismes qui instruisent un
  // dossier la cherchent, et un `noindex` la rendait introuvable.
  // Voir docs/google-ad-grants.md.
  alternates: {
    canonical: "/mentions-legales",
  },
};

export default function MentionsLegales() {
  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Mentions légales" }]} />
      <section className="py-16 sm:py-24 px-4" aria-labelledby="mentions-title">
      <div className="max-w-3xl mx-auto">
        <h1 id="mentions-title" className="text-3xl font-bold mb-10">
          <span className="text-cyan">Mentions</span> légales
        </h1>

        <div className="space-y-8 text-gray-light text-sm leading-relaxed">
          {/* Éditeur */}
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Éditeur du site</h2>
            <p>
              Le site est édité par{" "}
              <strong className="text-white">{NOM_AFFICHE}</strong>, association
              régie par la loi du 1er&nbsp;juillet 1901 et le décret du 16&nbsp;août
              1901, déclarée le {ASSOCIATION.dateDeclaration}.
            </p>
            <p className="mt-2">
              N&deg; RNA&nbsp;: <strong className="text-white">{ASSOCIATION.rna}</strong>
              <br />
              N&deg; SIREN&nbsp;:{" "}
              <strong className="text-white">{formaterImmatriculation(ASSOCIATION.siren)}</strong>
              <br />
              N&deg; SIRET&nbsp;:{" "}
              <strong className="text-white">{formaterImmatriculation(ASSOCIATION.siret)}</strong>
            </p>
            <p className="mt-2">
              Siège social&nbsp;:<br />
              {ASSOCIATION.siege.voie}<br />
              {ASSOCIATION.siege.codePostal} {ASSOCIATION.siege.commune},{" "}
              {ASSOCIATION.siege.pays}
            </p>
            <p className="mt-2">
              Objet social&nbsp;: «&nbsp;{ASSOCIATION.objet}&nbsp;»
            </p>
          </div>

          {/* Directrice de publication */}
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Directrice de la publication</h2>
            <p>
              La directrice de la publication est {ASSOCIATION.directricePublication},
              co-représentante légale de l&apos;association.
            </p>
          </div>

          {/* Hébergement */}
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Hébergement</h2>
            <p>
              Site hébergé par&nbsp;:<br />
              Vercel Inc.<br />
              440 N Barranca Ave #4133<br />
              Covina, CA 91723, États-Unis
            </p>
            <p className="mt-2">
              Base de données (comptes et profils) hébergée par{" "}
              <ExternalLink
                href="https://neon.tech"
                className={LIEN_TEXTE}
              >
                Neon
              </ExternalLink>
              , dans une région située dans l&apos;Union européenne.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Contact</h2>
            <p>
              Vous pouvez nous écrire à{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className={`${LIEN_TEXTE} break-all`}>
                {CONTACT_EMAIL}
              </a>{" "}
              ou passer par le{" "}
              <LienTexte href="/contact">
                formulaire de contact
              </LienTexte>
              . Nous sommes aussi sur notre{" "}
              <ExternalLink
                href="https://www.linkedin.com/company/tech-speak-her/"
                className={LIEN_TEXTE}
              >
                page LinkedIn
              </ExternalLink>.
            </p>
          </div>

          {/* Propriété intellectuelle */}
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Propriété intellectuelle</h2>
            <p>
              L&apos;ensemble du contenu de ce site (textes, mise en page, code source) est la propriété
              de Tech Speak&apos;Her, sauf mention contraire. Toute reproduction, même partielle, est
              soumise à autorisation préalable.
            </p>
          </div>

          {/* Données personnelles & RGPD */}
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Données personnelles &amp; RGPD</h2>

            <h3 className="text-white font-semibold mt-4 mb-1">Responsable du traitement</h3>
            <p>
              Tech Speak&apos;Her est responsable du traitement de vos données.
              L&apos;association a désigné une déléguée à la protection des données
              (n°&nbsp;{ASSOCIATION.dpoCnil} auprès de la CNIL).
            </p>

            <h3 className="text-white font-semibold mt-4 mb-1">Formulaire de contact</h3>
            <p>
              Les données saisies dans le formulaire (nom, adresse e-mail, objet,
              message) sont transmises via notre prestataire d&apos;envoi
              d&apos;e-mails{" "}
              <ExternalLink
                href="https://www.brevo.com/fr/"
                className={LIEN_TEXTE}
              >
                Brevo
              </ExternalLink>{" "}
              dans le seul but de vous répondre. Elles ne sont pas conservées
              au-delà de l&apos;envoi.
            </p>
            {/*
              Affiché seulement quand le widget l'est aussi (même variable que
              `ContactForm`) : la page reste exacte que Turnstile soit activé ou
              pas, sans entretien.
            */}
            {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
              <p className="mt-2">
                Le formulaire est protégé des envois automatisés par{" "}
                <ExternalLink
                  href="https://www.cloudflare.com/fr-fr/products/turnstile/"
                  className={LIEN_TEXTE}
                >
                  Cloudflare Turnstile
                </ExternalLink>
                , qui analyse le comportement du navigateur (adresse IP, en-têtes
                de la requête) le temps de la vérification. Turnstile ne pose
                aucun cookie et ne sert à aucun profilage publicitaire.
              </p>
            )}

            <h3 className="text-white font-semibold mt-4 mb-1">Compte &amp; espace speakeuse</h3>
            <p>
              Pour créer ou reprendre sa fiche, une speakeuse se connecte via Google,
              LinkedIn ou un lien envoyé par e-mail. Nous conservons alors&nbsp;: son
              nom, son adresse e-mail, éventuellement sa photo de compte, ainsi que les
              informations qu&apos;elle renseigne (titre, poste, entreprise, biographie,
              secteurs &amp; sujets, ville, zones d&apos;intervention, langues, talks,
              liens, préférence de contact). La base de
              connexion légale est le <strong className="text-white">consentement</strong>{" "}
              et la gestion de la relation avec les membres de la communauté.
            </p>
            {/* Art. 13-1-c : `users.last_seen_at` est une donnée NOUVELLE, née
                de la règle de conservation ci-dessous. Publier la durée sans
                annoncer la mesure qui la déclenche reviendrait à appliquer une
                règle sur une donnée tue. */}
            <p className="mt-2">
              Nous enregistrons aussi la{" "}
              <strong className="text-white">date de son dernier passage</strong>{" "}
              sur le site, <strong className="text-white">à la semaine près</strong>&nbsp;:
              c&apos;est elle qui rend applicable la durée de conservation annoncée
              plus bas, et elle ne sert qu&apos;à cela. Aucune page consultée, aucun
              horaire, aucun parcours n&apos;est enregistré.
            </p>
            <p className="mt-2">
              Ces données sont stockées dans notre base hébergée par Neon (Union
              européenne) et ne sont jamais cédées à des tiers. L&apos;adresse e-mail
              et le téléphone ne sont <strong className="text-white">jamais</strong>{" "}
              affichés publiquement.
            </p>

            <h3 className="text-white font-semibold mt-4 mb-1">Annuaire des speakeuses</h3>
            <p>
              La page{" "}
              <LienTexte href="/speakeuses">
                Annuaire speakeuses
              </LienTexte>{" "}
              publie les informations que la speakeuse choisit de renseigner (nom,
              titre/poste, biographie, secteurs &amp; sujets, ville, zones
              d&apos;intervention, langues, talks, liens vers des profils publics),
              après validation par l&apos;association et avec le consentement de la
              personne. La ville reste facultative et n&apos;est jamais plus précise
              que la commune. Chaque speakeuse garde la main sur sa fiche&nbsp;: elle peut la
              modifier, la retirer ou supprimer son compte à tout moment.
            </p>

            <h3 className="text-white font-semibold mt-4 mb-1">Adhésions</h3>
            {/* Cf. docs/conception-adhesions-helloasso.md § 7 : ce qui est
                recopié, pourquoi, combien de temps — et rien de plus. */}
            <p>
              L&apos;adhésion se fait sur{" "}
              <ExternalLink href="https://www.helloasso.com/" className={LIEN_TEXTE}>
                HelloAsso
              </ExternalLink>
              , qui traite le paiement et les réponses au formulaire pour son propre
              compte. Lorsque l&apos;adresse indiquée pour un membre correspond à un
              compte de la plateforme, nous en recopions seulement la date de début,
              l&apos;échéance et un identifiant technique de l&apos;adhésion&nbsp;: pour
              afficher son statut dans l&apos;espace membre, prévenir avant
              l&apos;échéance et réserver l&apos;annuaire aux membres. Une adhésion sans
              compte correspondant reste uniquement chez HelloAsso. Pour ce
              rapprochement, nous gardons aussi l&apos;adresse que Google ou LinkedIn
              nous transmet à la connexion. Base légale&nbsp;: l&apos;
              <strong className="text-white">exécution du contrat d&apos;adhésion</strong>,
              et l&apos;intérêt légitime de l&apos;association à réserver son annuaire à
              ses membres. Ces informations vivent avec le compte et disparaissent
              avec lui.
            </p>

            <h3 className="text-white font-semibold mt-4 mb-1">Tremplin (concours de prise de parole)</h3>
            <p>
              Dans le cadre du{" "}
              <LienTexte href="/tremplin">
                Tremplin
              </LienTexte>
              , nous traitons les données des participantes&nbsp;: nom, rôle, sujet de talk,
              biographie, liens publics (LinkedIn, site web), adresse e-mail (jamais
              affichée) et, le cas échéant, photos prises lors des événements. La base
              légale est le <strong className="text-white">consentement</strong>{" "}
              pour la publication, et l&apos;intérêt légitime de l&apos;association pour
              l&apos;organisation du concours.
            </p>
            <p className="mt-2">
              La page publique d&apos;une édition ne nomme une participante (galerie,
              palmarès) que si elle y a consenti&nbsp;; ce consentement est{" "}
              <strong className="text-white">révocable à tout moment</strong>{" "}
              auprès de l&apos;association. Son nom, sa photo et son sujet sont alors retirés de
              la page&nbsp;; elle reste comptée anonymement dans les statistiques, et si
              elle a gagné un prix, le rang correspondant reste affiché au palmarès{" "}
              <strong className="text-white">sans son nom</strong>. Chaque accord et
              retrait est consigné dans un journal horodaté, conservé comme preuve du
              consentement aussi longtemps que nécessaire à cette fin.
            </p>
            <p className="mt-2">
              <strong className="text-white">Droit à l&apos;image</strong>&nbsp;: pour
              chaque photo d&apos;événement, les personnes qui y figurent sont
              recensées, et la photo n&apos;est publiée que si toutes y consentent. Pour
              une participante, c&apos;est son consentement de visibilité&nbsp;; pour une
              autre personne (jurée, intervenante, public), l&apos;association recueille
              son accord et l&apos;horodate. Toute personne figurant sur une photo peut
              en demander le retrait, sans justification, via le{" "}
              <LienTexte href="/contact">
                formulaire de contact
              </LienTexte>.
            </p>
            <p className="mt-2">
              Les retours du jury, les vidéos de pitch et les notes de suivi sont{" "}
              <strong className="text-white">strictement individuels</strong>&nbsp;:
              visibles de la seule participante concernée, des organisatrices et,
              pour son suivi, de son coach. Les supports d&apos;atelier sont partagés
              entre les participantes de l&apos;atelier (et son coach). Aucun de ces
              documents n&apos;est publié.
            </p>
            <p className="mt-2">
              Pour l&apos;organisation de l&apos;accompagnement, l&apos;association note
              la <strong className="text-white">présence aux ateliers</strong> des
              participantes (usage interne, jamais publié). Les personnes qui animent
              (coachs, jury) peuvent renseigner un <strong className="text-white">genre</strong>{" "}
              déclaratif&nbsp;: facultatif, utilisé uniquement pour des statistiques de
              mixité de l&apos;accompagnement, il n&apos;est jamais affiché publiquement.
            </p>
            <p className="mt-2">
              Le palmarès et la galerie d&apos;une édition sont l&apos;archive d&apos;un
              événement public&nbsp;: les informations qu&apos;une participante a
              consenti à publier (nom, sujet, prix éventuel) peuvent rester en ligne
              après la suppression de son compte, au titre de l&apos;intérêt légitime,
              de même que ses retours de jury restent archivés en privé. Elle peut à
              tout moment demander leur retrait ou leur anonymisation via le{" "}
              <LienTexte href="/contact">
                formulaire de contact
              </LienTexte>
              &nbsp;: un prix gagné reste alors affiché sans son nom.
            </p>

            <h3 className="text-white font-semibold mt-4 mb-1">E-mails</h3>
            <p>
              Les e-mails (lien de connexion, mise en relation via une fiche, décision
              de publication, rappel de mise à jour, annonce de suppression d&apos;un
              compte resté sans activité, rappel d&apos;échéance d&apos;adhésion ou de sortie de
              l&apos;annuaire, et une invitation à adhérer, envoyée une seule fois aux titulaires
              d&apos;une fiche publiée à l&apos;ouverture des adhésions) sont envoyés via notre prestataire{" "}
              <ExternalLink
                href="https://www.brevo.com/fr/"
                className={LIEN_TEXTE}
              >
                Brevo
              </ExternalLink>
              . Lorsqu&apos;un visiteur contacte une speakeuse, le message passe par un
              formulaire relais&nbsp;: l&apos;adresse de la speakeuse n&apos;est pas
              divulguée. Le message est d&apos;abord relu par l&apos;équipe (modération)
              avant d&apos;être éventuellement transmis, afin de préserver un espace sûr.
            </p>

            <h3 className="text-white font-semibold mt-4 mb-1">Lettre d&apos;information</h3>
            <p>
              Les personnes ayant un compte reçoivent quelques fois par an une lettre
              d&apos;information (nouveautés de la plateforme, vie de
              l&apos;association). Elle est envoyée via{" "}
              <ExternalLink
                href="https://www.brevo.com/fr/"
                className={LIEN_TEXTE}
              >
                Brevo
              </ExternalLink>
              , à qui nous transmettons pour cela l&apos;adresse e-mail, le prénom et le
              nom du compte, ainsi que quelques indications de ciblage (fiche en ligne ou
              à publier, participation au Tremplin, rôle de coach ou d&apos;organisatrice).
              Base légale&nbsp;: l&apos;<strong className="text-white">intérêt légitime</strong>{" "}
              d&apos;une association à informer ses membres. Chaque envoi porte un lien de
              désinscription en un clic, et le choix se change à tout moment dans
              «&nbsp;Mon espace → Réglages&nbsp;». Se désinscrire de la lettre
              d&apos;information <strong className="text-white">laisse intacts</strong>{" "}
              les e-mails liés au compte (lien de connexion, décision sur la fiche, message
              reçu), qui relèvent du service. Les rappels sur la fiche, eux, se règlent
              au même endroit&nbsp;: chacune choisit leur{" "}
              <strong className="text-white">fréquence</strong>, jusqu&apos;à
              «&nbsp;Aucun&nbsp;».
            </p>

            <h3 className="text-white font-semibold mt-4 mb-1">Messages de contact</h3>
            <p>
              Les messages envoyés à une speakeuse via sa fiche (nom et adresse e-mail
              de l&apos;expéditeur, motif, contenu) sont enregistrés puis modérés par
              l&apos;équipe. Ils sont conservés, qu&apos;ils soient transmis ou non, à des
              fins de sécurité et de prévention des abus (base légale&nbsp;: intérêt
              légitime). Ils sont supprimés en cascade si le compte de la speakeuse
              destinataire est supprimé.
            </p>

            <h3 className="text-white font-semibold mt-4 mb-1">Conservation</h3>
            {/* La DURÉE est lue depuis les constantes du code (celles-là mêmes
                qui pilotent le cron) : la notice publiée ne peut donc plus
                contredire ce que la plateforme fait. C'est aussi pourquoi ces
                délais ne sont pas des réglages d'écran — cf.
                docs/conception-conservation-comptes.md. */}
            <p>
              Les données d&apos;un compte sont conservées tant qu&apos;il sert.
              Après <strong className="text-white">{dureeEnAns(DUREE_INACTIVITE_JOURS)}</strong>{" "}
              sans signe de vie (aucune connexion et aucune modification de la fiche),
              un e-mail annonce la suppression&nbsp;: le compte est effacé{" "}
              {nb(PREAVIS_SUPPRESSION_JOURS, "jour")} plus tard, et une simple connexion
              pendant ce préavis annule tout. La conservation maximale est donc de{" "}
              {nb(DUREE_INACTIVITE_JOURS + PREAVIS_SUPPRESSION_JOURS, "jour")} après le
              dernier signe de vie, hors adhésion en cours&nbsp;: une adhésion à jour
              suspend ce compte à rebours. Un rappel de mise à jour est par ailleurs envoyé aux
              fiches publiées, à la fréquence que chacune choisit dans ses réglages.
            </p>
            <p>
              La suppression efface définitivement la fiche, les talks, les messages
              reçus et le compte (effet en cascade), à l&apos;exception des données
              Tremplin décrites ci-dessus (archive de l&apos;événement, retirables sur
              demande). Elle vaut qu&apos;elle soit demandée ou qu&apos;elle vienne de
              ce délai.
            </p>

            <h3 className="text-white font-semibold mt-4 mb-1">Cookies</h3>
            <p>
              Ce site n&apos;utilise que des cookies strictement nécessaires ou
              fonctionnels&nbsp;: le maintien de votre session lorsque vous êtes
              connectée, la sécurité de la connexion, et la mémorisation de votre
              dernière méthode de connexion sur cet appareil (pour vous la
              représenter). Aucun cookie publicitaire ni traceur tiers n&apos;est
              déposé&nbsp;; conformément à la réglementation, ces cookies ne
              nécessitent pas de recueil de consentement.
            </p>
            <p className="mt-2">
              Nous ne déposons aucun traceur non nécessaire sans votre consentement.
            </p>

            <h3 className="text-white font-semibold mt-4 mb-1">Mesure d&apos;audience</h3>
            <p>
              Ce site utilise Vercel Analytics pour mesurer la fréquentation de manière anonyme.
              Cet outil ne dépose aucun cookie, ne collecte aucune donnée personnelle et ne
              permet pas de vous identifier. Il est conforme au RGPD sans recueil de
              consentement.
            </p>

            <h3 className="text-white font-semibold mt-4 mb-1">Vos droits</h3>
            <p>
              Pour exercer vos droits d&apos;accès, de rectification, d&apos;effacement,
              de limitation, de portabilité et d&apos;opposition, ou pour retirer votre
              consentement, écrivez à la déléguée à la protection des données à{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className={`${LIEN_TEXTE} break-all`}>
                {CONTACT_EMAIL}
              </a>{" "}
              en indiquant «&nbsp;Données personnelles&nbsp;» dans l&apos;objet, ou passez
              par le{" "}
              <LienTexte href="/contact">
                formulaire de contact
              </LienTexte>
              . Nous répondons sous un mois. Vous pouvez aussi saisir la{" "}
              <ExternalLink href="https://www.cnil.fr" className={LIEN_TEXTE}>
                CNIL
              </ExternalLink>
              .
            </p>
            <p className="mt-2">
              Une speakeuse connectée peut aussi modifier sa fiche et{" "}
              <strong className="text-white">supprimer son compte</strong> directement
              depuis son espace (zone danger).
            </p>

            <h3 className="text-white font-semibold mt-4 mb-1">Photos et vidéos</h3>
            <p>
              Nous prenons des photos et des vidéos pendant nos événements. Vous pouvez
              refuser d&apos;apparaître sur les images publiées&nbsp;: il suffit de cocher
              la case de refus à l&apos;inscription et de prendre un badge à
              l&apos;accueil. Les intervenantes et les participantes de nos programmes
              signent une autorisation écrite. Nous traitons toute demande de
              suppression sous trente jours.
            </p>
          </div>

          {/* Accessibilité */}
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Accessibilité</h2>
            <p>
              Tech Speak&apos;Her s&apos;engage à rendre son site web accessible conformément au{" "}
              <strong className="text-white">Référentiel Général d&apos;Amélioration de l&apos;Accessibilité (RGAA 4.1)</strong>.
            </p>

            <h3 className="text-white font-semibold mt-4 mb-1">État de conformité</h3>
            <p>
              Ce site est en <strong className="text-white">conformité partielle</strong> avec
              le RGAA 4.1. Le taux de conformité estimé est de{" "}
              <strong className="text-cyan">95&nbsp;%</strong> (score Lighthouse accessibilité).
            </p>

            <h3 className="text-white font-semibold mt-4 mb-1">Mesures mises en place</h3>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Navigation au clavier avec indicateur <code className="text-cyan text-xs">focus-visible</code> sur tous les éléments interactifs</li>
              <li>Contrastes de couleurs conformes au niveau AA (ratio minimum 4,5:1 pour le texte, 3:1 pour les grands textes)</li>
              <li>Textes alternatifs sur les images et icônes décoratives masquées (<code className="text-cyan text-xs">aria-hidden</code>)</li>
              <li>Liens externes identifiés pour les lecteurs d&apos;écran (<code className="text-cyan text-xs">sr-only</code>)</li>
              <li>Animations désactivées pour les utilisateurs ayant activé <code className="text-cyan text-xs">prefers-reduced-motion</code></li>
              <li>Structure sémantique HTML5 avec landmarks et titres hiérarchiques</li>
              <li>Alertes d&apos;erreur accessibles (<code className="text-cyan text-xs">role=&quot;alert&quot;</code>, <code className="text-cyan text-xs">aria-invalid</code>)</li>
              <li>Filtres de listes en boutons à deux états (<code className="text-cyan text-xs">aria-pressed</code>) regroupés sous un intitulé, atteignables à la tabulation</li>
              <li>Régions mises à jour annoncées aux lecteurs d&apos;écran (<code className="text-cyan text-xs">aria-live=&quot;polite&quot;</code>)</li>
              <li>Champ de recherche avec pattern combobox (<code className="text-cyan text-xs">role=&quot;combobox&quot;</code>, <code className="text-cyan text-xs">aria-controls</code>, <code className="text-cyan text-xs">aria-activedescendant</code>)</li>
            </ul>

            <h3 className="text-white font-semibold mt-4 mb-1">Contenus non accessibles</h3>
            <p>
              Les logos SVG contiennent des images embarquées dont le texte n&apos;est pas sélectionnable.
              Un texte alternatif est fourni via l&apos;attribut <code className="text-cyan text-xs">alt</code>.
            </p>

            <h3 className="text-white font-semibold mt-4 mb-1">Retour d&apos;information</h3>
            <p>
              Si vous rencontrez un défaut d&apos;accessibilité, contactez-nous via le{" "}
              <LienTexte href="/contact">
                formulaire de contact
              </LienTexte>.
              Nous nous engageons à apporter une réponse dans un délai raisonnable.
            </p>

            <p className="mt-3 text-xs text-gray-light">
              Déclaration établie le 6 avril 2026.
            </p>
          </div>

          {/* Crédits */}
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Crédits</h2>
            <p>
              Site développé avec Next.js et hébergé sur Vercel.
            </p>
          </div>
        </div>
      </div>
      </section>
    </>
  );
}
