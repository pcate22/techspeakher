// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Le détecteur d'endpoint Sessionize : coller l'ADRESSE de la page programme
 * d'une conf, le serveur extrait `sessionize.com/api/v2/<ID>` de son HTML.
 * (Roadmap « ordre de reprise » item 3 : les ids sont introuvables à la main.)
 *
 * C'est le SEUL endroit du dépôt où le serveur va chercher une URL fournie
 * par un humain : la garde SSRF est le cœur du banc. Menace : l'orga colle
 * (ou se fait dicter) une adresse qui pointe vers le réseau interne de
 * l'hébergeur — la requête doit être refusée AVANT de partir, et à chaque
 * saut de redirection (une page publique peut rediriger vers du privé).
 *
 * `fetch` est stubé (le motif de `cfp-import.test.ts`) ; la résolution DNS
 * est moquée module par module (`node:dns/promises`).
 */

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

import { lookup } from "node:dns/promises";
import {
  extraireIdsSessionize,
  adresseInterdite,
  detecterEndpointSessionize,
} from "@/lib/detecteur-sessionize";

const PAGE_AVEC_EMBED = `<html><body>
  <h1>Programme</h1>
  <script src="https://sessionize.com/api/v2/jl4ktls0/view/GridSmart"></script>
</body></html>`;

/** Toutes les adresses résolvent en IP publique, sauf dit autrement. */
const resolutPublic = () =>
  vi.mocked(lookup).mockResolvedValue([{ address: "203.0.113.10", family: 4 }] as never);

const reponseHtml = (html: string, status = 200, headers: Record<string, string> = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers(headers),
  text: () => Promise.resolve(html),
});

beforeEach(() => {
  vi.mocked(lookup).mockReset();
  resolutPublic();
});
afterEach(() => vi.unstubAllGlobals());

describe("extraireIdsSessionize — l'id dans le HTML, rien d'autre", () => {
  it("trouve l'id d'un embed classique", () => {
    expect(extraireIdsSessionize(PAGE_AVEC_EMBED)).toEqual(["jl4ktls0"]);
  });

  it("dédoublonne un id répété (embed + lien de secours)", () => {
    const page = PAGE_AVEC_EMBED + `<a href="https://sessionize.com/api/v2/jl4ktls0/view/Sessions">JSON</a>`;
    expect(extraireIdsSessionize(page)).toEqual(["jl4ktls0"]);
  });

  it("rend les DEUX ids quand la page en embarque deux (années côte à côte)", () => {
    const page =
      PAGE_AVEC_EMBED + `<script src="https://sessionize.com/api/v2/abc123def/view/GridSmart"></script>`;
    expect(extraireIdsSessionize(page)).toEqual(["jl4ktls0", "abc123def"]);
  });

  it("rend une liste vide sur une page sans embed Sessionize", () => {
    expect(extraireIdsSessionize("<html><body>Que du texte.</body></html>")).toEqual([]);
  });
});

describe("adresseInterdite — le réseau interne est hors d'atteinte", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.8",
    "172.16.0.1",
    "172.31.255.254",
    "192.168.1.20",
    "169.254.169.254", // métadonnées cloud : LA cible classique du SSRF
    "0.0.0.0",
    "::1",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "::ffff:192.168.1.20", // IPv4 privé déguisé en IPv6
    "::ffff:7f00:1", // le MÊME 127.0.0.1, en forme hexa — selon le résolveur
    "::ffff:a9fe:a9fe", // 169.254.169.254 (métadonnées cloud) en hexa
  ])("refuse %s", (ip) => {
    expect(adresseInterdite(ip)).toBe(true);
  });

  it.each([
    "203.0.113.10",
    "8.8.8.8",
    "172.32.0.1",
    "172.15.0.1",
    "2606:4700::1",
    "::ffff:cb00:710a", // 203.0.113.10 en hexa : public, mappé ou pas
  ])("laisse passer %s (public)", (ip) => {
    expect(adresseInterdite(ip)).toBe(false);
  });
});

describe("detecterEndpointSessionize — la garde SSRF part en premier", () => {
  it("refuse une adresse en http, sans émettre de requête", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const d = await detecterEndpointSessionize("http://devfesttoulouse.fr/programme");
    expect(d.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("refuse une adresse illisible, sans émettre de requête", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const d = await detecterEndpointSessionize("pas une url");
    expect(d.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("refuse un hôte qui résout vers le réseau interne, sans émettre de requête", async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: "192.168.1.5", family: 4 }] as never);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const d = await detecterEndpointSessionize("https://intranet.exemple.fr/programme");
    expect(d.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("refuse un hôte dont UNE des adresses résolues est interne (multi-A)", async () => {
    vi.mocked(lookup).mockResolvedValue([
      { address: "203.0.113.10", family: 4 },
      { address: "10.0.0.4", family: 4 },
    ] as never);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const d = await detecterEndpointSessionize("https://douteux.exemple.fr/programme");
    expect(d.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("refuse une IP littérale interne (aucune résolution à attendre)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const d = await detecterEndpointSessionize("https://169.254.169.254/latest/meta-data");
    expect(d.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(vi.mocked(lookup)).toHaveBeenCalledTimes(0);
  });

  it("refuse un littéral IPv6 interne PAR LA GARDE, sans compter sur le résolveur", async () => {
    // url.hostname garde les crochets ("[::1]") : sans les retirer, isIP rend 0
    // et le refus reposerait sur un ENOTFOUND du résolveur — un effet de bord
    // de plateforme, pas une garde. Ici : refus direct, zéro résolution.
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const d = await detecterEndpointSessionize("https://[::1]/programme");
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.erreur).toMatch(/réseau interne/i);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(vi.mocked(lookup)).toHaveBeenCalledTimes(0);
  });

  it("refuse un port hors https standard", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const d = await detecterEndpointSessionize("https://exemple.fr:8443/programme");
    expect(d.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("trouve l'id sur la page programme", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseHtml(PAGE_AVEC_EMBED)));
    const d = await detecterEndpointSessionize("https://devfesttoulouse.fr/programme");
    expect(d).toEqual({ ok: true, endpoint: "jl4ktls0" });
  });

  it("le fetch part avec les options de GARDE : redirections manuelles, temps borné", async () => {
    // `redirect: "manual"` EST la re-garde par saut (avec "follow", undici
    // suivrait lui-même une 302 vers le réseau interne sans repasser par
    // gardeUrl) et `signal` la borne de temps — deux protections qu'aucun
    // autre test ne voit, fetch étant stubé partout.
    const fetchMock = vi.fn().mockResolvedValue(reponseHtml(PAGE_AVEC_EMBED));
    vi.stubGlobal("fetch", fetchMock);
    await detecterEndpointSessionize("https://devfesttoulouse.fr/programme");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ redirect: "manual", signal: expect.any(AbortSignal) }),
    );
    // Et la résolution DNS demande bien TOUTES les adresses (sans `all: true`,
    // lookup rend un objet, pas un tableau — le filtre multi-A tomberait).
    expect(vi.mocked(lookup)).toHaveBeenCalledWith("devfesttoulouse.fr", { all: true });
  });

  it("suit une redirection https PUBLIQUE (www → apex), et re-vérifie l'hôte", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        reponseHtml("", 301, { location: "https://devfesttoulouse.fr/programme" }),
      )
      .mockResolvedValueOnce(reponseHtml(PAGE_AVEC_EMBED));
    vi.stubGlobal("fetch", fetchMock);
    const d = await detecterEndpointSessionize("https://www.devfesttoulouse.fr/programme");
    expect(d).toEqual({ ok: true, endpoint: "jl4ktls0" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Les DEUX hôtes sont passés par la résolution DNS.
    expect(vi.mocked(lookup)).toHaveBeenCalledTimes(2);
  });

  it("refuse une redirection vers le réseau interne (le 2e saut reste au sol)", async () => {
    vi.mocked(lookup)
      .mockResolvedValueOnce([{ address: "203.0.113.10", family: 4 }] as never)
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }] as never);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        reponseHtml("", 302, { location: "https://interne.exemple.fr/secret" }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const d = await detecterEndpointSessionize("https://public.exemple.fr/programme");
    expect(d.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("s'arrête après trois requêtes (deux redirections suivies)", async () => {
    const saut = (n: number) =>
      reponseHtml("", 302, { location: `https://exemple.fr/etape${n}` });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(saut(1))
      .mockResolvedValueOnce(saut(2))
      .mockResolvedValueOnce(saut(3))
      .mockResolvedValueOnce(saut(4));
    vi.stubGlobal("fetch", fetchMock);
    const d = await detecterEndpointSessionize("https://exemple.fr/programme");
    expect(d.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("borne la lecture d'un corps plus gros que son annonce (flux coupé)", async () => {
    // Un serveur peut mentir ou taire content-length : la borne doit tenir
    // pendant la lecture, pas seulement sur l'annonce. Le flux est coupé
    // (cancel) dès le dépassement ; ce qui a été lu sert quand même.
    const encodeur = new TextEncoder();
    const cancel = vi.fn();
    const chunks = [
      encodeur.encode(PAGE_AVEC_EMBED),
      new Uint8Array(3_000_000), // le mensonge : bien au-delà de la borne
      encodeur.encode("jamais lu"),
    ];
    let i = 0;
    const body = {
      getReader: () => ({
        read: () =>
          Promise.resolve(
            i < chunks.length ? { done: false, value: chunks[i++] } : { done: true },
          ),
        cancel,
      }),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers(), body }),
    );
    const d = await detecterEndpointSessionize("https://exemple.fr/programme");
    expect(d).toEqual({ ok: true, endpoint: "jl4ktls0" });
    expect(cancel).toHaveBeenCalled();
    expect(i).toBe(2); // le troisième morceau reste sur le serveur
  });

  it("refuse une page annoncée trop grosse (content-length)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reponseHtml(PAGE_AVEC_EMBED, 200, { "content-length": "99999999" })),
    );
    const d = await detecterEndpointSessionize("https://exemple.fr/programme");
    expect(d.ok).toBe(false);
  });

  it("dit « aucun id sur cette page » en clair quand la page vit sans embed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseHtml("<html>rien</html>")));
    const d = await detecterEndpointSessionize("https://exemple.fr/programme");
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.erreur).toMatch(/aucun id/i);
  });

  it("demande l'id direct quand la page embarque PLUSIEURS ids", async () => {
    const page =
      PAGE_AVEC_EMBED + `<script src="https://sessionize.com/api/v2/abc123def/view/Grid"></script>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseHtml(page)));
    const d = await detecterEndpointSessionize("https://exemple.fr/programme");
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.erreur).toMatch(/plusieurs/i);
  });

  it("dit l'échec HTTP en clair (page introuvable)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponseHtml("", 404)));
    const d = await detecterEndpointSessionize("https://exemple.fr/programme");
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.erreur).toMatch(/404/);
  });
});
