/**
 * SPEC-251 (002-PI-154 · I-49) — Test de integración: probeIndices() contra BD real.
 *
 * Crea la BD desde cero con todas las migraciones y verifica que los 5 índices
 * críticos existen con su tipo correcto (SC-001, SC-008).
 * También prueba que un índice faltante produce ok=false (SC-002) y que
 * un tipo incorrecto produce ok=false (SC-003).
 *
 * Requiere: .env.test con DATABASE_URL apuntando a la BD de prueba.
 * Corre con: node --env-file=.env.test node_modules/.bin/vitest run src/lib/monitoreo/probe-indices.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { MonitoreoRepository } from "@/lib/dal/repositories/monitoreo";
import { probeIndices } from "./probes";

beforeAll(async () => {
    // La BD de test ya tiene todas las migraciones aplicadas (resetDatabase solo trunca datos).
    // Los índices declarados por SQL crudo en las migraciones persisten tras TRUNCATE.
    await resetDatabase();
});

afterAll(async () => {
    await prisma.$disconnect();
});

// ────────────────────────────────────────────────────────────────────────────
// SC-001 / SC-008: BD sana — todos los 5 índices presentes con tipo correcto.
// ────────────────────────────────────────────────────────────────────────────
describe("probeIndices — BD de test con todas las migraciones (SC-001, SC-008)", () => {
    it("reporta ok=true y los 5 índices presentes en BD real", async () => {
        const resultado = await probeIndices();
        expect(resultado.ok).toBe(true);
        expect(resultado.detalle).toContain("5 índices presentes");
        expect(resultado.latenciaMs).toBeLessThan(2000); // SC-009: <2s
    });

    it("leerIndicesPublicos devuelve al menos los 5 índices críticos (SC-008)", async () => {
        const repo = new MonitoreoRepository();
        const filas = await repo.leerIndicesPublicos();
        const nombres = filas.map((f) => f.indexname);

        const esperados = [
            "Ciudad_nombreNormalizado_trgm_idx",
            "EmbeddingDataset_vector_idx",
            "EmbeddingReporte_vector_idx",
            "AlertaColegio_patronInstitucionalId_idx",
            "patrones_institucionales_colegioId_periodo_grado_conducta_p_key",
        ];

        for (const nombre of esperados) {
            expect(nombres, `índice ${nombre} debe existir en BD real`).toContain(nombre);
        }
    });

    it("el índice GIN de ciudades tiene tipo gin (SC-008)", async () => {
        const repo = new MonitoreoRepository();
        const filas = await repo.leerIndicesPublicos();
        const idx = filas.find((f) => f.indexname === "Ciudad_nombreNormalizado_trgm_idx");
        expect(idx).toBeDefined();
        expect((idx!.indexdef ?? "").toLowerCase()).toContain("using gin");
    });

    it("los índices HNSW tienen tipo hnsw (SC-008)", async () => {
        const repo = new MonitoreoRepository();
        const filas = await repo.leerIndicesPublicos();
        for (const nombre of ["EmbeddingDataset_vector_idx", "EmbeddingReporte_vector_idx"]) {
            const idx = filas.find((f) => f.indexname === nombre);
            expect(idx, `${nombre} debe existir`).toBeDefined();
            expect((idx!.indexdef ?? "").toLowerCase(), `${nombre} debe ser HNSW`).toContain("using hnsw");
        }
    });

    it("el índice unique de patrones_institucionales es unique (SC-008)", async () => {
        const repo = new MonitoreoRepository();
        const filas = await repo.leerIndicesPublicos();
        const idx = filas.find(
            (f) => f.indexname === "patrones_institucionales_colegioId_periodo_grado_conducta_p_key"
        );
        expect(idx, "índice unique de patrones debe existir").toBeDefined();
        expect(idx!.isunique, "debe ser unique").toBe(true);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// SC-002: simular índice faltante con repo stub.
// ────────────────────────────────────────────────────────────────────────────
describe("probeIndices — índice faltante (SC-002)", () => {
    it("reporta ok=false cuando Ciudad_nombreNormalizado_trgm_idx no aparece", async () => {
        // Stub del repo: omitir el índice de ciudades.
        const repoStub = {
            leerIndicesPublicos: async () => {
                const repo = new MonitoreoRepository();
                const filas = await repo.leerIndicesPublicos();
                return filas.filter((f) => f.indexname !== "Ciudad_nombreNormalizado_trgm_idx");
            },
        } as unknown as MonitoreoRepository;

        const resultado = await probeIndices({ repo: repoStub });
        expect(resultado.ok).toBe(false);
        expect(resultado.detalle).toContain("Ciudad_nombreNormalizado_trgm_idx");
    });
});

// ────────────────────────────────────────────────────────────────────────────
// SC-003: simular tipo incorrecto con repo stub.
// ────────────────────────────────────────────────────────────────────────────
describe("probeIndices — tipo incorrecto (SC-003)", () => {
    it("reporta ok=false cuando un HNSW aparece como btree", async () => {
        const repoStub = {
            leerIndicesPublicos: async () => {
                const repo = new MonitoreoRepository();
                const filas = await repo.leerIndicesPublicos();
                return filas.map((f) => {
                    if (f.indexname === "EmbeddingReporte_vector_idx") {
                        return {
                            ...f,
                            indexdef: (f.indexdef ?? "").replace(/using hnsw/i, "USING btree"),
                        };
                    }
                    return f;
                });
            },
        } as unknown as MonitoreoRepository;

        const resultado = await probeIndices({ repo: repoStub });
        expect(resultado.ok).toBe(false);
        expect(resultado.detalle).toContain("EmbeddingReporte_vector_idx");
    });
});
