import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { UNIT_TEST_INCLUDES } from "./vitest.unit.includes";

/**
 * Configuración de Vitest para tests unitarios (sin base de datos).
 * Corre en paralelo sin singleFork ni mutex de BD.
 */
export default defineConfig({
    plugins: [react()],
    test: {
        name: "unit",
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/lib/test-setup-unit.ts"],
        include: UNIT_TEST_INCLUDES,
        exclude: [],
        pool: "forks",
        // 002-PI-068: pool:forks da a cada archivo su propio fork/DOM; el paralelismo
        // entre archivos es seguro. sequence.concurrent:false protege el orden dentro
        // de un mismo archivo.
        sequence: {
            concurrent: false,
            hooks: "list",
        },
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: ["node_modules/", ".next/", "prisma/"],
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
