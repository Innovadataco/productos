// tests/unit/bi-capacidad.test.ts · Contrato de src/lib/bi/capacidad.ts
// Producto 006 · BI v2 · AGENTE C (capacidad operativa)
// Unitarios puros: prisma.$queryRaw y getConfig mockeados — sin BD, sin red.
// Cubre la situación REAL de la réplica demo (candado 9): 135 reportes en
// REVISION_MANUAL + 846 alertas sin asignar con CERO operarios con casos —
// la brecha se muestra (demandaExcede + mensaje honesto), no se disimula.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRawMock, getConfigMock } = vi.hoisted(() => ({
    queryRawMock: vi.fn(),
    getConfigMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: queryRawMock } }));
vi.mock("@/lib/config", () => ({ getConfig: getConfigMock }));

import {
    alertasSinAsignarPorColegio,
    getCapacidad,
    pseudonimoOperario,
    semaforoCapacidad,
    type CapacidadData,
} from "@/lib/bi/capacidad";

/** getConfig devuelve null (defaults) salvo los overrides dados. */
function configCon(overrides: Record<string, string> = {}) {
    getConfigMock.mockImplementation(async (clave: string) => overrides[clave] ?? null);
}

/**
 * Encola las tres respuestas de $queryRaw en el orden fijo de getCapacidad:
 * revisión manual → alertas agregadas → casos por operario.
 */
function bdCon(
    revisionManual: number,
    alertas: { sin_asignar: number; operarios_con_casos: number },
    porOperario: { operario_id: string; activos: number }[] = [],
) {
    queryRawMock.mockReset();
    queryRawMock
        .mockResolvedValueOnce([{ total: revisionManual }])
        .mockResolvedValueOnce([alertas])
        .mockResolvedValueOnce(porOperario);
}

beforeEach(() => {
    vi.clearAllMocks();
    configCon();
});

describe("getCapacidad · situación real de la demo (candado 9)", () => {
    it("0 operarios con 135 en revisión manual y 846 sin asignar: la brecha se dice en la cara", async () => {
        bdCon(135, { sin_asignar: 846, operarios_con_casos: 0 });
        const c = await getCapacidad();

        expect(c.revisionManual).toBe(135);
        expect(c.alertasSinAsignar).toBe(846);
        expect(c.operariosConCasos).toBe(0);
        expect(c.casosPorOperario).toEqual([]);
        expect(c.capacidadMaxPorOperario).toBe(25); // default B3 sin config
        expect(c.demandaExcede).toBe(true); // 981 > 0 × 25
        expect(c.mensaje).toBe(
            "No hay operarios asignados: 981 casos activos acumulados sin capacidad de gestión",
        );
        expect(semaforoCapacidad(c)).toBe("rubi");
    });

    it("vacío total (réplica sin demanda): honesto, sin brecha inventada", async () => {
        bdCon(0, { sin_asignar: 0, operarios_con_casos: 0 });
        const c = await getCapacidad();

        expect(c.demandaExcede).toBe(false);
        expect(c.mensaje).toBe(
            "Sin casos activos acumulados: no hay demanda pendiente de gestión.",
        );
        expect(semaforoCapacidad(c)).toBe("pino");
    });
});

describe("getCapacidad · brecha demanda vs. capacidad visible", () => {
    it("con operarios y holgura: demandaExcede=false y mensaje de capacidad suficiente", async () => {
        bdCon(10, { sin_asignar: 5, operarios_con_casos: 2 }, [
            { operario_id: "cmabc1234defgh0001aaaa", activos: 8 },
            { operario_id: "cmabc1234defgh0001bbbb", activos: 4 },
        ]);
        const c = await getCapacidad();

        expect(c.demandaExcede).toBe(false); // 15 ≤ 2 × 25
        expect(c.mensaje).toBe(
            "Capacidad visible suficiente: 15 casos activos frente a un cupo de 50 (2 operarios)",
        );
        expect(semaforoCapacidad(c)).toBe("pino");
        expect(c.casosPorOperario.map((o) => o.activos)).toEqual([8, 4]);
    });

    it("demanda por encima del cupo con operarios: excede y mensaje de superación", async () => {
        bdCon(20, { sin_asignar: 11, operarios_con_casos: 1 }, [
            { operario_id: "cmabc1234defgh0001aaaa", activos: 25 },
        ]);
        const c = await getCapacidad();

        expect(c.demandaExcede).toBe(true); // 31 > 1 × 25
        expect(c.mensaje).toBe(
            "La demanda (31 casos activos) supera la capacidad visible: 1 operario con cupo para 25 casos",
        );
        expect(semaforoCapacidad(c)).toBe("rubi");
    });

    it("cerca del límite (≥80% del cupo sin superarlo): ambar, no rubí", async () => {
        bdCon(0, { sin_asignar: 22, operarios_con_casos: 1 }, [
            { operario_id: "cmabc1234defgh0001aaaa", activos: 3 },
        ]);
        const c = await getCapacidad();

        expect(c.demandaExcede).toBe(false); // 22 ≤ 25
        expect(c.mensaje).toBe(
            "Capacidad visible al límite: 22 casos activos frente a un cupo de 25 (1 operario)",
        );
        expect(semaforoCapacidad(c)).toBe("ambar");
    });

    it("cupo desde bi_config pisa el default (B3)", async () => {
        configCon({ "bi.capacidad.casos_max_operario": "10" });
        bdCon(0, { sin_asignar: 25, operarios_con_casos: 2 });
        const c = await getCapacidad();

        expect(c.capacidadMaxPorOperario).toBe(10);
        expect(c.demandaExcede).toBe(true); // 25 > 2 × 10
    });

    it("config inválida cae al default documentado (25)", async () => {
        configCon({ "bi.capacidad.casos_max_operario": "cero" });
        bdCon(0, { sin_asignar: 0, operarios_con_casos: 1 });
        const c = await getCapacidad();
        expect(c.capacidadMaxPorOperario).toBe(25);
    });

    it("un sondeo roto degrada a ceros con warn, sin inventar datos ni reventar", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        queryRawMock.mockReset();
        queryRawMock
            .mockRejectedValueOnce(new Error("réplica caída"))
            .mockResolvedValueOnce([{ sin_asignar: 7, operarios_con_casos: 1 }])
            .mockResolvedValueOnce([{ operario_id: "cmabc1234defgh0001aaaa", activos: 2 }]);
        const c = await getCapacidad();

        expect(c.revisionManual).toBe(0); // degradado, no inventado
        expect(c.alertasSinAsignar).toBe(7);
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
    });
});

describe("pseudonimización de operarios (Ley 1581 · PII)", () => {
    it("el seudónimo jamás contiene el cuid completo ni resuelve identidad", async () => {
        const cuid = "cmabc1234defgh0001wxyz";
        bdCon(0, { sin_asignar: 0, operarios_con_casos: 1 }, [
            { operario_id: cuid, activos: 3 },
        ]);
        const c = await getCapacidad();

        expect(c.casosPorOperario).toHaveLength(1);
        const { id } = c.casosPorOperario[0];
        expect(id).toBe("Operario #WXYZ");
        expect(id.startsWith("Operario #")).toBe(true);
        expect(id).toHaveLength("Operario #".length + 4);
        expect(id).not.toContain(cuid);
        expect(JSON.stringify(c)).not.toContain(cuid);
    });

    it("pseudonimoOperario es determinista", () => {
        expect(pseudonimoOperario("cmabc1234defgh0001wxyz")).toBe("Operario #WXYZ");
        expect(pseudonimoOperario("cmabc1234defgh0001wxyz")).toBe("Operario #WXYZ");
    });
});

describe("alertasSinAsignarPorColegio", () => {
    it("devuelve Map por nombre de colegio; la ausencia de fila es el 0 real", async () => {
        queryRawMock.mockReset();
        queryRawMock.mockResolvedValueOnce([
            { colegio_id: "col-1", colegio: "Col. Norte", sin_asignar: 12 },
            { colegio_id: "col-2", colegio: "Col. Sur", sin_asignar: 4 },
        ]);
        const mapa = await alertasSinAsignarPorColegio();

        expect(mapa.get("Col. Norte")).toBe(12);
        expect(mapa.get("Col. Sur")).toBe(4);
        expect(mapa.has("Col. Sin Alertas")).toBe(false);
    });

    it("consulta rota degrada a Map vacío con warn", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        queryRawMock.mockReset();
        queryRawMock.mockRejectedValueOnce(new Error("permiso denegado"));
        const mapa = await alertasSinAsignarPorColegio();

        expect(mapa.size).toBe(0);
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
    });
});

describe("semaforoCapacidad · función pura", () => {
    const base: CapacidadData = {
        revisionManual: 0,
        alertasSinAsignar: 0,
        operariosConCasos: 0,
        casosPorOperario: [],
        capacidadMaxPorOperario: 25,
        demandaExcede: false,
        mensaje: "",
    };

    it("rubi solo cuando demandaExcede; ambar cerca; pino en el resto", () => {
        expect(semaforoCapacidad({ ...base, demandaExcede: true, alertasSinAsignar: 1 })).toBe("rubi");
        expect(
            semaforoCapacidad({ ...base, operariosConCasos: 1, alertasSinAsignar: 20 }),
        ).toBe("ambar"); // 20 = 80% de 25
        expect(
            semaforoCapacidad({ ...base, operariosConCasos: 1, alertasSinAsignar: 19 }),
        ).toBe("pino");
        expect(semaforoCapacidad(base)).toBe("pino"); // vacío total
    });
});
