/**
 * Catalogue d'amorçage de la référence des conférences (lot 2, France d'abord).
 * Inséré en base par `seedConferences()` (src/lib/conference-seed.ts),
 * idempotent : une conférence déjà présente (même slug) n'est jamais réécrite.
 *
 * ATTRIBUTIONS (ne pas retirer) :
 * - Conférences tech France : extraction manuelle de developers.events
 *   (dépôt scraly/developers-conferences-agenda), contenu sous licence
 *   CC BY-NC 4.0 (attribution requise, usage non commercial : Tech Speak'Her
 *   est une association loi 1901). https://developers.events/
 * - Assos toulousaines : Toulouse Tech Hub (dépôt GDGToulouse/toulouse-tech-hub,
 *   licence MIT). https://toulouse-tech-hub.fr/ — la liste complète des
 *   communautés est synchronisée automatiquement (meetups) ; le seed n'amorce
 *   que les plus proches de TSH.
 * - Conférences product / UX et compléments : lecture manuelle de
 *   montaine-consulting.fr (page Conférences et Podcasts) et des sites des
 *   événements.
 * - Portfolio public d'Aurélie Vache (noti.st/aurelievache), transmis par
 *   l'association : conférences où elle est intervenue. Aucune donnée
 *   personnelle reprise — seulement des noms d'événements publics.
 *
 * `siteUrl` null = site non vérifié au moment du seed (complété via l'UI orga).
 * `pays` null = conférence itinérante (KubeCon…) : rien à pré-remplir.
 *
 * PÉRIMÈTRE (élargi en 2026-08) : au départ « France d'abord », une vingtaine de
 * conférences. Trop peu : une speakeuse un peu active n'y trouvait presque aucune
 * des siennes et devait toutes les faire ajouter une par une. Le catalogue couvre
 * désormais les conférences FR récurrentes (au moins deux millésimes 2023-2025
 * dans l'agenda developers.events) et les internationales fréquentées depuis la
 * France. Le complément passe toujours par la proposition depuis l'espace membre
 * (`conference_propositions`), qui ne bloque plus la saisie (migration 068).
 */

export interface ConferenceSeed {
  nom: string;
  type: "conference" | "asso";
  ville: string | null;
  /**
   * `null` pour une conférence ITINÉRANTE (KubeCon change de pays chaque année) :
   * mieux vaut un lieu absent, que la speakeuse renseigne elle-même, qu'un lieu
   * faux pré-rempli — le formulaire ne comble que les champs vides.
   */
  pays: string | null;
  siteUrl: string | null;
}

export const CONFERENCES_SEED: ConferenceSeed[] = [
  // ─── Conférences tech (France) ───
  { nom: "DevFest Toulouse", type: "conference", ville: "Toulouse", pays: "France", siteUrl: "https://devfesttoulouse.fr" },
  { nom: "DevFest Nantes", type: "conference", ville: "Nantes", pays: "France", siteUrl: "https://devfest.gdgnantes.com" },
  { nom: "DevFest Lille", type: "conference", ville: "Lille", pays: "France", siteUrl: "https://devfest.gdglille.org" },
  { nom: "Devoxx France", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://www.devoxx.fr" },
  { nom: "Touraine Tech", type: "conference", ville: "Tours", pays: "France", siteUrl: "https://touraine.tech" },
  { nom: "SnowCamp", type: "conference", ville: "Grenoble", pays: "France", siteUrl: "https://snowcamp.io" },
  { nom: "MiXiT", type: "conference", ville: "Lyon", pays: "France", siteUrl: "https://mixitconf.org" },
  { nom: "BreizhCamp", type: "conference", ville: "Rennes", pays: "France", siteUrl: "https://www.breizhcamp.org" },
  { nom: "Sunny Tech", type: "conference", ville: "Montpellier", pays: "France", siteUrl: "https://sunny-tech.io" },
  { nom: "Volcamp", type: "conference", ville: "Clermont-Ferrand", pays: "France", siteUrl: "https://www.volcamp.io" },
  { nom: "DevLille", type: "conference", ville: "Lille", pays: "France", siteUrl: "https://devlille.fr" },
  { nom: "BDX I/O", type: "conference", ville: "Bordeaux", pays: "France", siteUrl: "https://bdxio.fr" },
  { nom: "Riviera Dev", type: "conference", ville: "Sophia Antipolis", pays: "France", siteUrl: "https://rivieradev.fr" },
  { nom: "Paris Web", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://www.paris-web.fr" },
  { nom: "Codeurs en Seine", type: "conference", ville: "Rouen", pays: "France", siteUrl: "https://www.codeursenseine.com" },
  { nom: "Forum PHP", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://event.afup.org" },
  { nom: "Capitole du Libre", type: "conference", ville: "Toulouse", pays: "France", siteUrl: "https://capitoledulibre.org" },
  { nom: "Cloud Nord", type: "conference", ville: "Lille", pays: "France", siteUrl: "https://www.cloudnord.fr" },
  { nom: "Cloud Toulouse", type: "conference", ville: "Toulouse", pays: "France", siteUrl: null },
  { nom: "Agile Tour Toulouse", type: "conference", ville: "Toulouse", pays: "France", siteUrl: null },
  { nom: "Agile Pays Basque", type: "conference", ville: "Bidart", pays: "France", siteUrl: null },
  { nom: "Tech.Rocks Summit", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://www.tech.rocks" },
  { nom: "NCL Days", type: "conference", ville: null, pays: "France", siteUrl: null },
  { nom: "Yeeso", type: "conference", ville: "Toulouse", pays: "France", siteUrl: null },

  // ─── Conférences tech (France) — élargissement 2026-08 ───
  // Les conférences récurrentes de l'agenda developers.events (présentes sur au
  // moins deux des millésimes 2023-2025). Le catalogue d'origine s'arrêtait à
  // une vingtaine d'entrées : une speakeuse un peu active en trouvait rarement
  // une seule des siennes, et devait passer par la demande d'ajout pour chacune.
  { nom: "AFUP Day", type: "conference", ville: "Lyon", pays: "France", siteUrl: "https://event.afup.org" },
  { nom: "Agi'Lille", type: "conference", ville: "Lille", pays: "France", siteUrl: "https://agilille.fr" },
  { nom: "Agile en Seine", type: "conference", ville: "Issy-les-Moulineaux", pays: "France", siteUrl: "https://www.agileenseine.com" },
  { nom: "Agile Game Toulouse", type: "conference", ville: "Toulouse", pays: "France", siteUrl: null },
  { nom: "Agile Games France", type: "conference", ville: "Lille", pays: "France", siteUrl: "https://agilegamesfrance.fr" },
  { nom: "Agile Grenoble", type: "conference", ville: "Grenoble", pays: "France", siteUrl: "https://agile-grenoble.org" },
  { nom: "Agile Lyon", type: "conference", ville: "Lyon", pays: "France", siteUrl: "https://www.agilelyon.fr" },
  { nom: "Agile Niort", type: "conference", ville: "Niort", pays: "France", siteUrl: "https://agileniort.fr" },
  { nom: "Agile Tour Aix-Marseille", type: "conference", ville: "Gardanne", pays: "France", siteUrl: "https://atmrs.esprit-agile.com" },
  { nom: "Agile Tour Bordeaux", type: "conference", ville: "Bordeaux", pays: "France", siteUrl: "https://agiletourbordeaux.fr" },
  { nom: "Agile Tour Montpellier", type: "conference", ville: "Montpellier", pays: "France", siteUrl: "https://agiletourmontpellier.fr" },
  { nom: "Agile Tour Nantais", type: "conference", ville: "Nantes", pays: "France", siteUrl: "https://agilenantes.org" },
  { nom: "Agile Tour Rennes", type: "conference", ville: "Rennes", pays: "France", siteUrl: "https://agiletour.agilerennes.org" },
  { nom: "AgiLeMans", type: "conference", ville: "Le Mans", pays: "France", siteUrl: "https://www.agilemans.org" },
  { nom: "Alpes Craft", type: "conference", ville: "Grenoble", pays: "France", siteUrl: "https://www.alpescraft.fr" },
  { nom: "Android Makers", type: "conference", ville: "Montrouge", pays: "France", siteUrl: "https://androidmakers.droidcon.com" },
  { nom: "APIdays Paris", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://www.apidays.global/paris" },
  { nom: "Archilocus", type: "conference", ville: "Bordeaux", pays: "France", siteUrl: "https://www.archilocus.tech" },
  { nom: "AWS Summit Paris", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://aws.amazon.com/fr/events/summits/paris/" },
  { nom: "Camping des Speakers", type: "conference", ville: "Baden", pays: "France", siteUrl: "https://camping-speakers.fr" },
  { nom: "Cloud Alpes", type: "conference", ville: "Lyon", pays: "France", siteUrl: "https://www.cloudalpes.fr" },
  { nom: "DevFest Dijon", type: "conference", ville: "Dijon", pays: "France", siteUrl: "https://devfest.developers-group-dijon.fr" },
  { nom: "DevFest Paris", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://devfest.gdgparis.fr" },
  { nom: "DevFest Perros-Guirec", type: "conference", ville: "Perros-Guirec", pays: "France", siteUrl: "https://devfest.codedarmor.fr" },
  { nom: "DevFest Strasbourg", type: "conference", ville: "Strasbourg", pays: "France", siteUrl: "https://devfest.gdgstrasbourg.fr" },
  { nom: "DevOps D-Day", type: "conference", ville: "Marseille", pays: "France", siteUrl: "https://www.devopsdday.com" },
  { nom: "DevQuest", type: "conference", ville: "Niort", pays: "France", siteUrl: "https://www.devquest.fr" },
  { nom: "dotAI", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://www.dotai.io" },
  { nom: "dotJS", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://www.dotjs.io" },
  { nom: "Flutter Connection", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://flutterconnection.io" },
  { nom: "JUG Summer Camp", type: "conference", ville: "La Rochelle", pays: "France", siteUrl: "https://www.jugsummercamp.org" },
  { nom: "Lyon Craft", type: "conference", ville: "Lyon", pays: "France", siteUrl: "https://lyon-craft.fr" },
  { nom: "Mobilis In Mobile", type: "conference", ville: "Nantes", pays: "France", siteUrl: "https://mobilis-in-mobile.io" },
  { nom: "NewCrafts", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://ncrafts.io" },
  { nom: "Normandie.ai", type: "conference", ville: "Rouen", pays: "France", siteUrl: "https://normandie.ai" },
  { nom: "Open Source Experience", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://www.opensource-experience.com" },
  { nom: "OVHcloud Summit", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://summit.ovhcloud.com" },
  { nom: "ParisTestConf", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://paristestconf.com" },
  { nom: "Polycloud", type: "conference", ville: "Montpellier", pays: "France", siteUrl: "https://polycloud.fr" },
  { nom: "PyConFR", type: "conference", ville: null, pays: "France", siteUrl: "https://www.pycon.fr" },
  { nom: "SoCraTes Rennes", type: "conference", ville: "Rennes", pays: "France", siteUrl: "https://socrates-rennes.github.io" },
  { nom: "Sud Web", type: "conference", ville: "Toulouse", pays: "France", siteUrl: "https://sudweb.fr" },
  { nom: "SymfonyLive Paris", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://live.symfony.com" },
  { nom: "Toulouse Hacking Convention", type: "conference", ville: "Toulouse", pays: "France", siteUrl: "https://thcon.party" },
  { nom: "Very Tech Trip", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://www.verytechtrip.com" },
  { nom: "WAX", type: "conference", ville: "Aix-en-Provence", pays: "France", siteUrl: "https://www.waxconf.fr" },
  { nom: "We Love Speed", type: "conference", ville: "Nantes", pays: "France", siteUrl: "https://www.welovespeed.com" },
  { nom: "Web2Day", type: "conference", ville: "Nantes", pays: "France", siteUrl: "https://www.web2day.co" },

  // ─── Conférences internationales fréquentées depuis la France ───
  // Une speakeuse toulousaine parle aussi hors de France (Aurélie Vache :
  // KubeCon, Devoxx Belgium, FOSDEM…). Sans ces entrées, tout un pan de son
  // parcours passait par la demande d'ajout, conférence par conférence.
  // Itinérantes (`ville`/`pays` à null) : elles changent de pays chaque année.
  { nom: "KubeCon + CloudNativeCon Europe", type: "conference", ville: null, pays: null, siteUrl: "https://events.linuxfoundation.org/kubecon-cloudnativecon-europe/" },
  { nom: "KubeCon + CloudNativeCon North America", type: "conference", ville: null, pays: null, siteUrl: "https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/" },
  { nom: "Cloud Native Rejekts", type: "conference", ville: null, pays: null, siteUrl: "https://cloud-native.rejekts.io" },
  { nom: "FOSDEM", type: "conference", ville: "Bruxelles", pays: "Belgique", siteUrl: "https://fosdem.org" },
  { nom: "Devoxx Belgium", type: "conference", ville: "Anvers", pays: "Belgique", siteUrl: "https://devoxx.be" },
  { nom: "Devoxx UK", type: "conference", ville: "Londres", pays: "Royaume-Uni", siteUrl: "https://www.devoxx.co.uk" },
  { nom: "Devoxx Greece", type: "conference", ville: "Athènes", pays: "Grèce", siteUrl: "https://devoxx.gr" },
  { nom: "Devoxx Morocco", type: "conference", ville: "Marrakech", pays: "Maroc", siteUrl: "https://devoxx.ma" },
  { nom: "Devoxx Poland", type: "conference", ville: "Cracovie", pays: "Pologne", siteUrl: "https://devoxx.pl" },
  { nom: "Voxxed Days Luxembourg", type: "conference", ville: "Luxembourg", pays: "Luxembourg", siteUrl: "https://luxembourg.voxxeddays.com" },
  { nom: "Voxxed Days Zurich", type: "conference", ville: "Zurich", pays: "Suisse", siteUrl: "https://voxxeddays.com/zurich" },
  { nom: "Voxxed Days Ticino", type: "conference", ville: "Lugano", pays: "Suisse", siteUrl: "https://ticino.voxxeddays.com" },
  { nom: "DevDay", type: "conference", ville: "Mons", pays: "Belgique", siteUrl: "https://www.devday.be" },
  { nom: "BaselOne", type: "conference", ville: "Bâle", pays: "Suisse", siteUrl: "https://baselone.ch" },
  { nom: "WeAreDevelopers World Congress", type: "conference", ville: "Berlin", pays: "Allemagne", siteUrl: "https://www.wearedevelopers.com/world-congress" },
  { nom: "JCON Europe", type: "conference", ville: "Cologne", pays: "Allemagne", siteUrl: "https://jcon.one" },
  { nom: "Spring I/O", type: "conference", ville: "Barcelone", pays: "Espagne", siteUrl: "https://springio.net" },
  { nom: "DevBCN", type: "conference", ville: "Barcelone", pays: "Espagne", siteUrl: "https://www.devbcn.com" },
  { nom: "Codemotion Madrid", type: "conference", ville: "Madrid", pays: "Espagne", siteUrl: "https://conferences.codemotion.com" },
  { nom: "GoLab", type: "conference", ville: "Florence", pays: "Italie", siteUrl: "https://golab.io" },
  { nom: "RustLab", type: "conference", ville: "Florence", pays: "Italie", siteUrl: "https://rustlab.it" },
  { nom: "JSNation", type: "conference", ville: "Amsterdam", pays: "Pays-Bas", siteUrl: "https://jsnation.com" },
  { nom: "J-Fall", type: "conference", ville: "Ede", pays: "Pays-Bas", siteUrl: "https://jfall.nl" },
  { nom: "JavaZone", type: "conference", ville: "Oslo", pays: "Norvège", siteUrl: "https://javazone.no" },
  { nom: "NDC Oslo", type: "conference", ville: "Oslo", pays: "Norvège", siteUrl: "https://ndcoslo.com" },
  { nom: "NDC London", type: "conference", ville: "Londres", pays: "Royaume-Uni", siteUrl: "https://ndclondon.com" },
  { nom: "QCon London", type: "conference", ville: "Londres", pays: "Royaume-Uni", siteUrl: "https://qconlondon.com" },
  { nom: "State of Open Con", type: "conference", ville: "Londres", pays: "Royaume-Uni", siteUrl: "https://stateofopencon.com" },
  { nom: "Jfokus", type: "conference", ville: "Stockholm", pays: "Suède", siteUrl: "https://www.jfokus.se" },
  { nom: "JNation", type: "conference", ville: "Coimbra", pays: "Portugal", siteUrl: "https://jnation.pt" },
  { nom: "DevOpsDays Genève", type: "conference", ville: "Genève", pays: "Suisse", siteUrl: "https://devopsdays.org/events/2024-geneva/welcome/" },

  // ─── Relevé sur le portfolio public d'Aurélie Vache (noti.st/aurelievache) ───
  // Fourni par l'association sous forme d'export de sa page publique. Ce sont
  // les conférences où elle est intervenue et qui manquaient encore : sans
  // elles, la speakeuse la plus active de la communauté passait par une demande
  // d'ajout pour une bonne part de son parcours. Les rendez-vous internes
  // (Cloudbees), les podcasts (The Landscape) et les journées co-localisées
  // d'une conférence déjà listée n'ont pas leur place dans un répertoire de
  // conférences : ils restent hors seed.
  { nom: "KCD France", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://www.kcdfrance.fr" },
  { nom: "KCD Helsinki", type: "conference", ville: "Helsinki", pays: "Finlande", siteUrl: "https://kcdhelsinki.fi" },
  { nom: "KCD Porto", type: "conference", ville: "Porto", pays: "Portugal", siteUrl: "https://kcdporto.org" },
  { nom: "KCD Suisse Romande", type: "conference", ville: "Lausanne", pays: "Suisse", siteUrl: "https://kcdsuisseromande.ch" },
  { nom: "Cloud Native Days France", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://cloudnativedays.fr" },
  { nom: "ConFoo", type: "conference", ville: "Montréal", pays: "Canada", siteUrl: "https://confoo.ca" },
  { nom: "Agile Tour Québec", type: "conference", ville: "Québec", pays: "Canada", siteUrl: "https://agiletourquebec.ca" },
  { nom: "Cloud Native Montpellier", type: "asso", ville: "Montpellier", pays: "France", siteUrl: null },
  { nom: "Cloud Native Aix-Marseille", type: "asso", ville: "Marseille", pays: "France", siteUrl: null },
  { nom: "JUG Marseille", type: "asso", ville: "Marseille", pays: "France", siteUrl: null },

  // ─── Conférences product / UX (France) ───
  { nom: "La Product Conf", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://www.laproductconf.com" },
  // « UX Days » (uxdays.eu), la conférence UX de l'association Flupa : une seule
  // entrée (ne pas re-scinder en « Flupa UX Days » + « UX Days », même événement).
  { nom: "UX Days", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://www.uxdays.eu" },
  { nom: "Future Product Days", type: "conference", ville: "Paris", pays: "France", siteUrl: "https://www.futureproductdays.com" },
  { nom: "School of Product", type: "conference", ville: "Paris", pays: "France", siteUrl: null },

  // ─── Assos / communautés toulousaines (le reste arrive par la sync Tech Hub) ───
  { nom: "Tech Speak'Her", type: "asso", ville: "Toulouse", pays: "France", siteUrl: "https://techspeakher.fr" },
  { nom: "GDG Toulouse", type: "asso", ville: "Toulouse", pays: "France", siteUrl: "https://www.meetup.com/gdg-toulouse/" },
  { nom: "JS&Co", type: "asso", ville: "Toulouse", pays: "France", siteUrl: "https://jsandco.org" },
  { nom: "Agile Toulouse", type: "asso", ville: "Toulouse", pays: "France", siteUrl: "https://www.meetup.com/agile-toulouse/" },
  { nom: "AFUP Toulouse", type: "asso", ville: "Toulouse", pays: "France", siteUrl: "https://afup.org" },
  { nom: "Toulouse Data Science", type: "asso", ville: "Toulouse", pays: "France", siteUrl: null },
  { nom: "FrenchProduit SudOuest", type: "asso", ville: "Toulouse", pays: "France", siteUrl: null },
  { nom: "IA Innovateur", type: "asso", ville: "Toulouse", pays: "France", siteUrl: null },
  { nom: "Python Toulouse", type: "asso", ville: "Toulouse", pays: "France", siteUrl: null },
];
