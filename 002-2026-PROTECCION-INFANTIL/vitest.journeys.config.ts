import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Configuración de Vitest para journeys de rol (src/lib/e2e/journeys/).
 * Requiere base de datos y el mismo aislamiento de BD que integration.
 */
export default defineConfig({
    plugins: [react()],
    test: {
        name: "journeys",
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/lib/test-setup.ts"],
        include: ["src/lib/e2e/journeys/**/*.test.ts", "src/lib/e2e/journeys/**/*.test.tsx"],
        exclude: ["node_modules", ".next"],
        fileParallelism: false,
        sequence: {
            concurrent: false,
            hooks: "list",
        },
        hookTimeout: 60_000,
        pool: "forks",
        poolOptions: {
            forks: {
                singleFork: true,
            },
        },
        coverage: {
            enabled: false,
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
