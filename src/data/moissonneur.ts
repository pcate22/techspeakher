/**
 * Contenu (source unique) expliquant le moissonneur CFP aux speakeuses, affiché
 * dans les pages internes (profil : au moment du consentement ; espace membre :
 * à côté des « Talks repérés pour toi »). Le composant `MoissonneurExplainer`
 * le rend. Texte scanné par `french-spelling.test.ts`.
 */

export const MOISSONNEUR_TITRE = "Comment fonctionne le repérage de talks ?";

export const MOISSONNEUR_INTRO =
  "Beaucoup de conférences publient leur programme en ligne (Sessionize et d'autres). Une fois par jour, Tech Speak'Her parcourt ces programmes publics pour retrouver les talks donnés à ton nom et te les proposer, sans que tu aies à les ressaisir.";

export interface MoissonneurEtape {
  titre: string;
  detail: string;
}

export const MOISSONNEUR_ETAPES: MoissonneurEtape[] = [
  {
    titre: "On lit les programmes publics",
    detail:
      "Chaque jour, on parcourt le programme que les conférences publient elles-mêmes en ligne. On ne se connecte à aucun compte et on ne lit rien de privé.",
  },
  {
    titre: "Tu peux lancer le repérage tout de suite",
    detail:
      "Envie d'aller plus vite que le passage quotidien ? Clique « Lancer le repérage maintenant » et tes talks trouvés s'affichent dans la foulée. Une conférence manque au radar ? Propose-la juste en dessous : l'équipe la valide avant qu'elle rejoigne le radar.",
  },
  {
    titre: "On te reconnaît prudemment",
    detail:
      "On te rattache un talk si le lien Sessionize ou LinkedIn de ta fiche correspond, ou à défaut ton nom complet. En cas d'homonyme, on s'abstient : aucune proposition.",
  },
  {
    titre: "Tu gardes la main",
    detail:
      "Les talks trouvés apparaissent dans « Talks repérés pour toi ». Tu confirmes ceux qui sont à toi en un clic, tu écartes les autres. Un talk écarté n'est jamais reproposé.",
  },
  {
    titre: "On te prévient par e-mail",
    detail:
      "Quand de nouveaux talks sont repérés, tu reçois un e-mail récapitulatif : tout arrive à toi, sans passer par ton espace.",
  },
  {
    titre: "Tes talks confirmés restent à jour",
    detail:
      "Si une info change côté conférence (date, lieu), un talk que tu as confirmé est rafraîchi automatiquement, sans jamais écraser ce que tu as modifié à la main.",
  },
];

export const MOISSONNEUR_GARANTIES: string[] = [
  "Rien n'est publié sans ton accord.",
  "On n'utilise que des informations déjà publiques.",
  "Tu peux tout couper : décoche « Propose-moi les talks trouvés à mon nom » dans ton profil, et le repérage s'arrête.",
];
