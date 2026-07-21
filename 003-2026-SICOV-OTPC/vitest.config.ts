import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
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
