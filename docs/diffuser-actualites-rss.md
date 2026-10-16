# Diffuser les actualités — flux RSS

Le site publie un **flux RSS** : la liste des actualités dans un format que les
outils savent lire, exposé à `/feed.xml`. En branchant ce flux à un service
tiers, chaque nouvelle actu se republie ailleurs automatiquement.

> **Votre flux : `https://techspeakher.fr/feed.xml`**

Implémentation : `src/app/feed.xml/route.ts` (RSS 2.0, lit `src/data/actualites`).

## À savoir : le flux est statique pour l'instant

Aujourd'hui les actualités sont figées dans le site (`src/data/actualites`). Le
flux se met à jour **au moment d'une mise en ligne** qui ajoute une actu, pas en
temps réel. C'est déjà suffisant pour tout ce qui suit.

Quand les « actualités dynamiques » (chantier de conception séparé) arriveront,
le flux deviendra instantané, sans redéploiement. Le reste de ce guide restera
valable tel quel.

## Par où commencer

Le plus rentable, c'est **LinkedIn** : c'est là que republier à la main coûte le
plus de temps, et c'est le plus simple à automatiser. Commencez par là, ajoutez
le reste ensuite.

## Les canaux, du plus simple au plus exigeant

### LinkedIn — Facile

Republier chaque nouvelle actu sur la page ou le profil, automatiquement.

1. Créez un compte sur [Zapier](https://zapier.com) (gratuit pour démarrer).
2. Nouveau « Zap » → déclencheur **RSS by Zapier** → « New Item in Feed » →
   collez `https://techspeakher.fr/feed.xml`.
3. Action → **LinkedIn** → « Create Share Update ». Composez le texte à partir
   des champs de l'actu (titre, description, lien).
4. Testez avec la dernière actu, puis activez le Zap.

**Sans Zapier :** [Buffer](https://buffer.com) crée aussi des posts depuis un
flux RSS, avec une file d'attente à valider avant publication. Pour publier sur
une **Page** (et pas un profil), il faut en être administratrice.

### Newsletter par e-mail — Facile à moyen

Un e-mail part tout seul aux abonnées quand une actu paraît.

1. Dans **Brevo** (déjà utilisé pour les e-mails du site), cherchez les
   campagnes / automatisations de type **RSS**.
2. Collez le flux `techspeakher.fr/feed.xml` et choisissez la fréquence
   (dès qu'il y a du nouveau, ou un récap hebdomadaire).
3. Choisissez le gabarit d'e-mail et la liste de destinataires (uniquement des
   personnes qui ont accepté de recevoir vos mails).
4. Activez.

**Si l'offre Brevo ne propose pas le RSS :** [Mailchimp](https://mailchimp.com)
a un « RSS-to-Email » gratuit, ou passez par Zapier (RSS → « ajouter un
contact / envoyer un e-mail » Brevo).

### WhatsApp — Plus exigeant

Possible, mais moins « plug-and-play » que les réseaux. Deux voies :

- **Le plus simple, à la main :** créez un **Canal WhatsApp** (diffusion à sens
  unique) et postez-y vous-même quand une actu sort. Zéro configuration, mais
  manuel.
- **Automatisé, via l'API WhatsApp Business :** techniquement faisable
  (Zapier + un fournisseur comme **Twilio** ou 360dialog), mais ça demande un
  compte **WhatsApp Business API**, des numéros qui ont **donné leur accord**, et
  des **modèles de message validés par Meta**. Plus de mise en place, parfois un
  coût. À réserver si le besoin est vraiment fort.

**Reco :** commencez par le canal manuel ; on automatisera si ça vaut le coup.

### Discord / Slack de la communauté — Facile

Poster les nouvelles actus dans un salon, pour l'équipe ou la communauté.

Un scénario Zapier « RSS → Discord » (ou Slack) publie chaque nouvel item dans
le salon choisi, via un simple lien de connexion (webhook). Même logique que
LinkedIn, en trois clics de plus.

## Le principe en une phrase

Le flux est le « robinet » commun : chaque outil (LinkedIn, newsletter,
WhatsApp, Discord) vient s'y brancher. Vous publiez une fois sur le site, ça se
diffuse partout où un tuyau est branché.

Quand les actualités deviendront dynamiques, ces diffusions se déclencheront en
temps réel, sans mise en ligne.
