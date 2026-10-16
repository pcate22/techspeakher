import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";

/**
 * Éditeur de contenus — image (lot 6, upload Vercel Blob). L'upload lui-même
 * (validation MIME/taille, signature binaire) est couvert par `media.test.ts`
 * et la garde `requireOrgaId` par `api-media-contenu-image.test.ts` (route
 * API, pas une Server Action) ; ici on vérifie le câblage UI : choisir un
 * fichier appelle la route, son résultat pilote l'aperçu/l'alt/l'erreur, et
 * le retrait est réversible.
 */
vi.mock("@/app/admin/contenus/actions", () => ({
  updateContenuAction: vi.fn(async () => ({ status: "idle" })),
}));

import Editeur from "@/app/admin/contenus/[type]/[slug]/Editeur";
import type { Contenu } from "@/lib/contenus";

afterEach(cleanup);

function contenu(over: Partial<Contenu> = {}): Contenu {
  return {
    id: 1,
    type: "publication",
    slug: "mon-article",
    titre: "Mon article",
    chapo: "",
    corps: "",
    imageUrl: null,
    imageAlt: null,
    imageWidth: null,
    imageHeight: null,
    videoUrl: null,
    categorie: "Behind the Scenes",
    tag: "Passé",
    lien: null,
    lienExterne: null,
    lienLabel: null,
    statut: "brouillon",
    publieLe: null,
    majLe: "2026-06-01T00:00:00Z",
    auFlux: true,
    conferenceEditionId: null,
    auteurNom: null,
    auteurUserId: null,
    auteurImage: null,
    relectureMotif: null,
    ...over,
  };
}

function fichier(name = "photo.png", type = "image/png"): File {
  return new File([new Uint8Array(10)], name, { type });
}

function mockFetchJson(body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body))),
  );
}

beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
afterEach(() => vi.unstubAllGlobals());

describe("Éditeur — image (lot 6)", () => {
  it("dépose le fichier choisi et affiche l'aperçu + le champ alt au succès", async () => {
    mockFetchJson({ url: "https://x.example/photo.png" });
    render(<Editeur contenu={contenu()} editions={[]} mentions={[]} />);

    const input = screen.getByLabelText(/Choisir une photo|Remplacer la photo/) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [fichier()] } });

    expect(await screen.findByLabelText("Texte alternatif")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/admin/contenus/image");
    expect((init as RequestInit).method).toBe("POST");
    const fd = (init as RequestInit).body as FormData;
    expect(fd.get("file")).toBeInstanceOf(File);
  });

  it("affiche l'erreur renvoyée par la route, sans champ alt", async () => {
    mockFetchJson({ error: "Format d'image non pris en charge." });
    render(<Editeur contenu={contenu()} editions={[]} mentions={[]} />);

    const input = screen.getByLabelText(/Choisir une photo|Remplacer la photo/) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [fichier()] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Format d'image non pris en charge.",
    );
    expect(screen.queryByLabelText("Texte alternatif")).toBeNull();
  });

  it("« Retirer l'image » efface l'aperçu et le champ alt", async () => {
    mockFetchJson({ url: "https://x.example/photo.png" });
    render(<Editeur contenu={contenu()} editions={[]} mentions={[]} />);
    const input = screen.getByLabelText(/Choisir une photo|Remplacer la photo/) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [fichier()] } });
    await screen.findByLabelText("Texte alternatif");

    fireEvent.click(screen.getByRole("button", { name: "Retirer l'image" }));
    expect(screen.queryByLabelText("Texte alternatif")).toBeNull();
  });

  it("un retrait pendant le remplacement de l'image n'est pas écrasé par la réponse tardive", async () => {
    let resoudre!: (r: Response) => void;
    const enVol = new Promise<Response>((resolve) => {
      resoudre = resolve;
    });
    vi.stubGlobal("fetch", vi.fn(() => enVol));

    render(
      <Editeur
        contenu={contenu({ imageUrl: "https://x.example/ancienne.png", imageAlt: "Ancienne" })}
        editions={[]}
        mentions={[]}
      />,
    );

    // Choisit un fichier de remplacement (upload en attente) puis retire AVANT
    // que la réponse n'arrive.
    const input = screen.getByLabelText(/Choisir une photo|Remplacer la photo/) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [fichier("nouvelle.png")] } });
    fireEvent.click(screen.getByRole("button", { name: "Retirer l'image" }));
    expect(screen.queryByLabelText("Texte alternatif")).toBeNull();

    // La réponse tardive arrive : elle ne doit PAS restaurer l'image retirée.
    await act(async () => {
      resoudre(new Response(JSON.stringify({ url: "https://x.example/nouvelle.png" })));
      await enVol;
    });
    expect(screen.queryByLabelText("Texte alternatif")).toBeNull();
  });

  it("pré-remplit l'aperçu et l'alt depuis un contenu déjà illustré", () => {
    render(
      <Editeur
        contenu={contenu({ imageUrl: "https://x.example/deja.png", imageAlt: "Déjà là" })}
        editions={[]}
        mentions={[]}
      />,
    );
    expect(screen.getByLabelText("Texte alternatif")).toHaveValue("Déjà là");
  });

  it("l'aperçu s'ouvre en grand dans un nouvel onglet (vérifier la bonne photo)", () => {
    render(
      <Editeur
        contenu={contenu({ imageUrl: "https://x.example/deja.png", imageAlt: "Déjà là" })}
        editions={[]}
        mentions={[]}
      />,
    );
    const lien = screen.getByRole("link", { name: /voir.*grand/i });
    expect(lien).toHaveAttribute("href", "https://x.example/deja.png");
    expect(lien).toHaveAttribute("target", "_blank");
    expect(lien.querySelector("img")).not.toBeNull();
  });

  it("l'aperçu montre la photo entière, assez grande pour la reconnaître", () => {
    // Retour de Cateline : 80 px recadrés en carré ne permettent pas de
    // reconnaître le visuel. La vignette suit la forme de l'image.
    render(
      <Editeur
        contenu={contenu({ imageUrl: "https://x.example/deja.png", imageAlt: "Déjà là" })}
        editions={[]}
        mentions={[]}
      />,
    );
    const apercu = screen.getByRole("link", { name: /voir.*grand/i }).querySelector("img")!;
    expect(apercu.className).toContain("h-auto");
    expect(apercu.className).not.toContain("object-cover");
  });

  it("mesure la photo choisie et la joint au formulaire (place réservée à l'affichage)", async () => {
    // Mesure dans le NAVIGATEUR : c'est là que vit un décodeur pour les quatre
    // formats acceptés. jsdom n'en a pas, d'où le doublon de `createImageBitmap`.
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 1080, height: 1350, close: vi.fn() })),
    );
    mockFetchJson({ url: "https://x.example/photo.png" });
    const { container } = render(<Editeur contenu={contenu()} editions={[]} mentions={[]} />);

    fireEvent.change(screen.getByLabelText("Choisir une photo"), {
      target: { files: [fichier()] },
    });
    await screen.findByLabelText("Texte alternatif");

    expect(container.querySelector<HTMLInputElement>('input[name="imageWidth"]')?.value).toBe("1080");
    expect(container.querySelector<HTMLInputElement>('input[name="imageHeight"]')?.value).toBe("1350");
    // Rotation EXIF prise en compte : une photo de téléphone est stockée à
    // l'endroit du capteur (4032×3024) et affichée tournée (3024×4032). Sans
    // cette option, on enregistrerait la taille de l'une pour l'autre.
    expect(createImageBitmap).toHaveBeenCalledWith(expect.any(File), {
      imageOrientation: "from-image",
    });
  });

  it("dépose la photo même si la mesure échoue (taille simplement inconnue)", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("décodage impossible");
      }),
    );
    mockFetchJson({ url: "https://x.example/photo.png" });
    const { container } = render(<Editeur contenu={contenu()} editions={[]} mentions={[]} />);

    fireEvent.change(screen.getByLabelText("Choisir une photo"), {
      target: { files: [fichier()] },
    });
    await screen.findByLabelText("Texte alternatif");

    expect(container.querySelector<HTMLInputElement>('input[name="imageUrl"]')?.value).toBe(
      "https://x.example/photo.png",
    );
    expect(container.querySelector<HTMLInputElement>('input[name="imageWidth"]')?.value).toBe("");
  });

  it("« Retirer l'image » emporte aussi sa taille", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 1080, height: 1350, close: vi.fn() })),
    );
    mockFetchJson({ url: "https://x.example/photo.png" });
    const { container } = render(<Editeur contenu={contenu()} editions={[]} mentions={[]} />);
    fireEvent.change(screen.getByLabelText("Choisir une photo"), {
      target: { files: [fichier()] },
    });
    await screen.findByLabelText("Texte alternatif");

    fireEvent.click(screen.getByRole("button", { name: "Retirer l'image" }));
    expect(container.querySelector<HTMLInputElement>('input[name="imageWidth"]')?.value).toBe("");
    expect(container.querySelector<HTMLInputElement>('input[name="imageHeight"]')?.value).toBe("");
  });

  it("vide le champ après lecture, pour que rechoisir LE MÊME fichier relance un envoi", async () => {
    // Sans ça, le champ garde la valeur du fichier refusé, et un navigateur
    // n'émet AUCUN `change` quand on resélectionne le même fichier : le
    // réessai semble mort.
    //
    // jsdom ne simule pas ce comportement (`.value` d'un champ fichier y est
    // toujours "" et `fireEvent.change` déclenche quoi qu'il arrive) : on
    // remplace donc l'accesseur natif par une propriété simple pour observer
    // ce que le gestionnaire écrit vraiment.
    mockFetchJson({ error: "Format de fichier non reconnu." });
    render(<Editeur contenu={contenu()} editions={[]} mentions={[]} />);
    const input = screen.getByLabelText("Choisir une photo") as HTMLInputElement;
    Object.defineProperty(input, "value", {
      writable: true,
      configurable: true,
      value: "C:\\fakepath\\photo.png",
    });

    fireEvent.change(input, { target: { files: [fichier()] } });
    expect(input.value).toBe("");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("le bouton de choix de fichier dit s'il y a déjà une photo ou non", () => {
    // Retour de Cateline : le champ natif affiche « aucun fichier
    // sélectionné » même quand l'article EST illustré — on remplace donc le
    // libellé natif par un intitulé qui dit l'état réel.
    render(<Editeur contenu={contenu()} editions={[]} mentions={[]} />);
    expect(screen.getByLabelText("Choisir une photo")).toBeInTheDocument();
    cleanup();

    render(
      <Editeur
        contenu={contenu({ imageUrl: "https://x.example/deja.png", imageAlt: "Déjà là" })}
        editions={[]}
        mentions={[]}
      />,
    );
    expect(screen.getByLabelText("Remplacer la photo")).toBeInTheDocument();
  });
});
