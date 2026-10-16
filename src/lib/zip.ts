/**
 * Écriture d'une archive ZIP, SANS dépendance : le kit de communication
 * (`/kit-de-communication`) propose ses fichiers en un seul téléchargement, et
 * ajouter une bibliothèque pour trois images n'en valait pas la peine.
 *
 * Mode « stocké » uniquement (méthode 0, pas de compression) : le kit ne
 * contient que des PNG, déjà compressés — les recompresser ne gagnerait rien.
 * Pas de ZIP64 : l'archive reste loin des 4 Go.
 *
 * Date fixe (1980-01-01, l'origine du format) : la même entrée donne les mêmes
 * octets, donc une archive reproductible d'un build à l'autre.
 *
 * Format : APPNOTE.TXT de PKWARE, §4.3 (en-tête local, répertoire central,
 * fin de répertoire central).
 */

export type FichierZip = { nom: string; contenu: Uint8Array };

const TABLE_CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 IEEE 802.3, celui qu'exige le format ZIP. */
export function crc32(octets: Uint8Array): number {
  let crc = 0xffffffff;
  for (const o of octets) crc = TABLE_CRC[(crc ^ o) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const EN_TETE_LOCAL = 30;
const EN_TETE_CENTRAL = 46;
const FIN_CENTRAL = 22;
/** Drapeau 11 : noms encodés en UTF-8. */
const DRAPEAU_UTF8 = 0x0800;
/** 1980-01-01 00:00, au format date/heure MS-DOS. */
const DATE_DOS = (0 << 9) | (1 << 5) | 1;
const HEURE_DOS = 0;

const encodeur = new TextEncoder();

/**
 * Taille, en octets, de l'archive que `creerZip` produira pour ces fichiers.
 * Permet d'afficher le poids du téléchargement (RGAA 6.1 : un lien de
 * téléchargement annonce son format et son poids) sans construire l'archive.
 */
export function tailleZip(fichiers: { nom: string; octets: number }[]): number {
  return fichiers.reduce((total, f) => {
    const nom = encodeur.encode(f.nom).byteLength;
    return total + EN_TETE_LOCAL + EN_TETE_CENTRAL + 2 * nom + f.octets;
  }, FIN_CENTRAL);
}

export function creerZip(fichiers: FichierZip[]): Uint8Array<ArrayBuffer> {
  const sortie = new Uint8Array(
    tailleZip(fichiers.map((f) => ({ nom: f.nom, octets: f.contenu.byteLength }))),
  );
  const vue = new DataView(sortie.buffer);
  let pos = 0;
  const centraux: { nom: Uint8Array; crc: number; taille: number; decalage: number }[] = [];

  for (const f of fichiers) {
    const nom = encodeur.encode(f.nom);
    const crc = crc32(f.contenu);
    const taille = f.contenu.byteLength;
    centraux.push({ nom, crc, taille, decalage: pos });

    vue.setUint32(pos, 0x04034b50, true);
    vue.setUint16(pos + 4, 20, true); // version nécessaire : 2.0
    vue.setUint16(pos + 6, DRAPEAU_UTF8, true);
    vue.setUint16(pos + 8, 0, true); // méthode : stocké
    vue.setUint16(pos + 10, HEURE_DOS, true);
    vue.setUint16(pos + 12, DATE_DOS, true);
    vue.setUint32(pos + 14, crc, true);
    vue.setUint32(pos + 18, taille, true); // taille compressée
    vue.setUint32(pos + 22, taille, true); // taille d'origine
    vue.setUint16(pos + 26, nom.byteLength, true);
    vue.setUint16(pos + 28, 0, true); // champ extra
    sortie.set(nom, pos + EN_TETE_LOCAL);
    sortie.set(f.contenu, pos + EN_TETE_LOCAL + nom.byteLength);
    pos += EN_TETE_LOCAL + nom.byteLength + taille;
  }

  const debutCentral = pos;
  for (const c of centraux) {
    vue.setUint32(pos, 0x02014b50, true);
    vue.setUint16(pos + 4, 20, true); // version créatrice
    vue.setUint16(pos + 6, 20, true); // version nécessaire
    vue.setUint16(pos + 8, DRAPEAU_UTF8, true);
    vue.setUint16(pos + 10, 0, true);
    vue.setUint16(pos + 12, HEURE_DOS, true);
    vue.setUint16(pos + 14, DATE_DOS, true);
    vue.setUint32(pos + 16, c.crc, true);
    vue.setUint32(pos + 20, c.taille, true);
    vue.setUint32(pos + 24, c.taille, true);
    vue.setUint16(pos + 28, c.nom.byteLength, true);
    // extra, commentaire, disque, attributs internes / externes : à zéro.
    vue.setUint32(pos + 42, c.decalage, true);
    sortie.set(c.nom, pos + EN_TETE_CENTRAL);
    pos += EN_TETE_CENTRAL + c.nom.byteLength;
  }

  vue.setUint32(pos, 0x06054b50, true);
  vue.setUint16(pos + 8, centraux.length, true); // entrées sur ce disque
  vue.setUint16(pos + 10, centraux.length, true); // entrées au total
  vue.setUint32(pos + 12, pos - debutCentral, true);
  vue.setUint32(pos + 16, debutCentral, true);
  return sortie;
}
