import Link from "next/link";
import Avatar from "@/components/Avatar";
import ChipGroup from "@/components/ChipGroup";
import Button from "@/components/Button";
import TalkCard from "@/components/TalkCard";
import { REGION_TOUTE_LA_FRANCE, REGIONS_METROPOLE } from "@/data/domaines";
import { speakeuseHref, type SpeakerProfile } from "@/lib/profiles";
import type { Talk } from "@/lib/talks";
import { SECTION_PAR_CLE, type CleSection } from "@/lib/profil-sections";

/**
 * LE CORPS d'une fiche speakeuse — un seul rendu, deux vues : la page publique
 * (`/speakeuses/[id]`) et « Ma fiche » (`/mon-espace/fiche`).
 *
 * « Ma fiche » montrait une liste de NOMS de rubriques avec un résumé d'une
 * ligne : il fallait ouvrir chaque section pour savoir ce qu'elle contenait, et
 * on ne voyait jamais sa fiche comme les orgas la lisent. Elle montre désormais
 * la fiche elle-même, chaque partie menant à sa page d'édition. Deux rendus
 * séparés auraient divergé au premier changement — d'où ce composant, conforme
 * au §3 des principes (mutualiser par les CAPACITÉS, pas par copie).
 *
 * `vue` est EXPLICITE et obligatoire. Elle a été déduite un temps de la présence
 * des liens d'édition — un drapeau de présentation faisait alors office de
 * drapeau d'autorisation : une future vue de modération orga qui aurait voulu
 * les liens aurait hérité du tutoiement ET de l'attestation, donnée que le
 * public ne doit jamais voir. Ce que la vue décide :
 * - `publique` : une partie vide ne rend RIEN, aucun lien d'édition, le nom est
 *   le `h1` de la page, et l'on s'adresse aux visiteuses (« Contacter Léa »).
 * - `proprietaire` : chaque partie mène à sa page d'édition, une partie vide
 *   reste affichée avec le geste à faire (sinon elle deviendrait inéditable), et
 *   l'on s'adresse à elle.
 */
export type VueFiche = "publique" | "proprietaire";

export interface FicheCorpsProps {
  vue: VueFiche;
  profile: SpeakerProfile;
  talks: readonly Talk[];
  /** Racine des pages de section (`${editBase}/${cle}`), vue propriétaire. Une
   * seule prop plutôt qu'une table par section : celle-ci rendait représentables
   * des états incohérents (une partie nommée, les autres anonymes). */
  editBase?: string;
  /** Racine des pages de talk (`${talksBase}/${id}`), vue propriétaire. */
  talksBase?: string;
  /** Geste rapide sous chaque talk, vue propriétaire (« Une date », fenêtre
   * d'ajout d'une conférence sans ouvrir le talk). Un rendu passé par la page :
   * le corps reste partagé avec la vue publique et n'importe rien du client. */
  actionTalk?: (talk: Talk) => React.ReactNode;
}

/**
 * L'en-tête d'une partie, en vue propriétaire : LA RANGÉE ENTIÈRE est le lien
 * vers la page d'édition.
 *
 * C'était un crayon isolé à droite du titre — 44 px de cible, mais séparé de son
 * titre par jusqu'à 500 px de vide, et six contrôles visuellement identiques
 * dont l'unicité ne vivait que dans l'`aria-label` (§6 : jamais ça). La rangée
 * entière donne une cible pleine largeur, un intitulé accessible naturellement
 * unique, et remet le geste au contact de ce qu'il modifie (§1).
 *
 * Le verbe suit l'état : on n'AJOUTE pas ce qui existe, on ne MODIFIE pas ce qui
 * manque.
 */
function EnTetePartie({
  id,
  titre,
  href,
  vide,
}: {
  id: string;
  titre: string;
  href: string;
  vide: boolean;
}) {
  return (
    <h2 id={id} className="text-sm font-bold text-cream">
      <Link
        href={href}
        className="-mx-2 flex min-h-[44px] items-center justify-between gap-3 rounded-lg px-2 hover:text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
      >
        <span>{titre}</span>
        <span className="shrink-0 text-sm font-medium text-cyan">
          {vide ? "Ajouter" : "Modifier"}
        </span>
      </Link>
    </h2>
  );
}

/** Ce que le composant sait d'une partie, résolu une fois par `partieDe`. */
interface FaitsPartie {
  id: string;
  titre: string;
  vide: boolean;
  resume: string;
  href: string | undefined;
}

/**
 * Une partie de la fiche. En vue publique, une partie vide ne rend rien —
 * l'annuaire ne montre pas des trous. En vue propriétaire elle RESTE, avec le
 * geste à faire : sans ça, elle perdrait son lien et deviendrait inéditable.
 *
 * Une partie NOMMÉE porte toujours `aria-labelledby` : par son en-tête-lien côté
 * propriétaire, par `titrePublic` côté public. Le nom accessible d'une section ne
 * doit pas dépendre de ce que l'appelant a pensé à mettre dans `children`.
 */
function Partie({
  p,
  className,
  titrePublic,
  children,
}: {
  p: FaitsPartie;
  className: string;
  /** Titre visible en vue PUBLIQUE, quand la partie en porte un (le contact). */
  titrePublic?: string;
  children: React.ReactNode;
}) {
  if (p.vide && !p.href) return null;
  const nomme = p.href !== undefined || titrePublic !== undefined;
  // Sans titre, pas de `<section>` : un repère de page sans nom accessible
  // n'apporte rien et contrevient à la convention du projet. C'étaient des `<div>`
  // avant l'extraction, ils le restent.
  const Balise = nomme ? "section" : "div";
  return (
    <Balise className={className} aria-labelledby={nomme ? p.id : undefined}>
      {p.href ? (
        <EnTetePartie id={p.id} titre={p.titre} href={p.href} vide={p.vide} />
      ) : (
        titrePublic && (
          <h2 id={p.id} className="text-lg font-bold text-white mb-3">
            {titrePublic}
          </h2>
        )
      )}
      {p.vide ? <p className="mt-1 text-sm text-gray-light">{p.resume}</p> : children}
    </Balise>
  );
}

export default function FicheSpeakeuseCorps({
  vue,
  profile,
  talks,
  editBase,
  talksBase,
  actionTalk,
}: FicheCorpsProps) {
  const proprietaire = vue === "proprietaire";
  const nom = profile.nomAffiche;
  // Le prénom ne se découpe que dans un VRAI nom : le repli donnerait
  // « Contacter Développeuse » (premier mot d'un titre) ou « Contacter
  // Speakeuse » — le titre de section a son propre repli, plus bas.
  const prenom = profile.name?.trim().split(" ")[0];
  const sousTitre = [profile.poste, profile.entreprise].filter(Boolean).join(" · ");

  /** Ce qu'une partie a besoin de savoir d'elle-même. `estVide` et la phrase de
   * repli viennent du REGISTRE : la vue décidait d'afficher un bloc selon une
   * règle et affichait la phrase depuis une AUTRE, et les deux avaient déjà
   * divergé (une fiche dont le seul lien était Sessionize s'annonçait « vide »
   * tout en listant « Sessionize »). */
  const partie = (cle: CleSection): FaitsPartie => {
    const s = SECTION_PAR_CLE[cle];
    return {
      id: `fiche-${cle}`,
      titre: s.titre,
      vide: s.estVide(profile),
      resume: s.vide,
      href: editBase ? `${editBase}/${cle}` : undefined,
    };
  };

  // Le repli d'affichage « Toute la France » résume les 13 régions (les données
  // gardent le détail pour les filtres de l'annuaire).
  const regionsLisibles = profile.regions.includes(REGION_TOUTE_LA_FRANCE)
    ? profile.regions.filter((r) => !(REGIONS_METROPOLE as readonly string[]).includes(r))
    : profile.regions;

  const canMessage = profile.status === "publie" && profile.contactEmailOk;
  // Ces liens (comme ceux de `cfpLinks`) sont SAISIS par la speakeuse : rendus
  // en `ugc nofollow` (prop `ugc`). Un site perso mène souvent vers une activité
  // professionnelle, et l'association n'a ni choisi ni relu ces destinations.
  const contactLinks: { label: string; href: string }[] = [];
  if (profile.linkedin) contactLinks.push({ label: "LinkedIn", href: profile.linkedin });
  if (profile.website) contactLinks.push({ label: "Site web", href: profile.website });
  if (profile.instagram) contactLinks.push({ label: "Instagram", href: profile.instagram });
  /**
   * Rien à montrer côté PUBLIC : ni relais, ni lien. `estVide` du registre ne
   * regarde que le consentement, pas le statut — une fiche en attente avec le
   * relais ouvert et aucun lien rendait donc un cadre bordé, titré « Contacter
   * Léa », et vide. La vue propriétaire garde sa partie : elle y décrit l'état du
   * canal, qui est justement ce qu'il faut savoir avant publication.
   */
  const contactMuet = !proprietaire && !canMessage && contactLinks.length === 0;

  // Plateformes de CFP (Sessionize, Conference Hall) : ce sont des portfolios de
  // talks → affichés dans « Talks & conférences », pas dans le contact.
  const cfpLinks: { label: string; href: string }[] = [];
  if (profile.sessionizeUrl) cfpLinks.push({ label: "Sessionize", href: profile.sessionizeUrl });
  if (profile.conferenceHallUrl)
    cfpLinks.push({ label: "Conference Hall", href: profile.conferenceHallUrl });

  const identite = partie("identite");
  const attestation = partie("attestation");

  return (
    <>
      {/* Identité — grand portrait ; empilé sur mobile (la photo prend la
          largeur), en ligne à partir de sm. La VILLE et la BIO vivent ici : c'est
          le périmètre que la section « Qui tu es » édite déjà, et un lien par
          bloc visuel n'était pas lisible autrement. */}
      <section aria-labelledby={identite.href ? identite.id : undefined}>
        {identite.href && (
          <EnTetePartie
            id={identite.id}
            titre={identite.titre}
            href={identite.href}
            vide={identite.vide}
          />
        )}
        <header
          className={`flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-6 ${
            proprietaire ? "mt-2" : ""
          }`}
        >
          <Avatar name={nom} image={profile.image} size="xl" />
          <div className="min-w-0">
            {/* Le nom est le TITRE de la page publique (h1). En vue propriétaire
                la page a déjà son h1 (« Ma fiche speakeuse ») : le nom devient un
                h3 sous « Qui tu es » — un texte de la taille d'un titre, hors du
                plan du document, se perd au lecteur d'écran. */}
            {proprietaire ? (
              <h3 className="text-2xl font-bold text-white">{nom}</h3>
            ) : (
              <h1 className="text-2xl font-bold text-white">{nom}</h1>
            )}
            {/* Sans vrai nom, nomAffiche EST le titre du profil : cette ligne
                le répéterait mot pour mot sous le h1. */}
            {profile.titreProfil && profile.name?.trim() && (
              <p className="text-magenta font-medium">{profile.titreProfil}</p>
            )}
            {sousTitre && <p className="text-sm text-gray-light">{sousTitre}</p>}
            {profile.ville && (
              <p className="mt-1 text-sm text-gray-light">
                Basée à {profile.ville}
                {profile.regionResidence ? `, ${profile.regionResidence}` : ""}
              </p>
            )}
          </div>
        </header>
        {profile.bio && (
          <p className="mt-6 text-white leading-relaxed whitespace-pre-line">{profile.bio}</p>
        )}
        {/* La phrase de repli suit `estVide` du registre, PAS la seule absence de
            bio : sinon elle annonçait « ton nom seul » à une fiche qui affichait
            juste au-dessus un titre, un poste et une ville. */}
        {identite.href && identite.vide && (
          <p className="mt-4 text-sm text-gray-light">{identite.resume}</p>
        )}
      </section>

      <Partie p={partie("secteurs")} className="mt-8">
        {/* L'étiquette n'est là qu'en vue publique : en vue propriétaire,
            l'en-tête de la partie (« Tes secteurs ») la dit déjà. */}
        <ChipGroup
          label={proprietaire ? undefined : "Secteurs"}
          items={profile.secteurs}
          tone="magenta"
        />
      </Partie>

      <Partie p={partie("sujets")} className="mt-6">
        <ChipGroup label={proprietaire ? undefined : "Sujets"} items={profile.sujets} tone="cyan" />
      </Partie>

      <Partie p={partie("interventions")} className="mt-6">
        <div className="mt-1 flex flex-col gap-3">
          {/* « Intervient » parle d'elle à la troisième personne : juste pour une
              visiteuse, bancal sous un titre qui dit « Où TU interviens ». */}
          <ChipGroup
            label={proprietaire ? "Régions" : "Intervient"}
            items={regionsLisibles}
            tone="orange"
          />
          <ChipGroup label="Langues" items={profile.langues} tone="neutral" />
        </div>
      </Partie>

      {/* Talks — hors registre des sections de profil (ils ont leurs propres
          pages), donc toujours rendus : « Aucun talk » est une information utile.
          En vue propriétaire la partie mène à la gestion des talks — sans ça,
          c'était le seul endroit de la fiche où l'on voyait un manque sans
          pouvoir rien en faire. */}
      <section className="mt-10" aria-labelledby="fiche-talks">
        {talksBase ? (
          <EnTetePartie
            id="fiche-talks"
            titre="Tes talks"
            href={talks.length === 0 ? `${talksBase}/nouveau` : talksBase}
            vide={talks.length === 0}
          />
        ) : (
          <h2 id="fiche-talks" className="text-lg font-bold text-white mb-3">
            Talks &amp; conférences
          </h2>
        )}
        {talks.length === 0 ? (
          <p className="mt-1 text-sm text-gray-light">
            Aucun talk sur {proprietaire ? "ta" : "cette"} fiche pour l&apos;instant.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3 list-none">
            {talks.map((t) => (
              <li key={t.id} className="flex flex-col gap-2">
                <TalkCard talk={t} editHref={talksBase ? `${talksBase}/${t.id}` : undefined} />
                {proprietaire && actionTalk?.(t)}
              </li>
            ))}
          </ul>
        )}
        {cfpLinks.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-gray-light">
            Aussi sur
            {cfpLinks.map((l) => (
              <Button key={l.label} href={l.href} external ugc variant="ghost" size="sm" className="px-0">
                {l.label}
              </Button>
            ))}
          </p>
        )}
      </section>

      {/* Contact — en bas : on contacte après avoir lu la fiche. Mêmes éléments
          pour toutes (constance) : un seul bouton possible (le relais e-mail),
          LinkedIn/site/Instagram en liens discrets. */}
      <Partie
        p={{ ...partie("contact"), vide: partie("contact").vide || contactMuet }}
        className="mt-10 pt-6 border-t border-navy-lighter"
        titrePublic={
          proprietaire
            ? undefined
            : prenom
              ? `Contacter ${prenom}`
              : "Contacter cette speakeuse"
        }
      >
        {/* « Envoyer un message » est le geste d'une VISITEUSE. En vue
            propriétaire c'était le plus gros bouton de l'écran, et il menait à un
            formulaire pour s'écrire à soi-même : on DÉCRIT le canal, on ne
            propose pas le geste. */}
        {proprietaire ? (
          <p className="mt-1 text-sm text-gray-light">
            {profile.contactEmailOk
              ? "Messages par e-mail : activé. Les visiteuses écrivent par un relais, ton adresse reste masquée."
              : "Messages par e-mail : fermé. Tes liens ci-dessous restent le moyen de te joindre."}
          </p>
        ) : (
          canMessage && (
            <Button href={`${speakeuseHref(profile)}/contact`}>Envoyer un message</Button>
          )
        )}
        {contactLinks.length > 0 && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
            {contactLinks.map((l) => (
              <Button key={l.label} href={l.href} external ugc variant="ghost" size="sm" className="px-0">
                {l.label}
              </Button>
            ))}
          </div>
        )}
      </Partie>

      {/* L'attestation ne s'affiche JAMAIS publiquement — mais sans partie ici
          elle serait inéditable, le défaut que sa page d'édition a corrigé. On
          MARQUE ce qui reste privé : l'écran promet « ce que les orgas voient »,
          et cette ligne-là, personne d'autre qu'elle ne la lit. */}
      {attestation.href && (
        <section className="mt-8 pt-4 border-t border-navy-lighter" aria-labelledby={attestation.id}>
          <EnTetePartie
            id={attestation.id}
            titre={attestation.titre}
            href={attestation.href}
            vide={attestation.vide}
          />
          <p className="mt-1 text-sm text-gray-light">
            {attestation.vide
              ? attestation.resume
              : "Signée : tu confirmes faire partie de la communauté."}{" "}
            Visible par toi seule.
          </p>
        </section>
      )}
    </>
  );
}
