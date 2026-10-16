import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// `ChampPhoto` lit la route courante pour savoir où revenir après un passage
// par LinkedIn : c'est elle qu'on simule, plutôt qu'un chemin passé en prop.
vi.mock("next/navigation", () => ({ usePathname: () => "/mon-espace/photo" }));
vi.mock("@/app/mon-espace/actions", () => ({
  saveProfile: vi.fn(),
  reprendrePhotoLinkedInAction: vi.fn(),
  reconnecterLinkedInAction: vi.fn(),
}));

import ChampPhoto from "@/app/mon-espace/ChampPhoto";
import { ChampsIdentite } from "@/app/mon-espace/ChampsSection";
import {
  reprendrePhotoLinkedInAction,
  reconnecterLinkedInAction,
} from "@/app/mon-espace/actions";
import { makeProfile } from "./test-helpers";

/**
 * LE champ Photo (`ChampPhoto`) : deux façons de remplir la même photo — un
 * fichier envoyé vers `/api/mon-espace/avatar`, ou la reprise de la photo
 * LinkedIn (Server Action). L'upload lui-même est couvert par media.test.ts et
 * api-media-avatar.test.ts, la reprise par linkedin-photo.test.ts ; ici on
 * vérifie le CÂBLAGE et ce que l'écran montre.
 */
afterEach(cleanup);

function fichier(name = "photo.png", type = "image/png"): File {
  return new File([new Uint8Array(10)], name, { type });
}

function mockFetchJson(body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body))),
  );
}

function rendreChamp(props: Partial<React.ComponentProps<typeof ChampPhoto>> = {}) {
  return render(
    <ChampPhoto
      nom="Léa Dubois"
      imageInitiale={null}
      linkedinLie={false}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe("ChampPhoto — envoi d'un fichier", () => {
  it("dépose le fichier choisi vers /api/mon-espace/avatar", async () => {
    mockFetchJson({ url: "https://x.example/moi.png" });
    rendreChamp();

    fireEvent.change(screen.getByLabelText("Photo"), { target: { files: [fichier()] } });

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/mon-espace/avatar");
    expect((init as RequestInit).method).toBe("POST");
    expect(((init as RequestInit).body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("affiche l'erreur renvoyée par la route", async () => {
    mockFetchJson({ error: "Format d'image non pris en charge." });
    rendreChamp();

    fireEvent.change(screen.getByLabelText("Photo"), { target: { files: [fichier()] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Format d'image non pris en charge.",
    );
  });

  it("réponse SANS JSON (413 de la plateforme) : un message, pas un écran muet", async () => {
    // Une photo de téléphone dépasse la limite de corps de requête AVANT
    // d'atteindre notre route : la réponse n'a pas de JSON à lire.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Request Entity Too Large", { status: 413 })),
    );
    rendreChamp();

    fireEvent.change(screen.getByLabelText("Photo"), { target: { files: [fichier()] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/trop lourde/i);
  });

  it("réseau coupé en cours d'envoi : un message, pas une promesse rejetée", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    rendreChamp();

    fireEvent.change(screen.getByLabelText("Photo"), { target: { files: [fichier()] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/connexion/i);
  });

  it("échec serveur qui PORTE un message : c'est celui-là qu'on lit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Trop de photos envoyées récemment." }), {
            status: 429,
          }),
      ),
    );
    rendreChamp();

    fireEvent.change(screen.getByLabelText("Photo"), { target: { files: [fichier()] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Trop de photos envoyées récemment.",
    );
  });

  it("aucun champ nommé (n'est jamais posté avec le formulaire principal)", () => {
    const { container } = rendreChamp();
    expect(screen.getByLabelText("Photo")).not.toHaveAttribute("name");
    // Confirme que l'invariant testé par champs-section-registre.test.tsx tient :
    // ce champ n'a pas de `name`, il n'entre donc dans aucun registre de section.
    expect(container.querySelector('input[type="file"][name]')).toBeNull();
  });
});

describe("ChampPhoto — reprise de la photo LinkedIn", () => {
  it("propose la reprise seulement quand LinkedIn est rattaché", () => {
    rendreChamp({ linkedinLie: false });
    expect(screen.queryByRole("button", { name: /LinkedIn/i })).toBeNull();
    cleanup();

    rendreChamp({ linkedinLie: true });
    expect(screen.getByRole("button", { name: "Reprendre ma photo LinkedIn" })).toBeTruthy();
  });

  it("succès : la photo reprise remplace l'aperçu, sans aucun départ du site", async () => {
    vi.mocked(reprendrePhotoLinkedInAction).mockResolvedValue({
      statut: "ok",
      url: "https://blob.example/avatars/moi.png",
    });
    const { container } = rendreChamp({ linkedinLie: true });

    fireEvent.click(screen.getByRole("button", { name: "Reprendre ma photo LinkedIn" }));

    expect(await screen.findByText("Photo LinkedIn reprise ✓")).toBeTruthy();
    await vi.waitFor(() =>
      expect(container.querySelector("img")?.getAttribute("src")).toBe(
        "https://blob.example/avatars/moi.png",
      ),
    );
    expect(reconnecterLinkedInAction).not.toHaveBeenCalled();
  });

  it("échec ordinaire : le message s'affiche, on reste sur place", async () => {
    vi.mocked(reprendrePhotoLinkedInAction).mockResolvedValue({
      statut: "erreur",
      message: "LinkedIn met du temps à répondre. Réessaie dans un instant.",
    });
    rendreChamp({ linkedinLie: true });

    fireEvent.click(screen.getByRole("button", { name: "Reprendre ma photo LinkedIn" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("LinkedIn met du temps");
    expect(reconnecterLinkedInAction).not.toHaveBeenCalled();
  });

  it("jeton expiré : le départ vers LinkedIn est ANNONCÉ, et attend un second clic", async () => {
    vi.mocked(reprendrePhotoLinkedInAction).mockResolvedValue({ statut: "reconnexion" });
    rendreChamp({ linkedinLie: true });

    fireEvent.click(screen.getByRole("button", { name: "Reprendre ma photo LinkedIn" }));

    // Le premier clic n'emmène nulle part : il prévient (la saisie en cours de
    // la section serait perdue par la redirection).
    const avis = await screen.findByRole("alert");
    expect(avis).toHaveTextContent(/la saisie en cours de cette page sera à retaper/);
    expect(reconnecterLinkedInAction).not.toHaveBeenCalled();

    // Le retour promis est la route COURANTE, jamais un chemin recopié à la main.
    fireEvent.click(screen.getByRole("button", { name: "Continuer vers LinkedIn" }));
    await vi.waitFor(() =>
      expect(reconnecterLinkedInAction).toHaveBeenCalledWith("/mon-espace/photo"),
    );
  });

  it("les deux boutons sont `type=button` : ils n'enregistrent jamais la section", () => {
    rendreChamp({ linkedinLie: true });
    expect(
      screen.getByRole("button", { name: "Reprendre ma photo LinkedIn" }),
    ).toHaveAttribute("type", "button");
  });
});

describe("ChampsIdentite — la photo reste indépendante du formulaire", () => {
  it("ne marque PAS le formulaire englobant comme modifié (dépôt déjà enregistré)", () => {
    mockFetchJson({ url: "https://x.example/moi.png" });
    const onFormChange = vi.fn();
    // Reproduit le `<form onChange={...}>` de ProfileForm/SectionForm : sans
    // stopPropagation, le `change` du fichier remonterait ici et armerait à
    // tort la garde « Quitter sans enregistrer ? ».
    render(
      <form onChange={onFormChange}>
        <ChampsIdentite initial={makeProfile()} nom="Léa Dubois" erreurs={undefined} />
      </form>,
    );

    fireEvent.change(screen.getByLabelText("Photo"), { target: { files: [fichier()] } });
    expect(onFormChange).not.toHaveBeenCalled();

    // Un AUTRE champ de la même fiche continue de remonter normalement.
    fireEvent.change(screen.getByLabelText(/Prénom et nom/), {
      target: { value: "Nouveau nom" },
    });
    expect(onFormChange).toHaveBeenCalledTimes(1);
  });
});
