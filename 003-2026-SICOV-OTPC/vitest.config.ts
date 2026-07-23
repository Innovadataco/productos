import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // exceljs (XLSX y su lector CSV) resuelve el build de navegador bajo jsdom → node
    // para el pipeline de mantenimientos y sus rutas (R13/D12 del spec 005).
    environmentMatchGlobs: [
      ["src/lib/mantenimientos/**", "node"],
      ["src/app/api/mantenimientos/**", "node"],
    ],
    globals: true,
    setupFiles: ["./src/lib/test-setup.ts"],
    // Los tests de integración comparten una única BD Postgres: corren secuencialmente.
    fileParallelism: false,
    exclude: ["node_modules/**", "legacy-sistema-original/**", "api/**", "web/**", "**/*.e2e.*"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
