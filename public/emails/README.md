# Images des e-mails

Les captures d'écran affichées dans les e-mails envoyés à la communauté (une
annonce = un dossier daté, ex. `nouveautes-2026-08/`).

## Pourquoi dans le dépôt ?

Un e-mail affiche des images **distantes** : elles sont donc servies par notre
domaine (`techspeakher.fr/emails/…`), comme les logos de conférences. Passer par
un hébergeur tiers ferait fuiter vers lui l'adresse IP de chaque personne qui
ouvre l'e-mail, et l'image mourrait avec le compte. Les clients e-mail bloquent
souvent les images par défaut : chaque nouveauté se comprend **sans** sa
capture, et chaque `<img>` porte une alternative textuelle (déclarée avec le
contenu, dans `src/data/nouveautes-plateforme.ts`).

## Comment elles sont produites

Rendu de l'app en local (Chromium, largeur 900 px, densité 2×), cadré sur la
section qui illustre la nouveauté, puis réduit à 1 120 px (l'e-mail les affiche
à 560 px). **Jeu de démonstration** : les comptes visibles sur les captures
(« Camille Exemple », « Lina Exemple », « Sarah Exemple ») sont fictifs — aucune
fiche réelle, aucune donnée personnelle de la communauté n'apparaît ici.
