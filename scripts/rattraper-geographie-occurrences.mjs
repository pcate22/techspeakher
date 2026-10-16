// Remplit `code_insee` et `region` des occurrences qui n'en ont pas encore,
// en interrogeant la Base Adresse Nationale sur leur ville.
//
// POURQUOI CE SCRIPT EXISTE
// La migration 072 ajoute deux colonnes vides. Les occurrences déjà saisies —
// et toutes celles qui viennent d'un import, où la ville n'est qu'un texte —
// n'ont aucune géographie exploitable. Sans rattrapage, la facette « région »
// ne montrerait que les dates saisies APRÈS la migration, ce qui donnerait un
// agenda qui a l'air incomplet sans dire pourquoi.
//
// TROIS RÈGLES, ET ELLES SONT VOLONTAIRES
//
// 1. IL NE REMPLIT QUE LE VIDE. `WHERE code_insee IS NULL` : jamais il ne
//    réécrit une ville, ni une géographie déjà posée. Une speakeuse qui a
//    corrigé son lieu à la main garde le dernier mot sur une machine.
// 2. IL EST REJOUABLE. Deux exécutions de suite donnent le même état : la
//    seconde ne trouve plus rien à faire. C'est ce qui permet de le relancer
//    après un incident réseau sans se demander où il en était.
// 3. UNE VILLE INCONNUE DE LA BAN N'EST PAS UNE ERREUR. La BAN ne couvre que
//    la France : Bruxelles, Genève et Montréal restent sans code, et c'est le
//    résultat CORRECT — la règle d'affichage les range en « International ».
//
// Usage : DATABASE_URL=… node scripts/rattraper-geographie-occurrences.mjs
//         DATABASE_URL=… node scripts/rattraper-geographie-occurrences.mjs --essai
//
// `--essai` n'écrit rien et affiche ce qui serait fait : sur des données de
// vraies personnes, on regarde avant de toucher.

import pg from "pg";
// La règle de CHOIX vit dans le lib, où elle est éprouvée sans réseau
// (`src/__tests__/commune-retenue.test.ts`) : c'est elle qui décide d'écrire
// dans les données de quelqu'un, elle n'a pas à vivre dans un script.
import { communeRetenue, regionFromContext } from "../src/lib/communes.ts";

const ESSAI = process.argv.includes("--essai");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL absent : rattrapage impossible.");
  process.exit(1);
}

const BAN_URL = "https://api-adresse.data.gouv.fr/search/";

/** Ce que la BAN propose pour ce nom, projeté au format du lib. */
async function candidates(ville) {
  const url = `${BAN_URL}?q=${encodeURIComponent(ville)}&type=municipality&limit=5`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`BAN ${res.status}`);
  const data = await res.json();
  return (data.features ?? []).map((f) => ({
    nom: f.properties?.name ?? "",
    codePostal: f.properties?.postcode ?? "",
    codeInsee: f.properties?.citycode ?? "",
    region: regionFromContext(f.properties?.context),
  }));
}

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 20_000 });
await client.connect();

try {
  // Une requête par VILLE distincte, pas par occurrence : dix dates à Toulouse
  // ne justifient pas dix appels à un service public gratuit.
  const { rows: villes } = await client.query(
    `SELECT DISTINCT trim(ville) AS ville
       FROM talk_occurrences
      WHERE code_insee IS NULL
        AND ville IS NOT NULL AND trim(ville) <> ''
      ORDER BY 1`,
  );
  console.log(`${villes.length} ville(s) distincte(s) à résoudre.`);

  let resolues = 0;
  let inconnues = 0;
  let lignes = 0;

  for (const { ville } of villes) {
    let commune = null;
    try {
      commune = communeRetenue(ville, await candidates(ville));
    } catch (err) {
      // Un incident réseau ne doit PAS interrompre le rattrapage : on passe, et
      // la prochaine exécution reprendra cette ville (le script est rejouable).
      console.warn(`  ${ville} : BAN indisponible (${err.message}), passée.`);
      continue;
    }

    if (!commune) {
      inconnues++;
      console.log(`  ${ville} : hors France ou ambiguë → laissée vide (correct).`);
      continue;
    }

    resolues++;
    if (ESSAI) {
      console.log(`  ${ville} → ${commune.codeInsee} / ${commune.region} (essai)`);
      continue;
    }
    // `code_insee IS NULL` à nouveau ICI : entre la lecture et l'écriture, une
    // speakeuse a pu enregistrer sa propre géographie. Elle garde le dernier mot.
    const { rowCount } = await client.query(
      `UPDATE talk_occurrences
          SET code_insee = $1, region = $2
        WHERE code_insee IS NULL AND trim(ville) = $3`,
      [commune.codeInsee, commune.region, ville],
    );
    lignes += rowCount ?? 0;
    console.log(`  ${ville} → ${commune.codeInsee} / ${commune.region} (${rowCount} ligne(s))`);
  }

  console.log(
    `\n${resolues} ville(s) résolue(s), ${inconnues} laissée(s) vide(s), ` +
      `${lignes} occurrence(s) mise(s) à jour${ESSAI ? " (ESSAI : rien écrit)" : ""}.`,
  );
} catch (err) {
  console.error("Rattrapage en échec :", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
