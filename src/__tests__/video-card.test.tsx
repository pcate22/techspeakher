import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import VideoCard from "@/components/VideoCard";
import type { Video } from "@/data/videos";

afterEach(cleanup);

const video: Video = {
  id: "replay-tremplin-devfest-toulouse-2026",
  title: "La soirée Tremplin 2026 en entier",
  description: "8 finalistes, 3 min de pitch chacune, un jury 100 % féminin.",
  url: "https://youtu.be/Ac6rI2Bg-jE",
  duree: "1 h 42",
  date: "4 juin 2026",
  edition: { conf: "devfest-toulouse", annee: 2026 },
};

describe("VideoCard", () => {
  it("affiche le titre, la description et la durée", () => {
    render(<VideoCard video={video} />);
    expect(screen.getByText("La soirée Tremplin 2026 en entier")).toBeInTheDocument();
    expect(screen.getByText(/8 finalistes/)).toBeInTheDocument();
    expect(screen.getByText("1 h 42")).toBeInTheDocument();
  });

  it("ouvre la vidéo sur YouTube dans un nouvel onglet", () => {
    render(<VideoCard video={video} />);
    const lien = screen.getByRole("link");
    expect(lien).toHaveAttribute("href", "https://youtu.be/Ac6rI2Bg-jE");
    expect(lien).toHaveAttribute("target", "_blank");
    expect(lien).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("nomme le lien par le titre de la vidéo, et annonce le nouvel onglet", () => {
    render(<VideoCard video={video} />);
    const nom = screen.getByRole("link").getAttribute("aria-label") ?? "";
    expect(nom).toContain("La soirée Tremplin 2026 en entier");
    expect(nom).toContain("nouvel onglet");
  });

  it("reprend le texte visible du lien dans son nom accessible", () => {
    // Intitulé dans le nom (WCAG 2.5.3) : ce qu'on lit doit se retrouver dans
    // ce qu'on prononce, sinon la commande vocale échoue à cliquer le lien.
    render(<VideoCard video={video} />);
    const visible = screen.getByText("Regarder sur YouTube").textContent ?? "";
    const nom = screen.getByRole("link").getAttribute("aria-label") ?? "";
    expect(nom.toLowerCase()).toContain(visible.toLowerCase());
  });

  it("dérive la miniature de l'URL et la sert par l'optimiseur du site", () => {
    // La miniature vient de YouTube mais transite par `/_next/image`, donc en
    // same-origin : la CSP reste à `img-src 'self'`.
    const { container } = render(<VideoCard video={video} />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain(encodeURIComponent("i.ytimg.com/vi/Ac6rI2Bg-jE"));
    // Décorative : le lien porte déjà l'intitulé.
    expect(img).toHaveAttribute("alt", "");
  });

  it("se passe de durée quand elle est absente", () => {
    render(<VideoCard video={{ ...video, duree: undefined }} />);
    expect(screen.queryByText("1 h 42")).toBeNull();
    expect(screen.getByRole("link")).toBeInTheDocument();
  });

  it("affiche une couverture de repli quand l'URL ne donne aucune miniature", () => {
    const { container } = render(
      <VideoCard video={{ ...video, url: "https://exemple.test/video" }} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("La soirée Tremplin 2026 en entier")).toBeInTheDocument();
    expect(screen.getByText("Regarder sur YouTube")).toBeInTheDocument();
  });
});
