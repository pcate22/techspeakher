import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgaId } from "@/lib/auth-guards";
import CarteSection from "@/components/CarteSection";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import InlineActionForm from "@/components/InlineActionForm";
import { getEditionById } from "@/lib/tremplin-editions";
import {
  getPhotosByEdition,
  getPhotoTags,
  getPublicPhotos,
} from "@/lib/tremplin-photos";
import {
  getRegistrationsByEdition,
  registrationLabel,
} from "@/lib/tremplin-registrations";
import { getComptesPlateforme, compteLabel } from "@/lib/users";
import {
  removePhotoTagAction,
  setPhotoTagConsentAction,
  updatePhotoAction,
  deletePhotoFromFicheAction,
} from "../../../actions";
import AddPhotoTagDialog from "../../AddPhotoTagDialog";

export const metadata: Metadata = {
  title: "Photo | Tech Speak'Her",
  robots: { index: false },
};

export const dynamic = "force-dynamic";


export default async function FichePhoto({
  params,
}: {
  params: Promise<{ edition: string; photo: string }>;
}) {
  await requireOrgaId();
  const { edition: editionParam, photo: photoParam } = await params;
  const editionId = Number(editionParam);
  const photoId = Number(photoParam);
  if (!Number.isInteger(editionId) || !Number.isInteger(photoId)) notFound();

  const edition = await getEditionById(editionId);
  if (!edition) notFound();
  const [photos, tags, registrations, comptesBruts, publiables] = await Promise.all([
    getPhotosByEdition(editionId),
    getPhotoTags(photoId, editionId),
    getRegistrationsByEdition(editionId),
    getComptesPlateforme(),
    getPublicPhotos(editionId),
  ]);
  const photo = photos.find((p) => p.id === photoId);
  if (!photo) notFound();

  const publiable = publiables.some((p) => p.id === photoId);
  const bloquant = tags.find((t) => !t.couverte);
  const participantes = [...registrations]
    .sort((a, b) => registrationLabel(a).localeCompare(registrationLabel(b), "fr"))
    .map((r) => ({ id: r.id, label: registrationLabel(r) }));
  const comptes = comptesBruts.map((c) => ({
    id: c.id,
    label: compteLabel(c),
  }));

  const MOMENTS = { podium: "Podium", soiree: "Soirée", autre: "Autre" } as const;

  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <header>
          <h1 className="text-2xl font-bold">{photo.legende ?? "Photo sans légende"}</h1>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-wide">
            <span className={publiable ? "text-cyan" : "text-orange"}>
              {publiable
                ? "● Publiée sur la page publique"
                : `Privée : ${bloquant?.label ?? "accord à recueillir"}`}
            </span>
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.legende ?? "Photo de l'édition"}
            className="mt-3 w-full max-h-80 rounded-xl object-contain border border-navy-lighter bg-navy"
          />
        </header>

        <CarteSection
          id="legende-titre"
          titre="Légende et moment"
          description="Ce qui s'affiche sous la photo, et à quel moment de l'édition elle a été prise."
        >
          <InlineActionForm
            action={updatePhotoAction}
            hidden={{ editionId, photoId: photo.id }}
            fields={[
              {
                kind: "input",
                name: "legende",
                label: "Légende (facultatif)",
                defaultValue: photo.legende ?? "",
                placeholder: "Ex. Le jury et les finalistes",
              },
              {
                kind: "select",
                name: "kind",
                label: "Moment",
                defaultValue: photo.kind,
                options: (Object.entries(MOMENTS) as [string, string][]).map(
                  ([value, label]) => ({ value, label }),
                ),
              },
            ]}
            submitLabel="Enregistrer"
            pendingLabel="Enregistrement…"
            successMessage="Légende enregistrée."
          />
        </CarteSection>

        <CarteSection
          id="personnes-titre"
          titre="Personnes sur la photo"
          description="Droit à l'image : la photo n'est publiée que si chaque personne est couverte. Une participante consent dans son espace ; pour un compte ou un nom libre, coche « accord recueilli »."
        >
          {tags.length === 0 ? (
            <p className="text-sm text-gray-light mb-2">
              Personne d&apos;identifiée : la photo est publiable telle quelle
              (aucun visage nommé). Identifie les personnes présentes pour
              gérer leur accord.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 list-none mb-2">
              {tags.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-navy-lighter pb-2"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{t.label}</span>
                    <span className={`block text-xs ${t.couverte ? "text-gray-light" : "text-orange"}`}>
                      {t.registrationId !== null
                        ? t.couverte
                          ? "Accord donné (dans son espace)"
                          : "En attente de son accord (dans son espace)"
                        : t.couverte
                          ? "Accord recueilli"
                          : "Accord à recueillir"}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    {/* Le consentement d'une inscription se gère chez elle. */}
                    {t.registrationId === null && (
                      <InlineActionForm
                        action={setPhotoTagConsentAction}
                        hidden={{ editionId, tagId: t.id }}
                        submitOnChange
                        submitLabel="Enregistrer"
                        successMessage="Accord enregistré."
                        fields={[
                          {
                            kind: "checkboxes",
                            name: "consentement",
                            legend: "Accord",
                            options: [
                              { value: "on", label: "Accord recueilli", checked: t.consentement },
                            ],
                          },
                        ]}
                        className="flex flex-col gap-1"
                      />
                    )}
                    <InlineActionForm
                      action={removePhotoTagAction}
                      hidden={{ editionId, tagId: t.id }}
                      submitLabel="Retirer"
                      confirm={{
                        title: `Retirer ${t.label} de la photo ?`,
                        message: "Son identification est retirée (la photo, elle, reste).",
                        label: "Retirer",
                      }}
                      className="flex flex-col items-end gap-1"
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <AddPhotoTagDialog
            editionId={editionId}
            photoId={photo.id}
            participantes={participantes}
            comptes={comptes}
          />
        </CarteSection>

        <CarteSection
          id="suppression-titre"
          titre="Supprimer"
          description="La photo et les identifications disparaissent, y compris de la page publique."
        >
          <form action={deletePhotoFromFicheAction}>
            <input type="hidden" name="editionId" value={editionId} />
            <input type="hidden" name="photoId" value={photo.id} />
            <ConfirmSubmitButton
              title="Supprimer cette photo ?"
              message="Elle disparaîtra de l'espace organisatrices et de la page publique. Cette action est définitive."
              confirmLabel="Supprimer définitivement"
              pendingLabel="Suppression…"
              className="!text-orange hover:!text-orange px-0 min-h-[44px]"
            >
              Supprimer cette photo
            </ConfirmSubmitButton>
          </form>
        </CarteSection>

        <p>
          <Link
            href={`/admin/tremplins/${editionId}`}
            className="inline-block py-2 -my-2 text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
          >
            ← Retour à l&apos;édition
          </Link>
        </p>
      </div>
    </div>
  );
}
