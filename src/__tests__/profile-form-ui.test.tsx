import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SECTEURS, SUJETS } from "@/data/domaines";
import { BIO_MAX } from "@/lib/profile-limits";
import { ETAPES } from "@/app/mon-espace/profil-etapes";

// On isole le formulaire de l'action serveur (qui touche Auth.js/BDD).
vi.mock("@/app/mon-espace/actions", () => ({
  saveProfile: vi.fn(),
  reprendrePhotoLinkedInAction: vi.fn(),
  reconnecterLinkedInAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  // `ChampPhoto` lit la route courante (retour après un passage par LinkedIn).
  usePathname: () => "/mon-espace/fiche",
}));

import ProfileForm from "@/app/mon-espace/ProfileForm";
import { makeProfile } from "./test-helpers";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProfileForm (assistant)", () => {
  it("guide en étapes : Profil → Secteurs → Sujets → Localisation → Contact → Attestation", async () => {
    const u = userEvent.setup();
    render(<ProfileForm initial={null} />);

    // Étape 1 : profil
    expect(screen.getByLabelText(/titre de profil/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bio/i)).toBeInTheDocument();
    const suivant = screen.getByRole("button", { name: /suivant/i });
    expect(suivant).toBeInTheDocument();

    // Étape 2 : secteurs SEULS. Les deux listes empilées (15 + 11 cases, une par
    // ligne sur mobile) faisaient ~1400 px : la seconde légende tombait sous la
    // flottaison, sans rien pour signaler qu'elle existait.
    await u.click(suivant);
    expect(screen.getByRole("checkbox", { name: SECTEURS[0] })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: SUJETS[0] })).toBeNull();

    // Étape 3 : sujets SEULS
    await u.click(screen.getByRole("button", { name: /suivant/i }));
    expect(screen.getByRole("checkbox", { name: SUJETS[0] })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: SECTEURS[0] })).toBeNull();

    // Étape 4 : localisation
    await u.click(screen.getByRole("button", { name: /suivant/i }));
    expect(screen.getByLabelText(/ville/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Français" })).toBeInTheDocument();

    // Étape 5 : contact
    await u.click(screen.getByRole("button", { name: /suivant/i }));
    expect(screen.getByLabelText("LinkedIn")).toBeInTheDocument();
    // Consentement moissonneur : présent, coché par défaut, avec le bon name
    // (contrat avec parseProfileForm — une typo casserait le consentement).
    const consent = screen.getByRole("checkbox", {
      name: /propose-moi les talks trouvés/i,
    }) as HTMLInputElement;
    expect(consent.checked).toBe(true);
    expect(consent.name).toBe("cfpSuggestionsOk");

    // Étape 6 : attestation + bouton final
    await u.click(screen.getByRole("button", { name: /suivant/i }));
    expect(
      screen.getByRole("checkbox", {
        name: /j'atteste être une femme ou une personne non binaire/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enregistrer/i })).toBeInTheDocument();
  });

  it("chaque changement d'étape remonte en haut du formulaire (Suivant ET Précédent)", async () => {
    // jsdom n'implémente pas scrollIntoView : on l'espionne sur le prototype.
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const u = userEvent.setup();
    render(<ProfileForm initial={null} />);
    await u.click(screen.getByRole("button", { name: /suivant/i }));
    expect(scroll).toHaveBeenCalledTimes(1);
    await u.click(screen.getByRole("button", { name: /précédent/i }));
    expect(scroll).toHaveBeenCalledTimes(2);
  });

  it("« Toute la France » coche les 13 régions et son décochage RESTAURE la sélection", async () => {
    const u = userEvent.setup();
    render(<ProfileForm initial={null} />);
    // → étape Localisation (Profil → Secteurs → Sujets → Localisation)
    for (let i = 0; i < 3; i++) {
      await u.click(screen.getByRole("button", { name: /suivant/i }));
    }

    const toute = screen.getByRole("checkbox", { name: /toute la france/i }) as HTMLInputElement;
    const occitanie = screen.getByRole("checkbox", { name: "Occitanie" }) as HTMLInputElement;
    const bretagne = screen.getByRole("checkbox", { name: "Bretagne" }) as HTMLInputElement;

    // Sélection manuelle préalable, puis raccourci.
    await u.click(occitanie);
    await u.click(toute);
    expect(bretagne.checked).toBe(true); // tout coché

    // Décocher le raccourci restaure la sélection d'avant (Occitanie seule).
    await u.click(toute);
    expect(occitanie.checked).toBe(true);
    expect(bretagne.checked).toBe(false);

    // Décocher une région retire le raccourci ; cocher la 13e le ré-active.
    await u.click(toute); // re-coche tout
    await u.click(occitanie); // 12/13
    expect(toute.checked).toBe(false);
    await u.click(occitanie); // 13/13 → raccourci auto
    expect(toute.checked).toBe(true);
  });

  it("préremplit les champs depuis le profil existant", async () => {
    const u = userEvent.setup();
    render(
      <ProfileForm
        initial={makeProfile({
          titreProfil: "Spécialiste IA",
          poste: "Dev",
          entreprise: "OVH",
          bio: "Ma bio",
          linkedin: "https://lk/moi",
          secteurs: [SECTEURS[0]],
          sujets: [SUJETS[0]],
        })}
      />,
    );
    expect(screen.getByLabelText(/titre de profil/i)).toHaveValue("Spécialiste IA");
    expect(screen.getByLabelText(/bio/i)).toHaveValue("Ma bio");
    await u.click(screen.getByRole("button", { name: /suivant/i }));
    expect(screen.getByRole("checkbox", { name: SECTEURS[0] })).toBeChecked();
    await u.click(screen.getByRole("button", { name: /suivant/i }));
    expect(screen.getByRole("checkbox", { name: SUJETS[0] })).toBeChecked();
  });
});

describe("ProfileForm — enregistrement", () => {
  it("modification : « Enregistrer » est dispo dès la 1ʳᵉ étape (sans re-parcourir l'assistant)", async () => {
    const u = userEvent.setup();
    const { saveProfile } = await import("@/app/mon-espace/actions");
    vi.mocked(saveProfile).mockResolvedValue({ ok: true });
    render(
      <ProfileForm
        initial={makeProfile({ titreProfil: "Ingé", bio: "Bio" })}
        nom="Marie Curie"
      />,
    );
    // Étape 1 : le bouton d'enregistrement est déjà présent.
    const save = screen.getByRole("button", { name: /enregistrer/i });
    expect(save).toBeInTheDocument();
    await u.click(save);
    expect(saveProfile).toHaveBeenCalled();
  });

  it("création : le bouton d'enregistrement n'apparaît qu'à la dernière étape", () => {
    render(<ProfileForm initial={null} />);
    // Étape 1 (création) : « Suivant » mais pas encore « Enregistrer ».
    expect(screen.getByRole("button", { name: /suivant/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enregistrer/i })).toBeNull();
  });

  it("création : parcourir jusqu'à la dernière étape n'enregistre PAS tant qu'on n'a pas cliqué « Enregistrer »", async () => {
    const u = userEvent.setup();
    const { saveProfile } = await import("@/app/mon-espace/actions");
    vi.mocked(saveProfile).mockResolvedValue({ ok: true });
    render(<ProfileForm initial={null} />);
    for (let i = 0; i < ETAPES.length - 1; i++) {
      await u.click(screen.getByRole("button", { name: /suivant/i }));
    }
    // Arrivée sur la dernière étape : aucune soumission déclenchée par la
    // navigation (régression : le bouton basculait button→submit en plein clic).
    expect(saveProfile).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /enregistrer/i })).toBeInTheDocument();
  });
});

describe("ProfileForm — barre de navigation lisible sur mobile", () => {
  it("sur mobile : Précédent/Suivant restent une paire, seul le CTA Enregistrer passe pleine largeur, compteur en tête", async () => {
    const u = userEvent.setup();
    // Édition, étape 2 : « ← Précédent », « Suivant » ET « Enregistrer »
    // coexistent — c'est le cas du footer « en escalier » signalé (boutons qui
    // se tassent, compteur collé en bas à droite).
    render(
      <ProfileForm
        initial={makeProfile({ titreProfil: "Ingé", bio: "Bio" })}
        nom="Marie Curie"
      />,
    );
    await u.click(screen.getByRole("button", { name: /suivant/i }));

    // Seul le CTA principal descend pleine largeur sur mobile, sous la nav, et
    // retrouve sa largeur naturelle dès le breakpoint sm.
    const enregistrer = screen.getByRole("button", { name: /enregistrer/i });
    expect(enregistrer).toHaveClass("w-full");
    expect(enregistrer).toHaveClass("sm:w-auto");

    // La navigation reste une paire horizontale (largeur naturelle, jamais
    // pleine largeur) : on n'empile pas un « ← Précédent » qui prend toute la barre.
    for (const nom of [/précédent/i, /suivant/i]) {
      expect(screen.getByRole("button", { name: nom })).not.toHaveClass("w-full");
    }

    // Le compteur d'étape n'est plus poussé en bas à droite via ml-auto : il
    // passe en tête sur sa propre ligne (mobile), et ne repart à droite qu'en sm.
    const compteur = screen.getByText(/étape 2 sur 6/i);
    expect(compteur).toHaveClass("order-first");
    expect(compteur).toHaveClass("sm:ml-auto");
  });
});

describe("ProfileForm — lisibilité des champs (audit UX/UI)", () => {
  it("les champs portent le contour calibré `field-border` (jamais navy-lighter à 1,26:1)", async () => {
    const u = userEvent.setup();
    render(<ProfileForm initial={makeProfile()} nom="Marie Curie" />);

    const champsEtape1 = [
      screen.getByLabelText(/prénom et nom/i),
      screen.getByLabelText(/adresse de ta fiche/i),
      screen.getByLabelText(/titre de profil/i),
      screen.getByLabelText(/poste actuel/i),
      screen.getByLabelText(/entreprise actuelle/i),
      screen.getByLabelText(/^bio$/i),
    ];
    for (const champ of champsEtape1) {
      expect(champ.className, champ.getAttribute("name") ?? "").toContain(
        "border-field-border",
      );
      expect(champ.className).not.toContain("border-navy-lighter");
    }

    // Cases à cocher : la carte cliquable est un contrôle, son contour compte aussi.
    await u.click(screen.getByRole("button", { name: /suivant/i }));
    const carte = screen.getByRole("checkbox", { name: SECTEURS[0] }).closest("label");
    expect(carte?.className).toContain("border-field-border");
    expect(carte?.className).not.toContain("border-navy-lighter");

    // Étape Localisation : le champ Ville reçoit la même classe partagée.
    for (let i = 0; i < 2; i++) {
      await u.click(screen.getByRole("button", { name: /suivant/i }));
    }
    expect(screen.getByLabelText(/^ville/i).className).toContain("border-field-border");
  });

  it("aucun contour `navy-lighter` ne subsiste dans le formulaire", () => {
    const { container } = render(
      <ProfileForm initial={makeProfile()} nom="Marie Curie" />,
    );
    expect(container.querySelectorAll("[class*=border-navy-lighter]")).toHaveLength(0);
  });
});

describe("ProfileForm — aides à la saisie utiles seulement", () => {
  it("modification : pas de paragraphe méta sur le moment de l'enregistrement", () => {
    render(<ProfileForm initial={makeProfile()} nom="Marie Curie" />);
    expect(screen.queryByText(/depuis n'importe quelle étape/i)).toBeNull();
  });

  it("« Prénom et nom » se passe de son indice (la page dit déjà où vont ces infos)", () => {
    render(<ProfileForm initial={makeProfile()} nom="Marie Curie" />);
    expect(screen.queryByText(/c'est le nom affiché sur ta fiche/i)).toBeNull();
  });

  it("un seul champ est obligatoire : il est marqué, les autres se passent de « (optionnel) »", () => {
    render(<ProfileForm initial={makeProfile()} nom="Marie Curie" />);
    expect(screen.getByLabelText(/prénom et nom/i)).toBeRequired();
    expect(screen.getByText(/\(obligatoire\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/\(optionnel\)/i)).toBeNull();
  });

  it("les libellés de taxonomies se passent d'indices tautologiques et de jargon « filtres »", async () => {
    const u = userEvent.setup();
    render(<ProfileForm initial={makeProfile()} nom="Marie Curie" />);
    for (let i = 0; i < 2; i++) {
      await u.click(screen.getByRole("button", { name: /suivant/i }));
      expect(screen.queryByText(/pour les filtres/i)).toBeNull();
    }
    await u.click(screen.getByRole("button", { name: /suivant/i }));
    expect(screen.queryByText(/langues dans lesquelles tu peux parler/i)).toBeNull();
  });

  it("wording à la forme positive : aucun « ne … pas » ni « ne … plus » (principes §5)", () => {
    const { container } = render(
      <ProfileForm initial={makeProfile()} nom="Marie Curie" />,
    );
    const texte = container.textContent ?? "";
    expect(texte).not.toMatch(/n['e]\s?\w*\s+(pas|plus)\b/i);
  });
});

describe("ProfileForm — la bio, champ principal de la fiche", () => {
  it("montre au moins 6 lignes et compte les caractères en direct", async () => {
    const u = userEvent.setup();
    render(<ProfileForm initial={null} />);
    const bio = screen.getByLabelText(/^bio$/i) as HTMLTextAreaElement;
    expect(Number(bio.getAttribute("rows"))).toBeGreaterThanOrEqual(6);
    expect(bio.maxLength).toBe(BIO_MAX);

    expect(screen.getByText(`0 / ${BIO_MAX} caractères`)).toBeInTheDocument();
    await u.type(bio, "Bonjour");
    expect(screen.getByText(`7 / ${BIO_MAX} caractères`)).toBeInTheDocument();
  });
});

describe("ProfileForm — confirmation à côté du bouton", () => {
  it("l'enregistrement se confirme dans la barre d'actions (pas en haut, hors écran)", async () => {
    const u = userEvent.setup();
    const { saveProfile } = await import("@/app/mon-espace/actions");
    vi.mocked(saveProfile).mockResolvedValue({ ok: true });
    render(<ProfileForm initial={makeProfile()} nom="Marie Curie" />);

    const bouton = screen.getByRole("button", { name: /enregistrer/i });
    await u.click(bouton);

    const confirmation = await screen.findByText(/profil enregistré/i);
    // Même conteneur que le CTA : la confirmation est lue là où on vient d'agir.
    expect(bouton.closest("div")).toContainElement(confirmation);
    // Statut confirmé en toutes lettres, sans glyphe fin (illisible dehors, §9).
    expect(confirmation.textContent).not.toContain("✓");
  });
});

describe("ProfileForm — nom du compte et erreurs visibles", () => {
  it("étape 1 : champ « Prénom et nom » prérempli (cohorte lien-magique sans nom OAuth)", () => {
    render(<ProfileForm initial={null} nom="Rachel Dubois" />);
    const champ = screen.getByLabelText(/prénom et nom/i) as HTMLInputElement;
    expect(champ.value).toBe("Rachel Dubois");
    expect(champ).toBeRequired();
  });

  it("une erreur serveur RAMÈNE à l'étape fautive avec un récapitulatif", async () => {
    const u = userEvent.setup();
    const { saveProfile } = await import("@/app/mon-espace/actions");
    vi.mocked(saveProfile).mockResolvedValue({
      ok: false,
      errors: { linkedin: "Ce lien LinkedIn n'a pas l'air valide." },
    });
    render(<ProfileForm initial={makeProfile()} nom="Marie Curie" />);

    // Aller à la dernière étape et soumettre.
    for (let i = 0; i < ETAPES.length - 1; i++) {
      await u.click(screen.getByRole("button", { name: /suivant/i }));
    }
    await u.click(screen.getByRole("button", { name: /enregistrer/i }));

    // Récapitulatif visible + retour sur l'étape Contact (le champ fautif est affiché).
    expect(await screen.findByText(/certains champs sont à corriger/i)).toBeInTheDocument();
    expect(screen.getByText(/ce lien linkedin n'a pas l'air valide\./i)).toBeVisible();
    expect(screen.getByLabelText("LinkedIn")).toBeVisible();
  });
});

/**
 * Échec silencieux à l'enregistrement : « Prénom et nom » est `required` mais vit
 * à l'étape 1. Depuis une autre étape, celle-ci est `hidden` — le navigateur
 * refuse alors la soumission SANS pouvoir afficher son message (il ne peut pas
 * donner le focus à un champ caché). Le bouton ne produisait donc rien du tout.
 */
describe("ProfileForm — un enregistrement refusé se voit", () => {
  /** Parcourt l'assistant jusqu'à la dernière étape. */
  async function jusquALaFin(u: ReturnType<typeof userEvent.setup>) {
    for (let i = 0; i < ETAPES.length - 1; i++) {
      await u.click(screen.getByRole("button", { name: /suivant/i }));
    }
  }

  it("nom vide depuis la dernière étape : ramène à l'étape du champ, avec un message", async () => {
    const u = userEvent.setup();
    const { saveProfile } = await import("@/app/mon-espace/actions");
    vi.mocked(saveProfile).mockResolvedValue({ ok: true });
    render(<ProfileForm initial={makeProfile()} nom="" />);

    await jusquALaFin(u);
    expect(screen.getByText(/étape 6 sur 6/i)).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: /enregistrer/i }));

    // Aucune soumission, mais surtout : on SAIT pourquoi et on est au bon endroit.
    expect(saveProfile).not.toHaveBeenCalled();
    const champ = screen.getByLabelText(/prénom et nom/i);
    expect(champ).toBeVisible();
    expect(screen.getByText(/étape 1 sur 6/i)).toBeInTheDocument();
    expect(champ).toHaveFocus();
    // Le bandeau récapitulatif s'affiche comme pour une erreur serveur : il NOMME
    // le champ et explique le saut d'étape (le chemin client faisait l'un sans
    // l'autre). Le champ porte en plus son message, lu à la prise de focus.
    const bandeau = screen.getByText(/certains champs sont à corriger/i);
    expect(bandeau.textContent).toMatch(/prénom et nom/i);
    expect(bandeau.textContent).toMatch(/étape/i);
    expect(champ).toHaveAccessibleDescription(/indique ton prénom et ton nom/i);
  });

  // Le CTA disparaissait au moment même où le message s'affichait : en création
  // il n'est rendu qu'à la dernière étape, et le refus renvoie à l'étape 1.
  it("le bouton d'enregistrement RESTE atteignable après un refus (création)", async () => {
    const u = userEvent.setup();
    render(<ProfileForm initial={null} nom="" />);
    await jusquALaFin(u);
    await u.click(screen.getByRole("button", { name: /enregistrer/i }));

    expect(screen.getByText(/étape 1 sur 6/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enregistrer/i })).toBeVisible();
  });

  it("le message part dès que le champ fautif est corrigé, et l'enregistrement passe", async () => {
    const u = userEvent.setup();
    const { saveProfile } = await import("@/app/mon-espace/actions");
    vi.mocked(saveProfile).mockResolvedValue({ ok: true });
    render(<ProfileForm initial={makeProfile()} nom="" />);

    await u.click(screen.getByRole("button", { name: /enregistrer/i }));
    expect(screen.getByText(/certains champs sont à corriger/i)).toBeInTheDocument();
    // Déjà sur la bonne étape : le champ prend le focus sans attendre.
    expect(screen.getByLabelText(/prénom et nom/i)).toHaveFocus();

    await u.type(screen.getByLabelText(/prénom et nom/i), "Ada Lovelace");
    expect(screen.queryByText(/certains champs sont à corriger/i)).toBeNull();

    await u.click(screen.getByRole("button", { name: /enregistrer/i }));
    expect(saveProfile).toHaveBeenCalled();
  });

  // Le message s'effaçait au moindre changement N'IMPORTE OÙ : cocher une case à
  // une autre étape faisait disparaître le diagnostic alors que le blocage tenait.
  it("toucher un AUTRE champ laisse le message en place", async () => {
    const u = userEvent.setup();
    render(<ProfileForm initial={makeProfile()} nom="" />);
    await u.click(screen.getByRole("button", { name: /enregistrer/i }));
    expect(screen.getByText(/certains champs sont à corriger/i)).toBeInTheDocument();

    await u.type(screen.getByLabelText(/titre de profil/i), "Spécialiste IA");
    expect(screen.getByText(/certains champs sont à corriger/i)).toBeInTheDocument();
  });
});

/**
 * Champs longs visibles en entier (constat terrain sur iPhone) : « Titre de
 * profil » se coupait à « …se r » alors que la fiche publique rend la valeur dans
 * un paragraphe, sur plusieurs lignes.
 */
describe("ProfileForm — les champs longs se lisent en entier", () => {
  it.each(["Titre de profil", "Poste actuel", "Entreprise actuelle"])(
    "%s se rend sur plusieurs lignes",
    (label) => {
      render(<ProfileForm initial={makeProfile()} nom="Marie Curie" />);
      const champ = screen.getByLabelText(label);
      expect(champ.tagName.toLowerCase()).toBe("textarea");
      // Deux lignes au repos ; au-delà, `ChampTexte` ajuste la hauteur sur le
      // contenu (script, donc valable aussi là où `field-sizing` manque).
      expect(Number(champ.getAttribute("rows"))).toBeGreaterThanOrEqual(2);
    },
  );

  it("une valeur longue reste intégralement dans le champ", () => {
    const titre = "Quand le design, le produit et l'accessibilité se rencontrent";
    render(
      <ProfileForm initial={makeProfile({ titreProfil: titre })} nom="Marie Curie" />,
    );
    expect(screen.getByLabelText(/titre de profil/i)).toHaveValue(titre);
  });

  // « Prénom et nom » et l'adresse de fiche restent d'une ligne : un nom qui passe
  // à la ligne n'a pas de sens, et le slug a déjà son aperçu complet dessous.
  it.each([
    ["Prénom et nom", /prénom et nom/i],
    ["Adresse de ta fiche", /adresse de ta fiche/i],
  ])("%s reste un champ d'une ligne", (_nom, label) => {
    render(<ProfileForm initial={makeProfile()} nom="Marie Curie" />);
    expect(screen.getByLabelText(label).tagName.toLowerCase()).toBe("input");
  });

  it("le nom porte l'autocomplétion du navigateur (WCAG 1.3.5)", () => {
    render(<ProfileForm initial={makeProfile()} nom="Marie Curie" />);
    expect(screen.getByLabelText(/prénom et nom/i)).toHaveAttribute(
      "autocomplete",
      "name",
    );
  });
});

