import { describe, it, expect } from "vitest";
import {
  adresseCanonique,
  lireFiltres,
  filtrerScenes,
  facettesAgenda,
  libellesActifs,
  phraseFiltre,
  filtresActifs,
  type FiltresAgenda,
} from "@/lib/agenda-filtres";
import type { ScenePublique } from "@/lib/agenda-public";

/**
 * L'ENTRÉE DE L'AGENDA — recherche et facettes (lot 1 de
 * `docs/audit-ux-agenda-2026-08.md`).
 *
 * Quatre décisions produit du 17/08 se jugent ici, et chacune a son test :
 *   • ville ET région, cherchables INDÉPENDAMMENT (§8) ;
 *   • une date EN LIGNE apparaît dans « À distance » ET dans tous les filtres
 *     géographiques — une visio depuis Toulouse est joignable depuis Toulouse ;
 *   • aucune facette « intervenante », mais un nom reste CHERCHABLE ;
 *   • la facette « conférence » se bâtit sur le REGISTRE, jamais sur le libellé
 *     figé (§4.1 : « DevFest » et « DevFest Toulouse », le même jour, en prod).
 *
 * Et un invariant qui n'est pas cosmétique : **le décompte annoncé par une
 * facette est ce que le filtre rend**. Une facette qui promet 7 et en rend 5
 * fait cliquer dans le vide, ce qui est exactement le défaut que le lot corrige.
 */

const base: ScenePublique = {
  occurrenceId: 1,
  date: "2026-11-19",
  conference: "DevFest Toulouse",
  conferenceCle: "devfest-toulouse",
  conferenceLibelle: "DevFest Toulouse",
  ville: "Toulouse",
  region: "Occitanie",
  pays: "France",
  lienConf: null,
  talkTitre: "Accessibilité sans excuse",
  talkType: "Conférence",
  speakeuseNom: "Léa Dubois",
  speakeuseHref: "/speakeuses/lea-dubois",
  profileId: 5,
  image: null,
};

const scene = (o: Partial<ScenePublique>): ScenePublique => ({ ...base, ...o });

/** Une intervention SANS lieu : la règle « en ligne » se joue sur elle. */
const enLigne = scene({
  occurrenceId: 9,
  ville: null,
  region: "À distance (visio)",
  pays: null,
  conference: "Meetup à distance",
  conferenceCle: "texte:meetup a distance",
  conferenceLibelle: "Meetup à distance",
  talkTitre: "Observer une file d'attente",
  speakeuseNom: "Nadia Cherif",
});

const paris = scene({
  occurrenceId: 2,
  ville: "Paris",
  region: "Île-de-France",
  conference: "Devoxx France 2026",
  conferenceCle: "devoxx-france",
  conferenceLibelle: "Devoxx France",
  talkTitre: "Migrer sans réveiller personne",
  speakeuseNom: "Aïcha Benali",
});

/** Le cas de la prod : même conférence, deux libellés saisis. */
const memeConfAutreLibelle = scene({
  occurrenceId: 3,
  conference: "DevFest",
  talkTitre: "Des tableaux de bord qu'on lit vraiment",
  speakeuseNom: "Aïcha Benali",
});

const aucun: FiltresAgenda = { q: "", ville: null, region: null, conference: null };

describe("lireFiltres — ce que l'URL dit, et rien d'autre", () => {
  it("aucun paramètre : aucun filtre", () => {
    expect(lireFiltres({})).toEqual(aucun);
    expect(filtresActifs(lireFiltres({}))).toBe(false);
  });

  it("lit les quatre dimensions, et signale qu'un filtre est actif", () => {
    const f = lireFiltres({
      q: "  kube ",
      ville: "Toulouse",
      region: "Occitanie",
      conference: "devfest-toulouse",
    });
    expect(f).toEqual({
      q: "kube",
      // Valeurs CANONIQUES : le libellé saisi n'entre jamais dans un filtre
      // (§4.5 de l'audit) — sans ça, « Nîmes » et « nimes » seraient deux
      // adresses pour une seule ville.
      ville: "toulouse",
      region: "occitanie",
      conference: "devfest-toulouse",
    });
    expect(filtresActifs(f)).toBe(true);
  });

  it("ignore une recherche trop courte pour être un filtre", () => {
    // Même seuil que la loupe du site : en deçà, on ne prétend pas filtrer.
    expect(lireFiltres({ q: "k" }).q).toBe("");
    expect(filtresActifs(lireFiltres({ q: "k" }))).toBe(false);
  });

  it("un paramètre répété ne vaut que par sa première valeur", () => {
    // `?ville=toulouse&ville=paris` : deux villes n'ont aucun sens (le filtre
    // rendrait vide). On tranche, plutôt que de laisser passer un tableau.
    expect(lireFiltres({ ville: ["toulouse", "paris"] }).ville).toBe("toulouse");
    expect(lireFiltres({ q: ["kube", "istio"] }).q).toBe("kube");
  });

  it("une valeur vide vaut absence, jamais un filtre sur le vide", () => {
    expect(lireFiltres({ ville: "", region: "  ", conference: "" })).toEqual(aucun);
  });
});

describe("lireFiltres — la clé de conférence est une CLÉ, pas de la saisie", () => {
  it("une clé longue passe entière : la tronquer fabriquait une clé qui n'existe pas", () => {
    // Défaut trouvé en revue (18/08), et mesuré : un libellé libre de 77
    // caractères donne une clé de 83 (« texte: » compris). Coupée à 80,
    // l'option offerte annonçait (1), le clic rendait 0 carte, et une TROISIÈME
    // option apparaissait, étiquetée de la clé coupée. L'invariant « une
    // facette annonce ce qu'elle rend » tombait en un clic, sans URL forgée.
    const longue = `texte:${"a".repeat(120)}`;
    expect(lireFiltres({ conference: longue }).conference).toBe(longue);
  });

  it("ce qui n'a pas la forme d'une clé vaut absence", () => {
    // Sinon n'importe quel texte de 80 caractères se retrouvait dans la copie
    // de la page (« aucune intervention annoncée pour … »), sur une adresse qui
    // se partage. Les deux formes légitimes : un slug de registre, ou le repli
    // `texte:` suivi du libellé replié (donc sans capitale).
    expect(lireFiltres({ conference: "Promo mon-site.example" }).conference).toBeNull();
    expect(lireFiltres({ conference: "texte:Réunion Secrète" }).conference).toBeNull();
    expect(lireFiltres({ conference: "devfest-toulouse" }).conference).toBe(
      "devfest-toulouse",
    );
    expect(lireFiltres({ conference: "texte:nuit de l'info" }).conference).toBe(
      "texte:nuit de l'info",
    );
  });
});

describe("adresseCanonique — le lien partagé est le produit", () => {
  const ranger = (params: Record<string, string | string[] | undefined>) =>
    adresseCanonique(params, lireFiltres(params));

  it("range les champs vides que tout formulaire GET soumet", () => {
    expect(ranger({ q: "", ville: "toulouse", region: "", conference: "" })).toBe(
      "ville=toulouse",
    );
  });

  it("laisse tranquille une adresse déjà propre", () => {
    // La garde ANTI-BOUCLE : une adresse canonique ne se redirige pas.
    expect(ranger({ ville: "toulouse" })).toBeNull();
    expect(ranger({})).toBeNull();
    expect(ranger({ q: "kube", ville: "toulouse" })).toBeNull();
  });

  it("est IDEMPOTENTE : rediriger deux fois donne la même adresse", () => {
    // Sans cette propriété, la redirection tournerait en rond — et une page
    // d'agenda en boucle serait pire que l'adresse sale qu'on répare.
    const sale = { ville: "Nîmes", region: "", q: "k", conference: "Nope!" };
    const premiere = ranger(sale);
    expect(premiere).toBe("ville=nimes");
    const params = Object.fromEntries(new URLSearchParams(premiere!));
    expect(ranger(params)).toBeNull();
  });

  it("garde les paramètres qui ne lui appartiennent pas", () => {
    // Une campagne, un `utm_` : ce n'est pas à cette page de les jeter.
    expect(ranger({ ville: "toulouse", utm_source: "slack" })).toBeNull();
    expect(ranger({ ville: "", utm_source: "slack" })).toBe("utm_source=slack");
  });
});

describe("filtrerScenes — ce que la visiteuse obtient", () => {
  const toutes = [base, paris, memeConfAutreLibelle, enLigne];

  it("sans filtre, la vue est COMPLÈTE (un filtre n'est pas un péage)", () => {
    expect(filtrerScenes(toutes, aucun)).toHaveLength(4);
  });

  it("la ville se filtre sur sa forme canonique, accents et casse repliés", () => {
    const nimes = scene({ occurrenceId: 4, ville: "Nîmes", region: "Occitanie" });
    const trouvees = filtrerScenes([nimes, paris], lireFiltres({ ville: "nimes" }));
    expect(trouvees.map((s) => s.occurrenceId)).toEqual([4]);
  });

  it("la région filtre à l'autre échelle, sans que la ville soit en jeu", () => {
    // La question posée supposait qu'il fallait choisir ; la réponse du 17/08
    // est « les deux, indépendamment ».
    const trouvees = filtrerScenes(toutes, lireFiltres({ region: "ile-de-france" }));
    // La seule date parisienne, et la visio — joignable de partout (règle
    // éprouvée à part, plus bas).
    expect(trouvees.map((s) => s.occurrenceId)).toEqual([2, 9]);
  });

  it("la facette conférence rassemble ce que le REGISTRE rassemble", () => {
    // Les deux saisies (« DevFest Toulouse » et « DevFest ») partagent leur
    // `conferenceCle` : une facette bâtie sur le libellé figé les séparerait.
    const trouvees = filtrerScenes(toutes, lireFiltres({ conference: "devfest-toulouse" }));
    expect(trouvees.map((s) => s.occurrenceId)).toEqual([1, 3]);
  });

  it("la recherche trouve un titre, une conférence, une ville — et un NOM", () => {
    // Pas de facette « intervenante » (décision du 17/08) : l'agenda répond à
    // « quand, où, sur quoi ». Mais chercher un nom reste possible.
    const parQuoi = (q: string) =>
      filtrerScenes(toutes, lireFiltres({ q })).map((s) => s.occurrenceId);
    expect(parQuoi("migrer")).toEqual([2]);
    expect(parQuoi("devoxx")).toEqual([2]);
    expect(parQuoi("paris")).toEqual([2]);
    // Accents et casse repliés, comme partout ailleurs dans le dépôt.
    expect(parQuoi("aicha")).toEqual([2, 3]);
  });

  it("les dimensions se cumulent (ET), comme sur l'annuaire", () => {
    const trouvees = filtrerScenes(
      toutes,
      lireFiltres({ ville: "toulouse", q: "tableaux" }),
    );
    expect(trouvees.map((s) => s.occurrenceId)).toEqual([3]);
  });
});

describe("une date EN LIGNE est joignable de partout", () => {
  const toutes = [base, paris, enLigne];

  it("elle apparaît dans un filtre de VILLE", () => {
    // « Une visio depuis Toulouse est joignable depuis Toulouse : l'exclure
    // d'un filtre Toulouse cacherait une date réellement accessible »
    // (décision du 17/08).
    const ids = filtrerScenes(toutes, lireFiltres({ ville: "paris" })).map(
      (s) => s.occurrenceId,
    );
    expect(ids).toContain(9);
    expect(ids).toEqual([2, 9]);
  });

  it("elle apparaît dans un filtre de RÉGION", () => {
    const ids = filtrerScenes(toutes, lireFiltres({ region: "occitanie" })).map(
      (s) => s.occurrenceId,
    );
    expect(ids).toEqual([1, 9]);
  });

  it("« À distance » ne ramène QUE ce qui se suit à distance", () => {
    // L'autre sens de la règle : sans ce cas, « à distance » pourrait tout
    // ramener et la facette ne dirait plus rien.
    const ids = filtrerScenes(toutes, lireFiltres({ region: "a-distance-visio" })).map(
      (s) => s.occurrenceId,
    );
    expect(ids).toEqual([9]);
  });
});

describe("facettesAgenda — une facette annonce ce qu'elle rend", () => {
  const toutes = [base, paris, memeConfAutreLibelle, enLigne];

  it("une ville dit son décompte, EN LIGNE comprise", () => {
    const { villes } = facettesAgenda(toutes, aucun);
    const paris_ = villes.options.find((o) => o.valeur === "paris");
    // Une seule date à Paris, plus la visio : le filtre en rendra deux, la
    // facette doit donc annoncer deux. Sans ça elle ferait cliquer dans le vide
    // — ou pire, annoncerait moins que ce qu'elle montre.
    expect(paris_).toEqual({ valeur: "paris", libelle: "Paris", nombre: 2 });
    expect(paris_!.nombre).toBe(
      filtrerScenes(toutes, { ...aucun, ville: "paris" }).length,
    );
  });

  it("le total d'une facette est la vue SANS ce filtre", () => {
    const f = { ...aucun, ville: "paris" };
    const { villes, regions } = facettesAgenda(toutes, f);
    expect(villes.total).toBe(4);
    // La région, elle, se compte sur la vue déjà filtrée par ville.
    expect(regions.total).toBe(2);
  });

  it("chaque dimension se compte SANS elle-même, mais AVEC les autres", () => {
    const { villes } = facettesAgenda(toutes, { ...aucun, q: "tableaux" });
    // La recherche ne laisse qu'une carte toulousaine : Paris disparaît des
    // options (une facette qui ne rend rien n'a pas à être proposée), et
    // Toulouse n'annonce plus que ce qui reste.
    expect(villes.options.map((o) => o.valeur)).toEqual(["toulouse"]);
    expect(villes.options[0].nombre).toBe(1);
  });

  it("une conférence porte le nom du registre, et l'ordre est alphabétique", () => {
    const { conferences } = facettesAgenda(toutes, aucun);
    expect(conferences.options).toEqual([
      { valeur: "devfest-toulouse", libelle: "DevFest Toulouse", nombre: 2 },
      { valeur: "devoxx-france", libelle: "Devoxx France", nombre: 1 },
      { valeur: "texte:meetup a distance", libelle: "Meetup à distance", nombre: 1 },
    ]);
  });

  it("une intervention sans conférence ne fabrique aucune option", () => {
    const sansConf = scene({
      occurrenceId: 7,
      conference: null,
      conferenceCle: null,
      conferenceLibelle: null,
    });
    const { conferences } = facettesAgenda([sansConf], aucun);
    expect(conferences.options).toEqual([]);
    // Et elle reste dans la vue : une facette absente ne masque personne.
    expect(filtrerScenes([sansConf], aucun)).toHaveLength(1);
  });

  it("un filtre que la page ne porte pas garde son option, avec son vrai décompte", () => {
    // `?ville=lyon` sur un agenda sans date lyonnaise : la commande doit
    // MONTRER ce sur quoi la page a filtré. Sans cette option, l'écran
    // afficherait « Toutes les villes » au-dessus d'une page vide.
    const sansVisio = [base, paris];
    const { villes, regions } = facettesAgenda(sansVisio, {
      ...aucun,
      ville: "lyon",
      region: "corse",
    });
    // Le libellé de repli est CAPITALISÉ : un slug minuscule au milieu d'une
    // liste de noms de villes (« lyon » entre « Bordeaux » et « Toulouse ») se
    // remarquait, et la même valeur se retrouve dans une phrase française.
    expect(villes.options).toContainEqual({ valeur: "lyon", libelle: "Lyon", nombre: 0 });
    // Une région, elle, a un nom même sans date : le vocabulaire fait foi.
    expect(regions.options).toContainEqual({
      valeur: "corse",
      libelle: "Corse",
      nombre: 0,
    });
    // Et dès qu'une visio est au programme, cette même option annonce ce que
    // « ou en ligne » lui donne : une date en ligne est joignable de Lyon aussi.
    const avecVisio = facettesAgenda([...sansVisio, enLigne], { ...aucun, ville: "lyon" });
    expect(avecVisio.villes.options.find((o) => o.valeur === "lyon")?.nombre).toBe(1);
  });

  it("la PRÉSENCE d'une commande se juge sur le document, son décompte sur la vue", () => {
    // Relevé bloquant de la revue d'écran (18/08) : décidée sur la vue, la
    // commande DISPARAISSAIT dès qu'une recherche resserrait l'affichage — donc
    // « je cherche puis j'affine » devenait impossible, et le bouton qu'on
    // venait d'actionner remontait sous le doigt.
    const { villes } = facettesAgenda(toutes, lireFiltres({ q: "tableaux" }));
    expect(villes.offerte).toBe(true);
    expect(villes.options.map((o) => o.valeur)).toEqual(["toulouse"]);
    // Et une dimension que le document ne décline pas reste absente.
    const { villes: uneSeule } = facettesAgenda([base, memeConfAutreLibelle], aucun);
    expect(uneSeule.offerte).toBe(false);
  });

  it("l'option active se nomme comme le DOCUMENT la nomme", () => {
    // Cherché sur la vue déjà filtrée, un nom de ville ressortait de son SLUG
    // dès qu'un autre filtre l'en excluait — deux clics suffisaient à
    // l'obtenir. La ville d'épreuve porte un accent : le slug ne le rend pas,
    // donc seul un libellé lu dans le document peut le restituer.
    const nimes = scene({ occurrenceId: 5, ville: "Nîmes", region: "Occitanie" });
    const f = lireFiltres({ ville: "nimes", q: "migrer" });
    const { villes } = facettesAgenda([...toutes, nimes], f);
    expect(villes.options.find((o) => o.valeur === "nimes")?.libelle).toBe("Nîmes");
  });

  it("une conférence hors du document se NOMME, sa clé reste à l'intérieur", () => {
    const { conferences } = facettesAgenda(toutes, {
      ...aucun,
      conference: "texte:reunion secrete",
    });
    const active = conferences.options.find((o) => o.valeur === "texte:reunion secrete");
    expect(active?.libelle).toBe("la conférence demandée");
    // Le préfixe d'implémentation ne paraît nulle part à l'écran.
    expect(conferences.options.map((o) => o.libelle).join(" ")).not.toContain("texte:");
  });

  it("les régions gardent le vocabulaire de l'annuaire", () => {
    const { regions } = facettesAgenda(toutes, aucun);
    expect(regions.options.map((o) => o.libelle)).toEqual([
      "À distance (visio)",
      "Île-de-France",
      "Occitanie",
    ]);
    // « À distance » ne compte que les visios ; les deux autres les comptent en
    // plus des leurs, comme le filtre le fera.
    expect(regions.options.map((o) => o.nombre)).toEqual([1, 2, 3]);
  });
});

describe("phraseFiltre — le résumé NOMME le filtre actif", () => {
  const toutes = [base, paris, memeConfAutreLibelle, enLigne];
  const dire = (params: Record<string, string>, debut = "5 interventions annoncées") => {
    const f = lireFiltres(params);
    return phraseFiltre(debut, f, libellesActifs(toutes, f));
  };

  it("sans filtre, elle se contente de son fait", () => {
    expect(dire({}, "4 interventions annoncées à ce jour")).toBe(
      "4 interventions annoncées à ce jour.",
    );
  });

  it("une ville s'annonce AVEC les dates en ligne, sinon le compte contredit le filtre", () => {
    // Conséquence directe de la décision du 17/08, et elle n'est pas cosmétique.
    expect(dire({ ville: "toulouse" })).toBe(
      "5 interventions annoncées à Toulouse ou en ligne.",
    );
  });

  it("une région s'annonce à son échelle", () => {
    expect(dire({ region: "occitanie" })).toBe(
      "5 interventions annoncées en Occitanie ou en ligne.",
    );
  });

  it("les deux échelles à la fois se CUMULENT, et la phrase le dit", () => {
    // « à Toulouse, en Occitanie ou en ligne » se lisait comme trois
    // possibilités, alors que le filtre exige les deux lieux (revue d'écran du
    // 18/08). Le « ou » ne vaut que pour les visios, qui s'ajoutent.
    expect(dire({ ville: "toulouse", region: "occitanie" })).toBe(
      "5 interventions annoncées à Toulouse et en Occitanie, ou en ligne.",
    );
  });

  it("« À distance » se dit « en ligne », sans se répéter", () => {
    expect(dire({ region: "a-distance-visio" })).toBe(
      "5 interventions annoncées en ligne.",
    );
  });

  it("hors de France, la région se dit autrement", () => {
    const geneve = scene({ occurrenceId: 8, ville: "Genève", region: "International" });
    const f = lireFiltres({ region: "international" });
    expect(phraseFiltre("2 interventions annoncées", f, libellesActifs([geneve], f))).toBe(
      "2 interventions annoncées à l'international ou en ligne.",
    );
  });

  it("la conférence et la recherche se nomment aussi", () => {
    expect(dire({ conference: "devfest-toulouse", q: "kube" })).toBe(
      "5 interventions annoncées pour DevFest Toulouse, correspondant à ta recherche « kube ».",
    );
  });

  it("une ville inconnue se nomme quand même, capitale en tête", () => {
    // `?ville=zzz` rend zéro : le résumé doit dire SUR QUOI, sinon « aucune
    // intervention » ressemble à un agenda vide. Mais un slug brut au milieu
    // d'une phrase française se lit mal — capitale en tête, au minimum.
    expect(dire({ ville: "zzz" }, "Aucune intervention annoncée")).toBe(
      "Aucune intervention annoncée à Zzz ou en ligne.",
    );
  });

  it("une conférence inconnue se NOMME, elle ne se répète pas", () => {
    // La clé de conférence est la seule des trois que `slugify` ne borne pas :
    // la réafficher laisserait un lien forgé écrire dans la copie de la page.
    // On dit la dimension, pas la valeur (revue du 18/08).
    expect(dire({ conference: "texte:reunion secrete" })).toBe(
      "5 interventions annoncées pour la conférence demandée.",
    );
  });

  it("« À distance » subsume la ville : une seule commande reste vraie", () => {
    // Deux clics dans l'écran suffisaient à obtenir « Ville : Toulouse » et un
    // résumé qui dit « en ligne » — la commande contredisait la phrase.
    const f = lireFiltres({ ville: "toulouse", region: "a-distance-visio" });
    expect(f.ville).toBeNull();
    expect(phraseFiltre("1 intervention annoncée", f, libellesActifs(toutes, f))).toBe(
      "1 intervention annoncée en ligne.",
    );
  });
});
