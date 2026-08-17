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
        // Los tests de componentes React comparten el DOM global de jsdom;
        // fileParallelism:false + sequence.concurrent:false evita races de DOM.
        fileParallelism: false,
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
