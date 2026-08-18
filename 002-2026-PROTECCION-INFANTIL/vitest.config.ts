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
            // ─── EXCLUSIÓN TEMPORAL · I-55 leak recurrente prisma singleton bajo singleFork ───
            // Los 7 archivos víctima quedan fuera del CI hasta que SPEC-174 (fix arquitectónico
            // de fondo: aislamiento estricto de tests) los rehabilite. Ver 04-INCIDENCIAS I-55.
            // NO tocar sin coordinar con ZEUS.
            "src/app/api/admin/comite/apelaciones/route.test.ts",
            "src/app/api/admin/comite/apelaciones/[id]/documento/route.test.ts",
            "src/app/api/admin/ia/rubrica/route.test.ts",
            "src/app/api/admin/ia/rubrica/config/route.test.ts",
            "src/app/api/admin/ia/rubrica/preguntas/route.test.ts",
            "src/app/api/admin/permisos-modulos/route.test.ts",
            "src/app/api/reportes/route-atomicidad.test.ts",
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
