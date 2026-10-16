import type { Metadata } from "next";
import { requireOrgaId } from "@/lib/auth-guards";
import ListPageTemplate from "@/components/ListPageTemplate";
import { SetFilCrumbs } from "../FilContext";
import NavRow from "@/components/NavRow";
import {
  getRegistrationsByEdition,
  registrationLabel,
  trierParLabel,
} from "@/lib/tremplin-registrations";
import {
  getPhotosByEdition,
  getPhotoTagsByEdition,
  photoPubliable,
} from "@/lib/tremplin-photos";
import AddPhotoDialog from "../AddPhotoDialog";
import { isSafeHttpUrl } from "@/components/ExternalLink";
import { tremplinPageMetadata } from "@/lib/tremplin-page-meta";
import { loadEditionOrNotFound } from "@/lib/tremplin-admin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}): Promise<Metadata> {
  return tremplinPageMetadata((await params).edition, "Photos");
}

export const dynamic = "force-dynamic";

export default async function PhotosIndex({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  await requireOrgaId();
  const { editionId, edition } = await loadEditionOrNotFound((await params).edition);

  const [photos, photoTags, registrations] = await Promise.all([
    getPhotosByEdition(editionId),
    getPhotoTagsByEdition(editionId).catch((e) => {
      console.error("Tags photo indisponibles (migration 020 ?)", e);
      return new Map<number, never[]>();
    }),
    getRegistrationsByEdition(editionId),
  ]);
  // Photo publiable = tous ses tags couverts (dérivé sans requête).
  const publiableIds = new Set(
    photos.filter((p) => photoPubliable(photoTags.get(p.id) ?? [])).map((p) => p.id),
  );
  const participantesForPicker = trierParLabel(registrations).map((r) => ({
    id: r.id,
    label: registrationLabel(r),
  }));

  return (
    <>
      <SetFilCrumbs crumbs={[{ label: "Photos" }]} />
      <ListPageTemplate
      title="Photos"
      meta={`${edition.nom} · ${photos.length} photo${photos.length > 1 ? "s" : ""}`}
      create={<AddPhotoDialog editionId={editionId} participantes={participantesForPicker} />}
    >
      {photos.length === 0 ? (
        <p className="text-sm text-gray-light">
          Aucune photo pour l&apos;instant. Ajoute-en une avec le bouton ci-dessus ;
          elle n&apos;est publiée qu&apos;une fois l&apos;accord de chaque personne recueilli.
        </p>
      ) : (
        <ul role="list" className="flex flex-col gap-2 list-none">
          {photos.map((p) => {
            const tags = photoTags.get(p.id) ?? [];
            const publiable = publiableIds.has(p.id);
            const bloquant = tags.find((t) => !t.couverte);
            const sousTitre = [
              tags.length > 0
                ? `${tags.length} personne${tags.length > 1 ? "s" : ""}`
                : "Personne identifiée",
              // « privée », le mot de la liste « À faire » et celui du dialogue
              // d'identification (« Sans accord, la photo reste privée ») : un
              // seul mot par concept, y compris de part et d'autre d'un lien.
              // « bloquée » en était un second, à un tap du premier.
              //
              // Et « accord à recueillir » plutôt qu'« accord manquant » : pour
              // une inscrite, la couverture vaut SON réglage de visibilité, et
              // un refus n'est pas une absence de réponse.
              publiable ? "publiée" : `privée : ${bloquant?.label ?? "accord à recueillir"}`,
            ].join(" · ");
            return (
              <li key={p.id}>
                <NavRow
                  href={`/admin/tremplins/${editionId}/photos/${p.id}`}
                  leading={
                    // Défense en profondeur : on n'émet l'<img> que pour une URL
                    // http(s) (l'écriture valide déjà, mais d'anciennes lignes
                    // pourraient précéder cette validation).
                    isSafeHttpUrl(p.url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-12 w-16 rounded object-cover border border-navy-lighter"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex h-12 w-16 items-center justify-center rounded border border-navy-lighter text-gray-light"
                      >
                        ?
                      </span>
                    )
                  }
                  title={p.legende ?? "Sans légende"}
                  subtitle={sousTitre}
                  flag={!publiable}
                />
              </li>
            );
          })}
        </ul>
      )}
      </ListPageTemplate>
    </>
  );
}
