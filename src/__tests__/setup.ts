import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import React from "react";

// Shims jsdom pour Radix (pointer capture / scroll non implémentés par jsdom).
// Gardé : les tests en environnement `node` (ex. contrat SQL) n'ont pas de DOM.
if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture)
    Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture)
    Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView)
    Element.prototype.scrollIntoView = () => {};
}

// jsdom n'implémente pas <dialog>.showModal/close : polyfill minimal, une
// seule fois (SearchBar, filtres, AdminDialog, FeuilleCreer…).
if (typeof HTMLDialogElement !== "undefined") {
  if (!HTMLDialogElement.prototype.showModal)
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
  if (!HTMLDialogElement.prototype.close)
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
}

// Next.js Link uses React concurrent features which trigger async scheduler work.
// Mocking it with a plain <a> prevents "window is not defined" errors during teardown.
vi.mock("next/link", () => ({
  default: function MockLink({
    children,
    ...props
  }: {
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
    return React.createElement("a", props, children);
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
