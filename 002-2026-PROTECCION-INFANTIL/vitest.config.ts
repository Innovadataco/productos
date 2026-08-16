import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/lib/test-setup.ts"],
        exclude: ["tests/e2e/**", "**/*.spec.ts", "node_modules", ".next"],
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
            // Q-2 (002-PI-056): piso = cobertura real medida 2026-08-01 (stmts 43.8 / branch 74.1 / funcs 81.0),
            // con 1 pt de margen en functions por jitter entre corridas (80.96–81.02).
            // 2026-08-01 (SPEC-133): los journeys por rol suben la cobertura a 44.4/74.2/81.7/44.4 — el piso sube.
            // 2026-08-01 (SPEC-134): los repos DAL del colegio suben functions a 82.3 — el piso sube a 82.
            // 2026-08-02 (E-8): la migración DAL completa sube la cobertura a 45.3/75.2/83.2/45.3 — el piso sube.
            // Ratchet: el umbral solo sube; bajarlo requiere decisión explícita de ZEUS.
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