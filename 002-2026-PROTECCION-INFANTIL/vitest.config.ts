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
        // CI (runner compartido, Postgres en contenedor) es ~2-4x más lento que
        // la Mac local: los tests con fixtures pesados (seed completo, tope
        // anual de referidos, digest) rozaban el default de 5s y flapeaban por
        // timeout sin fallo de lógica (observado en shards del mega-lote 2026-08-24).
        testTimeout: 20_000,
        // SPEC-174 (fix I-55): un fork POR ARCHIVO. El leak I-54 (spies/mocks del
        // singleton de Prisma filtrados entre archivos bajo singleFork) no puede
        // cruzar archivos cuando cada uno vive en su propio proceso. El mutex
        // TestMutex en BD sigue serializando el acceso entre procesos.
        pool: "forks",
        poolOptions: {
            forks: {
                singleFork: false,
            },
        },
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: ["node_modules/", ".next/", "prisma/"],
            // 002-PI-068 (Opción 2): ratchet por proyecto post-split. Pisos medidos el
            // 2026-08-17 con integration corriendo solo tests de BD. El ratchet solo
            // sube; bajar cualquier piso requiere decisión explícita de ZEUS.
            // H-1: mergear cobertura unit + integration queda como deuda técnica.
            thresholds: {
                statements: 36,
                branches: 71,
                functions: 49,
                lines: 36,
            },
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
