import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { UNIT_TEST_INCLUDES } from "./vitest.unit.includes";

/**
 * Configuración por defecto de Vitest: tests de integración con base de datos.
 * Los tests unitarios puros corren con vitest.unit.config.ts.
 */
export default defineConfig({
    plugins: [react()],
    test: {
        name: "integration",
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/lib/test-setup.ts"],
        include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
        exclude: [
            "tests/e2e/**",
            "**/*.spec.ts",
            "node_modules",
            ".next",
            // 002-PI-068: los unitarios corren en project/config aparte.
            ...UNIT_TEST_INCLUDES,
            // Los journeys tienen su propio job de CI.
            "src/lib/e2e/journeys/**/*.test.ts",
            "src/lib/e2e/journeys/**/*.test.tsx",
        ],
        // Tests de integración comparten una única base de datos PostgreSQL.
        // Ejecutarlos secuencialmente evita race conditions entre archivos.
        fileParallelism: false,
        // Los tests dentro de un mismo archivo también comparten la BD;
        // forzamos ejecución serial para evitar interferencias entre beforeEach.
        sequence: {
            concurrent: false,
            // Vitest 3 ejecuta los hooks (beforeEach/afterEach) en paralelo por
            // defecto; eso deja varios resetDatabase activos simultáneamente.
            hooks: "list",
        },
        // Los hooks de aislamiento de BD pueden necesitar más de 10s si el
        // test anterior dejó el lock huérfano o la BD está bajo carga.
        hookTimeout: 60_000,
        // Vitest 3.2.x ignora fileParallelism/sequence bajo carga; forzamos
        // ejecución en un único fork para que el mutex en BD serialice todos
        // los tests. vmThreads no sirve porque algunos tests usan módulos
        // vinculados que exigen el mismo contexto.
        pool: "forks",
        poolOptions: {
            forks: {
                singleFork: true,
            },
        },
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: ["node_modules/", ".next/", "prisma/"],
            // Q-2 (002-PI-056): ratchet de cobertura. El umbral solo sube; bajarlo requiere
            // decisión explícita de ZEUS. Se aplica al project integration (corrida más
            // completa). H-1: mergear cobertura unit + integration sigue pendiente.
            thresholds: {
                statements: 45,
                branches: 75,
                functions: 83,
                lines: 45,
            },
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
