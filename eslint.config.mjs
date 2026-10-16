import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Autorise les variables préfixées _ (idiome standard TS pour
  // discard, paramètres requis par une signature mais non utilisés…).
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  /**
   * UN SEUL LANDMARK PRINCIPAL PAR PAGE (RGAA 12.6, WCAG 1.3.1 / 2.4.1).
   *
   * `src/app/layout.tsx` enveloppe déjà tout le contenu dans
   * `<main id="main-content">`, cible du lien d'évitement. Une page qui pose son
   * propre `<main>` en imbrique un second : HTML invalide, et trois violations
   * axe mesurées en navigateur (`landmark-main-is-top-level`,
   * `landmark-no-duplicate-main`, `landmark-unique`). « Aller au contenu
   * principal » devient ambigu pour une lectrice d'écran.
   *
   * La dette avait repoussé jusqu'à 57 pages et 2 gabarits. Cinq fichiers
   * portaient déjà le bon commentaire : la règle était connue, elle n'était
   * gardée nulle part. La porte axe de la CI ne pouvait pas la voir — axe range
   * ces règles en « best-practice », hors des tags WCAG A/AA qu'elle interroge.
   *
   * Ici plutôt que dans un test qui balaie les sources : ESLint lit l'AST (une
   * regex de ligne rate `<main` dont les attributs passent à la ligne, la forme
   * que Prettier produit), signale à la frappe, et couvre tout le dépôt. Les
   * tests sont exclus : ils rendent des composants isolés et se fabriquent un
   * `<main>` de substitution pour ne pas déclencher la règle « region » d'axe.
   */
  {
    files: ["**/*.tsx"],
    ignores: ["src/app/layout.tsx", "src/__tests__/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: 'JSXOpeningElement > JSXIdentifier[name="main"]',
          message:
            "Landmark principal : src/app/layout.tsx le pose déjà pour toute la page. Rendre un <div>.",
        },
        {
          selector: 'JSXSelfClosingElement > JSXIdentifier[name="main"]',
          message:
            "Landmark principal : src/app/layout.tsx le pose déjà pour toute la page. Rendre un <div>.",
        },
        {
          selector: 'JSXAttribute[name.name="role"][value.value="main"]',
          message: 'role="main" pose un second landmark principal, au même titre que <main>.',
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Rapport de couverture généré (HTML/JS) : jamais à linter.
    "coverage/**",
  ]),
]);

export default eslintConfig;
