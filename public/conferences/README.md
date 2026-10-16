# Logos des conférences

Les icônes affichées à côté de chaque conférence sur une fiche speakeuse
(« ce talk, je l'ai donné à Devoxx, puis au DevFest Nantes… ») et sur la page
« Conférences & assos partenaires ».

## Ajouter un logo

1. Déposer le fichier ici, nommé d'après le **slug de la conférence** dans le
   registre (`conferences.slug`) : `devfest-toulouse.png`, `mixit.svg`…
   Format carré de préférence, ≤ 256 px, ≤ 40 Ko (SVG, PNG ou WebP).
2. Déclarer la ligne dans `src/data/logos-conferences.ts`.
3. `npm run test` : un test vérifie les deux sens (logo déclaré ↔ fichier
   présent), donc rien ne part en prod à moitié fait.

Le script `npm run logos:conferences` fait les deux premières étapes toute
seule pour les conférences du catalogue d'amorçage qui ont un `siteUrl` : il
récupère l'icône publiée par chaque site (`apple-touch-icon`, `icon`, à défaut
`/favicon.ico`) et affiche les lignes à coller dans le déclaratif.

Une conférence sans logo n'a **aucun trou** : elle s'affiche avec un monogramme
(ses initiales sur une pastille).

## Pourquoi ces fichiers sont-ils dans le dépôt ?

La CSP du site n'autorise que les images servies par notre propre domaine
(`img-src 'self'`) : pointer le logo hébergé chez la conférence serait bloqué,
et l'autoriser ferait fuiter l'IP de chaque visiteuse vers les sites des confs.

Ces logos restent la propriété de leurs titulaires et sont reproduits ici pour
**identifier** l'événement. Une conférence qui souhaite le retrait du sien nous
écrit : on supprime le fichier et sa ligne, l'affichage retombe seul sur le
monogramme.
