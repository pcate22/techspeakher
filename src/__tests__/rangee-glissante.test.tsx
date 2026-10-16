import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, createEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import Link from "next/link";
import RangeeGlissante from "@/components/RangeeGlissante";
import type { ActionState } from "@/lib/action-state";

/**
 * La rangée qui se GLISSE vers la gauche pour révéler sa poubelle : le raccourci
 * demandé pour supprimer un atelier sans traverser quatre écrans.
 *
 * Trois choses se tiennent ici, et chacune casse l'usage si elle lâche :
 * - le geste n'est pas un clic : glisser la rangée ne doit JAMAIS ouvrir sa
 *   page (sinon le raccourci devient un piège) ;
 * - un défilement vertical reste un défilement : une liste qui ouvre des
 *   tiroirs quand on la parcourt au doigt est inutilisable ;
 * - la poubelle existe SANS le geste : au clavier la tabulation y mène et le
 *   tiroir s'ouvre, sinon la fonction n'existe que pour les doigts (RGAA, et
 *   WCAG 2.2 « mouvements de glissement »).
 */

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

expect.extend(toHaveNoViolations);
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const LARGEUR = 56;

const rendu = (
  props: Partial<React.ComponentProps<typeof RangeeGlissante>> = {},
  action: (s: ActionState, f: FormData) => Promise<ActionState> = async () => ({ status: "idle" }),
) =>
  render(
    <ul>
      <RangeeGlissante
        titre="Écrire son abstract"
        action={action}
        hidden={{ editionId: 3, atelierId: 7 }}
        messageSucces="« Écrire son abstract » est supprimé."
        {...props}
      >
        <Link href="/admin/tremplins/3/ateliers/7">Écrire son abstract</Link>
      </RangeeGlissante>
    </ul>,
  );

/** Le bloc qui BOUGE : le parent direct de la rangée passée en enfant. */
const contenu = () => screen.getByRole("link", { name: "Écrire son abstract" }).parentElement!;
const decalage = () => contenu().style.transform;

/** La poubelle, quel que soit son temps : « Supprimer : X » au repos,
 * « Confirmer la suppression de « X » » une fois armée. */
const poubelle = () => screen.getByRole("button", { name: /suppr/i });

const glisser = (dx: number, dy = 0) => {
  const cible = screen.getByRole("link", { name: "Écrire son abstract" });
  const commun = { isPrimary: true, pointerId: 1 };
  fireEvent.pointerDown(cible, { ...commun, clientX: 200, clientY: 100 });
  fireEvent.pointerMove(cible, { ...commun, clientX: 200 + dx, clientY: 100 + dy });
  fireEvent.pointerUp(cible, { ...commun, clientX: 200 + dx, clientY: 100 + dy });
};

describe("RangeeGlissante — le geste", () => {
  it("au repos, la rangée est en place : la poubelle reste derrière elle", () => {
    rendu();
    expect(decalage()).toBe("translateX(0px)");
  });

  it("un glissement vers la GAUCHE ouvre le tiroir", () => {
    rendu();
    glisser(-LARGEUR);
    expect(decalage()).toBe(`translateX(-${LARGEUR}px)`);
  });

  it("un glissement à peine amorcé se referme (un frôlement n'arme rien)", () => {
    rendu();
    glisser(-14);
    expect(decalage()).toBe("translateX(0px)");
  });

  it("un glissement vers la DROITE laisse le tiroir fermé", () => {
    rendu();
    glisser(80);
    expect(decalage()).toBe("translateX(0px)");
  });

  it("un défilement vertical laisse la rangée en place", () => {
    rendu();
    glisser(-20, 60);
    expect(decalage()).toBe("translateX(0px)");
  });

  it("glisser n'ouvre PAS la page : le clic qui suit le geste est neutralisé", () => {
    rendu();
    glisser(-LARGEUR);
    const lien = screen.getByRole("link", { name: "Écrire son abstract" });
    const clic = createEvent.click(lien);
    fireEvent(lien, clic);
    expect(clic.defaultPrevented).toBe(true);
  });

  it("tiroir ouvert, un tap sur la rangée le REFERME au lieu de naviguer", () => {
    rendu();
    glisser(-LARGEUR);
    const lien = screen.getByRole("link", { name: "Écrire son abstract" });
    // Un tap franc (sans glissement) : nouvel appui, donc le garde du geste est
    // relâché — c'est l'ouverture du tiroir qui retient la navigation.
    fireEvent.pointerDown(lien, { isPrimary: true, pointerId: 2, clientX: 200, clientY: 100 });
    fireEvent.pointerUp(lien, { isPrimary: true, pointerId: 2, clientX: 200, clientY: 100 });
    const clic = createEvent.click(lien);
    fireEvent(lien, clic);
    expect(clic.defaultPrevented).toBe(true);
    expect(decalage()).toBe("translateX(0px)");
  });

  it("Échap referme le tiroir", () => {
    rendu();
    glisser(-LARGEUR);
    fireEvent.keyDown(screen.getByRole("link", { name: "Écrire son abstract" }), { key: "Escape" });
    expect(decalage()).toBe("translateX(0px)");
  });
});

describe("RangeeGlissante — sans le geste (clavier, lecteur d'écran)", () => {
  it("la poubelle NOMME sa rangée (quinze « Supprimer » ne s'annoncent pas)", () => {
    rendu();
    expect(
      screen.getByRole("button", { name: "Supprimer : Écrire son abstract" }),
    ).toBeInTheDocument();
  });

  it("la rangée vient AVANT sa poubelle dans le parcours clavier", async () => {
    rendu();
    await userEvent.tab();
    expect(screen.getByRole("link", { name: "Écrire son abstract" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Supprimer : Écrire son abstract" })).toHaveFocus();
  });

  it("la poubelle focalisée OUVRE le tiroir (un focus invisible ne guide personne)", async () => {
    rendu();
    await userEvent.tab();
    await userEvent.tab();
    expect(decalage()).toBe(`translateX(-${LARGEUR}px)`);
  });

  it("le focus qui s'en va referme le tiroir", async () => {
    rendu();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(decalage()).toBe("translateX(0px)");
  });
});

describe("RangeeGlissante — la suppression", () => {
  it("la poubelle supprime, en emportant les identifiants", async () => {
    const action = vi.fn(
      async (_s: ActionState, _f: FormData) => ({ status: "success" }) as ActionState,
    );
    rendu({}, action);
    glisser(-LARGEUR); // le geste ARME : sans lui, le premier appui ne fait qu'armer
    await userEvent.click(poubelle());
    await waitFor(() => expect(action).toHaveBeenCalled());
    const formData = action.mock.calls[0][1];
    expect(formData.get("editionId")).toBe("3");
    expect(formData.get("atelierId")).toBe("7");
  });

  it("suppression faite : confirmation NOMMÉE sur place, et la liste se rafraîchit", async () => {
    rendu({}, async () => ({ status: "success" }));
    glisser(-LARGEUR);
    await userEvent.click(poubelle());
    const annonce = await screen.findByRole("status");
    expect(annonce).toHaveTextContent(/« Écrire son abstract » est supprimé\./);
    // Le compte rendu prend le FOCUS : sinon il tombait sur `body`, et la liste
    // se rafraîchissait par-dessus avant que quiconque l'ait lu.
    expect(annonce).toHaveFocus();
    // La liste se remet à jour, mais APRÈS — le rafraîchissement démontait la
    // rangée avant que React n'ait rendu sa confirmation.
    expect(refresh).not.toHaveBeenCalled();
    await waitFor(() => expect(refresh).toHaveBeenCalled(), { timeout: 4000 });
  });

  it("refus du serveur : l'alerte le dit et la rangée reste", async () => {
    rendu({}, async () => ({
      status: "error",
      error: "Atelier introuvable pour cette édition.",
      values: {},
    }));
    glisser(-LARGEUR);
    await userEvent.click(poubelle());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/introuvable/i));
    expect(screen.getByRole("link", { name: "Écrire son abstract" })).toBeInTheDocument();
  });
});

/**
 * LE FILET, AU CLAVIER.
 *
 * Mesuré en navigateur : `Tab` puis `Entrée` effaçait un atelier. Vérifié en
 * base, pas seulement à l'écran — la ligne avait bien disparu, avec ses
 * présences pointées, ses sous-groupes et ses documents (cascade).
 *
 * Le composant affirmait pourtant « la poubelle est hors d'atteinte tant qu'on
 * n'a pas glissé la rangée exprès ». C'était vrai du DOIGT seulement : le
 * glissement ARME, et ce déplacement n'a aucun équivalent dans l'arbre
 * d'accessibilité. Une orga parcourant sa liste au clavier traversait donc un
 * bouton destructif par rangée, chacun à un appui de la suppression.
 *
 * On rend le premier appui ARMANT, comme le glissement : deux temps des deux
 * côtés (principes §10, WCAG 3.3.4).
 */
describe("RangeeGlissante — la suppression au clavier a le même filet qu'au doigt", () => {
  it("le premier appui ARME au lieu de supprimer", async () => {
    const action = vi.fn(async () => ({ status: "idle" }) as ActionState);
    rendu({}, action);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(action).not.toHaveBeenCalled();
  });

  it("armée, la poubelle DIT ce que le prochain appui fera", async () => {
    rendu();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(
      screen.getByRole("button", { name: /confirmer la suppression de « Écrire son abstract »/i }),
    ).toBeInTheDocument();
  });

  it("le second appui supprime", async () => {
    const action = vi.fn(async () => ({ status: "idle" }) as ActionState);
    rendu({}, action);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(action).toHaveBeenCalled());
  });

  /** Le focus reste sur la poubelle entre les deux temps : sans ça, le second
   * appui ne tomberait nulle part. */
  it("le focus ne bouge pas pendant l'armement", async () => {
    rendu();
    await userEvent.tab();
    await userEvent.tab();
    const avant = document.activeElement;
    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(avant);
  });

  it("Échap désarme, et l'appui suivant ne supprime plus", async () => {
    const action = vi.fn(async () => ({ status: "idle" }) as ActionState);
    rendu({}, action);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Escape}");
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(action).not.toHaveBeenCalled();
  });

  /** Quitter la rangée désarme : on ne laisse pas une poubelle armée derrière
   * soi, qu'un appui distrait déclencherait au retour. */
  it("partir ailleurs désarme", async () => {
    const action = vi.fn(async () => ({ status: "idle" }) as ActionState);
    rendu({}, action);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await userEvent.tab();
    await userEvent.tab({ shift: true });
    await userEvent.keyboard("{Enter}");
    expect(action).not.toHaveBeenCalled();
  });

  /**
   * AU DOIGT, rien ne change : le glissement reste le premier temps, la
   * poubelle le second. Ajouter un appui de plus ici viderait le raccourci de
   * son intérêt — c'est la décision produit du 01/08, qu'on ne rediscute pas.
   */
  it("après un glissement, un seul appui suffit (le geste a déjà armé)", async () => {
    const action = vi.fn(async () => ({ status: "idle" }) as ActionState);
    rendu({}, action);
    glisser(-LARGEUR);
    await userEvent.click(poubelle());
    await waitFor(() => expect(action).toHaveBeenCalled());
  });
});

describe("RangeeGlissante — scan axe", () => {
  it("aucune violation, tiroir fermé comme ouvert", async () => {
    const { container } = rendu();
    expect(await axe(container)).toHaveNoViolations();
    glisser(-LARGEUR);
    expect(await axe(container)).toHaveNoViolations();
  });

});
