import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import Footer from "@/components/Footer";
import { LINKEDIN_URL, YOUTUBE_URL } from "@/constants/site";

afterEach(cleanup);

/** Colonne « Suivez-nous » du footer : nos deux réseaux, plus le flux RSS. */
describe("Footer — Suivez-nous", () => {
  it("mène à la chaîne YouTube", () => {
    render(<Footer />);
    const lien = screen.getByRole("link", { name: /YouTube/ });
    expect(lien).toHaveAttribute("href", YOUTUBE_URL);
    expect(lien).toHaveAttribute("target", "_blank");
  });

  it("garde LinkedIn et le flux RSS à côté", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: /LinkedIn/ })).toHaveAttribute("href", LINKEDIN_URL);
    expect(screen.getByRole("link", { name: /Flux RSS/ })).toHaveAttribute("href", "/feed.xml");
  });
});

/** Colonne « Infos » : le kit de communication, que les partenaires cherchent. */
describe("Footer — Infos", () => {
  it("mène au kit de communication", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Kit de communication" })).toHaveAttribute(
      "href",
      "/kit-de-communication",
    );
  });
});
