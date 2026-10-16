import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    // Node ≥ 25 pose une clé `localStorage` sur le global (`undefined` sans
    // --localstorage-file) ; Vitest n'écrase pas une clé déjà présente, donc
    // celui de jsdom n'était jamais installé. Flag accepté dès Node 22.4.
    execArgv: ["--no-experimental-webstorage"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      // Cible : la logique métier et les Server Actions (règle CLAUDE.md
      // « couvrir les Server Actions »). Rend les angles morts visibles via
      // `npm run test:coverage`, sans bloquer la CI par défaut.
      include: ["src/lib/**/*.ts", "src/app/**/actions.ts"],
      exclude: ["src/lib/db.ts", "**/*.d.ts"],
      reporter: ["text-summary", "html"],
    },
  },
});
