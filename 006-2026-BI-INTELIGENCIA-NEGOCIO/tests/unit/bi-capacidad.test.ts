// tests/unit/bi-capacidad.test.ts · Contrato de src/lib/bi/capacidad.ts
// Producto 006 · BI v2 · Rediseño 2026-09-03 (cola de moderación, espejo PI)
// Unitarios puros: prisma.$queryRaw mockeado — sin BD, sin red.
// Cubre: la cola real de moderación (REVISION_MANUAL + POSIBLE_SPAM), cupo
// SOLO desde PerfilOperador replicado (jamás un default quemado), candado 9
// (cupo desconocido / operarios sin perfil se dicen, no se inventan) y la
// pseudonimización (Ley 1581). Situación real de producción verificada el
// 2026-09-03: 474 casos en gestión, 0 sin asignar, 8 operarios, cupo 500 c/u.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRawMock } = vi.hoisted(() => ({
    queryRawMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: queryRawMock } }));

import {
    alertasSinAsignarPorColegio,
    getCapacidad,
    pseudonimoOperario,
    semaforoCapacidad,
    type CapacidadData,
} from "@/lib/bi/capacidad";

const OP_A = "cmabc1234defgh0001aaaa";
const OP_B = "cmabc1234defgh0001bbbb";
const OP_C = "cmabc1234defgh0001cccc";

/**
 * Encola las tres respuestas de $queryRaw en el orden fijo de getCapacidad:
 * cola agregada → casos por operario → cupos PerfilOperador.
 */
function bdCon(
    cola: { en_gestion: number; sin_asignar: number },
    porOperario: { operario_id: string; activos: number }[] = [],
    cupos: { operario_id: string; cupo: number }[] = [],
) {
    queryRawMock.mockReset();
    queryRawMock
        .mockResolvedValueOnce([cola])
        .mockResolvedValueOnce(porOperario)
        .mockResolvedValueOnce(cupos);
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("getCapacidad · situación real de producción (espejo del panel de PI)", () => {
    it("474 en gestión, 0 sin asignar, 8 operarios × cupo 500: capacidad suficiente", async () => {
        const ocho = Array.from({ length: 8 }, (_, i) => ({
            operario_id: `cmoper00000000000000000${i}`,
            activos: 52 + i,
        }));
        bdCon(
            { en_gestion: 474, sin_asignar: 0 },
            ocho,
            ocho.map((o) => ({ operario_id: o.operario_id, cupo: 500 })),
        );
        const c = await getCapacidad();

        expect(c.casosEnGestion).toBe(474);
        expect(c.sinAsignar).toBe(0);
        expect(c.operariosConCasos).toBe(8);
        expect(c.cupoTotal).toBe(4000); // suma REAL de PerfilOperador, no quemado
        expect(c.cupoLibre).toBe(3526);
        expect(c.operariosSinPerfil).toBe(0);
        expect(c.demandaExcede).toBe(false);
        expect(c.mensaje).toBe(
            "Capacidad suficiente: 3526 cupos libres de 4000 (8 operarios, 474 casos en gestión, 0 sin asignar)",
        );
        expect(semaforoCapacidad(c)).toBe("pino");
    });
});

describe("getCapacidad · candado 9: la brecha se dice en la cara", () => {
    it("casos sin asignar y cero operarios con casos: rubí, brecha total", async () => {
        bdCon({ en_gestion: 0, sin_asignar: 30 });
        const c = await getCapacidad();

        expect(c.operariosConCasos).toBe(0);
        expect(c.cupoTotal).toBe(0);
        expect(c.demandaExcede).toBe(false); // cupo desconocido: no se afirma excedente
        expect(c.mensaje).toContain("Cupo no disponible en la réplica");
        expect(c.mensaje).toContain("30");
        expect(semaforoCapacidad(c)).toBe("ambar"); // no se afirma suficiencia sin cupo
    });

    it("cupo conocido pero la cola sin asignar supera el libre: rubí", async () => {
        bdCon(
            { en_gestion: 20, sin_asignar: 15 },
            [{ operario_id: OP_A, activos: 20 }],
            [{ operario_id: OP_A, cupo: 30 }],
        );
        const c = await getCapacidad();

        expect(c.cupoTotal).toBe(30);
        expect(c.cupoLibre).toBe(10);
        expect(c.demandaExcede).toBe(true); // 15 > 10
        expect(c.mensaje).toBe(
            "La cola sin asignar (15 casos) supera el cupo libre (10): 1 operario con cupo total de 30 casos",
        );
        expect(semaforoCapacidad(c)).toBe("rubi");
    });

    it("operarios con casos sin perfil en la réplica: cupo parcial, jamás inventado", async () => {
        bdCon(
            { en_gestion: 12, sin_asignar: 0 },
            [
                { operario_id: OP_A, activos: 7 },
                { operario_id: OP_B, activos: 5 },
            ],
            [{ operario_id: OP_A, cupo: 500 }], // OP_B sin perfil
        );
        const c = await getCapacidad();

        expect(c.operariosSinPerfil).toBe(1);
        expect(c.cupoTotal).toBe(500); // solo lo confirmado: OP_B NO suma
        expect(c.mensaje).toContain("Cupo parcialmente visible");
        expect(c.mensaje).toContain("1 operario(s) sin perfil");
        // OP_B aparece en la lista con cupo null (honesto, no 25 quemado)
        const opB = c.casosPorOperario.find((o) => o.id === pseudonimoOperario(OP_B));
        expect(opB?.cupo).toBeNull();
        expect(opB?.activos).toBe(5);
    });

    it("cerca del límite (≥80% del cupo en uso + cola): ambar", async () => {
        bdCon(
            { en_gestion: 44, sin_asignar: 2 },
            [
                { operario_id: OP_A, activos: 24 },
                { operario_id: OP_B, activos: 20 },
            ],
            [
                { operario_id: OP_A, cupo: 25 },
                { operario_id: OP_B, cupo: 25 },
            ],
        );
        const c = await getCapacidad();

        expect(c.cupoTotal).toBe(50);
        expect(c.cupoLibre).toBe(6);
        expect(c.demandaExcede).toBe(false); // 2 ≤ 6
        expect(c.mensaje).toBe(
            "Cupo al límite: 6 libres de 50 (2 operarios, 44 casos en gestión)",
        );
        expect(semaforoCapacidad(c)).toBe("ambar"); // 44+2=46 ≥ 80% de 50
    });

    it("cola vacía total: honesto, pino", async () => {
        bdCon({ en_gestion: 0, sin_asignar: 0 });
        const c = await getCapacidad();

        expect(c.mensaje).toBe(
            "Cola de moderación vacía: sin casos activos en gestión ni esperando asignación.",
        );
        expect(semaforoCapacidad(c)).toBe("pino");
    });

    it("un sondeo roto degrada a ceros con warn, sin inventar datos ni reventar", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        queryRawMock.mockReset();
        queryRawMock
            .mockRejectedValueOnce(new Error("réplica caída"))
            .mockResolvedValueOnce([{ operario_id: OP_A, activos: 2 }])
            .mockResolvedValueOnce([{ operario_id: OP_A, cupo: 500 }]);
        const c = await getCapacidad();

        expect(c.casosEnGestion).toBe(0); // degradado, no inventado
        expect(c.sinAsignar).toBe(0);
        expect(c.operariosConCasos).toBe(1);
        expect(c.mensaje).toContain("No se pudo leer la cola de moderación");
        expect(c.mensaje).not.toContain("vacía");
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
    });
});

describe("pseudonimización de operarios (Ley 1581 · PII)", () => {
    it("el seudónimo jamás contiene el cuid completo ni resuelve identidad", async () => {
        const cuid = "cmabc1234defgh0001wxyz";
        bdCon({ en_gestion: 3, sin_asignar: 0 }, [{ operario_id: cuid, activos: 3 }], [
            { operario_id: cuid, cupo: 500 },
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
        casosEnGestion: 0,
        sinAsignar: 0,
        operariosConCasos: 0,
        cupoTotal: 0,
        cupoLibre: 0,
        operariosSinPerfil: 0,
        casosPorOperario: [],
        demandaExcede: false,
        mensaje: "",
    };

    it("rubi solo cuando la cola supera el cupo libre", () => {
        expect(semaforoCapacidad({ ...base, demandaExcede: true, cupoTotal: 100 })).toBe("rubi");
        expect(semaforoCapacidad({ ...base, cupoTotal: 100, cupoLibre: 100 })).toBe("pino");
    });

    it("cupo desconocido (0) con actividad: ambar — no se afirma suficiencia", () => {
        expect(semaforoCapacidad({ ...base, casosEnGestion: 5 })).toBe("ambar");
        expect(semaforoCapacidad({ ...base, sinAsignar: 3 })).toBe("ambar");
        expect(semaforoCapacidad(base)).toBe("pino"); // vacío total
    });

    it("ambar cerca del límite (≥80% en uso + cola), pino con holgura", () => {
        expect(
            semaforoCapacidad({ ...base, cupoTotal: 100, cupoLibre: 15, casosEnGestion: 85 }), // uso 85%
        ).toBe("ambar");
        expect(
            semaforoCapacidad({ ...base, cupoTotal: 100, cupoLibre: 85, casosEnGestion: 15 }),
        ).toBe("pino");
    });
});
