/**
 * SPEC-251 (002-PI-154 · I-49) — Tests unitarios del guardián de índices.
 *
 * Unit: verifica la lógica de clasificación de tipos (HNSW, GIN, btree, unique)
 * usando datos sintéticos — sin BD real.
 *
 * Cobertura:
 *  SC-001  todos los índices ok → resultado.ok = true
 *  SC-002  índice faltante → missing[] + ok = false
 *  SC-003  tipo incorrecto (hnsw → btree) → wrongType[] + ok = false
 *  SC-004  índice huérfano → orphans[] + ok = true (no bloquea)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { REQUIRED, verificarIndices, type IndiceRequerido } from "./verify-hnsw-indexes";

// ────────────────────────────────────────────────────────────────────────────
// Stub del cliente Prisma: devolvemos filas sintéticas sin tocar la BD.
// ────────────────────────────────────────────────────────────────────────────

// Fila "sana" para cada índice requerido, con indexdef correcto según su tipo.
function filaOk(req: IndiceRequerido): { indexname: string; indexdef: string; isunique: boolean } {
    let indexdef: string;
    if (req.type === "hnsw")        indexdef = `CREATE INDEX "${req.name}" ON "${req.table}" USING hnsw (vector vector_cosine_ops)`;
    else if (req.type === "gin")    indexdef = `CREATE INDEX "${req.name}" ON "${req.table}" USING gin ("nombreNormalizado" gin_trgm_ops)`;
    else if (req.type === "btree")  indexdef = `CREATE INDEX "${req.name}" ON "${req.table}" USING btree ("patronInstitucionalId")`;
    else                            indexdef = `CREATE UNIQUE INDEX "${req.name}" ON "${req.table}" ("a", "b")`;
    return { indexname: req.name, indexdef, isunique: req.type === "unique" };
}

// Todas las filas sanas por defecto.
function todasSanas(): { indexname: string; indexdef: string; isunique: boolean }[] {
    return REQUIRED.map(filaOk);
}

type FilaSana = { indexname: string; indexdef: string; isunique: boolean };

// Inyecta el mock de prisma.$queryRaw antes de cada test.
vi.mock("../src/lib/prisma", () => {
    let mockRows: FilaSana[] = [];
    const queryRaw = vi.fn(async () => mockRows);
    const prisma = {
        $queryRaw: queryRaw,
        $disconnect: vi.fn(async () => undefined),
    };
    // Exponer setter para configurar el mock por test.
    (prisma as unknown as { __setRows: (rows: FilaSana[]) => void }).__setRows = (r: FilaSana[]) => {
        mockRows = r;
        queryRaw.mockResolvedValue(r);
    };
    return { prisma };
});

async function getPrisma() {
    const mod = await import("../src/lib/prisma");
    return mod.prisma as unknown as {
        $queryRaw: ReturnType<typeof vi.fn>;
        __setRows: (rows: FilaSana[]) => void;
    };
}

beforeEach(async () => {
    const p = await getPrisma();
    p.__setRows(todasSanas());
});

// ────────────────────────────────────────────────────────────────────────────
// SC-001: BD sana — todos los 5 índices presentes y con tipo correcto.
// ────────────────────────────────────────────────────────────────────────────
describe("verificarIndices — BD sana", () => {
    it("devuelve ok=true con 5 índices presentes (SC-001)", async () => {
        const res = await verificarIndices();
        expect(res.ok).toBe(true);
        expect(res.missing).toHaveLength(0);
        expect(res.wrongType).toHaveLength(0);
        expect(res.durationMs).toBeGreaterThanOrEqual(0);
        expect(res.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// SC-002: falta un índice esperado → ok=false, aparece en missing[].
// ────────────────────────────────────────────────────────────────────────────
describe("verificarIndices — índice faltante", () => {
    it("detecta Ciudad_nombreNormalizado_trgm_idx faltante (SC-002)", async () => {
        const p = await getPrisma();
        p.__setRows(todasSanas().filter((r) => r.indexname !== "Ciudad_nombreNormalizado_trgm_idx"));
        const res = await verificarIndices();
        expect(res.ok).toBe(false);
        expect(res.missing).toContain("Ciudad_nombreNormalizado_trgm_idx");
    });

    it("detecta índice HNSW faltante (SC-002)", async () => {
        const p = await getPrisma();
        p.__setRows(todasSanas().filter((r) => r.indexname !== "EmbeddingReporte_vector_idx"));
        const res = await verificarIndices();
        expect(res.ok).toBe(false);
        expect(res.missing).toContain("EmbeddingReporte_vector_idx");
    });

    it("detecta índice unique truncado faltante (SC-002)", async () => {
        const p = await getPrisma();
        p.__setRows(
            todasSanas().filter(
                (r) => r.indexname !== "patrones_institucionales_colegioId_periodo_grado_conducta_p_key"
            )
        );
        const res = await verificarIndices();
        expect(res.ok).toBe(false);
        expect(res.missing).toContain("patrones_institucionales_colegioId_periodo_grado_conducta_p_key");
    });
});

// ────────────────────────────────────────────────────────────────────────────
// SC-003: tipo incorrecto (hnsw degradado a btree) → ok=false, en wrongType[].
// ────────────────────────────────────────────────────────────────────────────
describe("verificarIndices — tipo incorrecto", () => {
    it("detecta HNSW degradado a btree (SC-003)", async () => {
        const p = await getPrisma();
        const filas = todasSanas().map((r) => {
            if (r.indexname === "EmbeddingDataset_vector_idx") {
                return { ...r, indexdef: r.indexdef.replace("USING hnsw", "USING btree") };
            }
            return r;
        });
        p.__setRows(filas);
        const res = await verificarIndices();
        expect(res.ok).toBe(false);
        expect(res.wrongType.map((w) => w.name)).toContain("EmbeddingDataset_vector_idx");
        expect(res.wrongType.find((w) => w.name === "EmbeddingDataset_vector_idx")?.expected).toBe("hnsw");
    });

    it("detecta GIN degradado a btree (SC-003)", async () => {
        const p = await getPrisma();
        const filas = todasSanas().map((r) => {
            if (r.indexname === "Ciudad_nombreNormalizado_trgm_idx") {
                return { ...r, indexdef: r.indexdef.replace("USING gin", "USING btree") };
            }
            return r;
        });
        p.__setRows(filas);
        const res = await verificarIndices();
        expect(res.ok).toBe(false);
        expect(res.wrongType.map((w) => w.name)).toContain("Ciudad_nombreNormalizado_trgm_idx");
    });

    it("detecta unique convertido a no-unique (SC-003)", async () => {
        const p = await getPrisma();
        const filas = todasSanas().map((r) => {
            if (r.indexname === "patrones_institucionales_colegioId_periodo_grado_conducta_p_key") {
                return { ...r, isunique: false };
            }
            return r;
        });
        p.__setRows(filas);
        const res = await verificarIndices();
        expect(res.ok).toBe(false);
        expect(res.wrongType.map((w) => w.name)).toContain(
            "patrones_institucionales_colegioId_periodo_grado_conducta_p_key"
        );
    });
});

// ────────────────────────────────────────────────────────────────────────────
// SC-004: índice huérfano → advertencia, ok=true (no bloquea el flujo).
// ────────────────────────────────────────────────────────────────────────────
describe("verificarIndices — índice huérfano", () => {
    it("huérfano no declarado produce advertencia pero ok=true (SC-004)", async () => {
        const p = await getPrisma();
        p.__setRows([
            ...todasSanas(),
            {
                indexname: "AlgunaTabla_campo_experimental_idx",
                indexdef: "CREATE INDEX AlgunaTabla_campo_experimental_idx ON AlgunaTabla USING btree (campo)",
                isunique: false,
            },
        ]);
        const res = await verificarIndices();
        expect(res.ok).toBe(true);
        expect(res.orphans).toContain("AlgunaTabla_campo_experimental_idx");
    });
});

// ────────────────────────────────────────────────────────────────────────────
// Verificar que REQUIRED tiene exactamente los 5 índices esperados.
// ────────────────────────────────────────────────────────────────────────────
describe("REQUIRED constante", () => {
    it("contiene exactamente 5 índices", () => {
        expect(REQUIRED).toHaveLength(5);
    });

    it("incluye el índice truncado de patrones_institucionales con nombre real", () => {
        const truncado = REQUIRED.find(
            (r) => r.name === "patrones_institucionales_colegioId_periodo_grado_conducta_p_key"
        );
        expect(truncado).toBeDefined();
        expect(truncado!.type).toBe("unique");
        expect(truncado!.name.length).toBeLessThanOrEqual(63);
    });

    it("todos los índices tienen tipo válido", () => {
        const tiposValidos = ["btree", "gin", "hnsw", "unique"];
        for (const req of REQUIRED) {
            expect(tiposValidos).toContain(req.type);
        }
    });
});
