import path from "path";
import { defineConfig } from "vitest/config";

/**
 * Vitest del 006: tests unitarios puros (sin BD ni red) en tests/unit.
 * Entorno node y alias "@" → ./src para que los módulos de src/lib
 * resuelvan igual que en Next. Los tests de integración/E2E tendrán su
 * propia config cuando existan (tests/integration · tests/e2e).
 */
export default defineConfig({
    test: {
        environment: "node",
        include: ["tests/unit/**/*.test.ts"],
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
