import { cache } from "react";
import { notFound } from "next/navigation";
import { getEditionById, type Edition } from "@/lib/tremplin-editions";
import { getAteliersByEdition, type Atelier } from "@/lib/tremplin-ateliers";
import {
  getRegistrationsByEdition,
  type Registration,
} from "@/lib/tremplin-registrations";
import {
  getRecompensesByEdition,
  type Recompense,
} from "@/lib/tremplin-recompenses";

/**
 * Préambule commun aux pages admin d'une édition : valide le paramètre et charge
 * l'édition, sinon `notFound()`. L'authentification (`requireOrgaId`) reste dans
 * la page (c'est une décision d'accès, pas un chargement de données).
 * Mémoïsé PAR REQUÊTE (`React.cache`) : le layout `[edition]` et la page
 * appellent tous deux ce préambule — une seule requête SQL part réellement.
 */
export const loadEditionOrNotFound = cache(async function loadEditionOrNotFound(
  editionRaw: string,
): Promise<{ editionId: number; edition: Edition }> {
  const editionId = Number(editionRaw);
  if (!Number.isInteger(editionId)) notFound();
  const edition = await getEditionById(editionId);
  if (!edition) notFound();
  return { editionId, edition };
});


/**
 * Préambule des pages d'un ATELIER (sommaire et sous-pages, lot C3b) : édition
 * puis atelier, sinon `notFound()`. Mémoïsé par requête comme le préambule
 * d'édition — layout, sommaire et sous-page partagent les mêmes requêtes.
 */
export const loadAtelierOrNotFound = cache(async function loadAtelierOrNotFound(
  editionRaw: string,
  atelierRaw: string,
): Promise<{ editionId: number; edition: Edition; atelier: Atelier }> {
  const editionId = Number(editionRaw);
  const atelierId = Number(atelierRaw);
  if (!Number.isInteger(editionId) || !Number.isInteger(atelierId)) notFound();
  // Édition et ateliers en parallèle (1 vague au lieu de 2). `getEditionById`
  // est mémoïsé → partagé avec le layout.
  const [edition, ateliers] = await Promise.all([
    getEditionById(editionId),
    getAteliersByEdition(editionId),
  ]);
  if (!edition) notFound();
  const atelier = ateliers.find((a) => a.id === atelierId);
  if (!atelier) notFound();
  return { editionId, edition, atelier };
});

/**
 * Préambule des pages d'une PARTICIPANTE (sommaire et sous-pages, lot C3c) :
 * édition puis inscription, sinon `notFound()`. Mémoïsé par requête.
 */
export const loadRegistrationOrNotFound = cache(async function loadRegistrationOrNotFound(
  editionRaw: string,
  registrationRaw: string,
): Promise<{ editionId: number; edition: Edition; registration: Registration }> {
  const editionId = Number(editionRaw);
  const registrationId = Number(registrationRaw);
  if (!Number.isInteger(editionId) || !Number.isInteger(registrationId)) notFound();
  // Édition et inscriptions en parallèle (1 vague au lieu de 2). `getEditionById`
  // est mémoïsé → partagé avec le layout.
  const [edition, registrations] = await Promise.all([
    getEditionById(editionId),
    getRegistrationsByEdition(editionId),
  ]);
  if (!edition) notFound();
  const registration = registrations.find((r) => r.id === registrationId);
  if (!registration) notFound();
  return { editionId, edition, registration };
});

/**
 * Préambule des pages d'une RÉCOMPENSE (hub et sous-pages) : édition puis
 * récompense, sinon `notFound()`. Mémoïsé par requête (layout + hub + sous-page
 * partagent les mêmes requêtes).
 */
export const loadRecompenseOrNotFound = cache(async function loadRecompenseOrNotFound(
  editionRaw: string,
  recompenseRaw: string,
): Promise<{ editionId: number; edition: Edition; recompense: Recompense }> {
  const editionId = Number(editionRaw);
  const recompenseId = Number(recompenseRaw);
  if (!Number.isInteger(editionId) || !Number.isInteger(recompenseId)) notFound();
  // Édition et catalogue de récompenses en parallèle (pas de getter mono-ligne
  // pour les récompenses : peu de lignes par édition, le fetch-all reste ok).
  const [edition, recompenses] = await Promise.all([
    getEditionById(editionId),
    getRecompensesByEdition(editionId),
  ]);
  if (!edition) notFound();
  const recompense = recompenses.find((r) => r.id === recompenseId);
  if (!recompense) notFound();
  return { editionId, edition, recompense };
});
