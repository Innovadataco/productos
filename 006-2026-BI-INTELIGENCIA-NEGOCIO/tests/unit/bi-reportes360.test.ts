// tests/unit/bi-reportes360.test.ts · Capa de datos de "Reportes 360"
// (análisis completo de reportes) · Producto 006 · BI v2 · SPEC-006
//
// Unitarios puros: '@/lib/db' (prisma.$queryRaw) mockeado — sin BD ni red.
// Las filas mockeadas tienen la FORMA real del ResultSet de cada query
// (alias snake_case, ::int como number). Se cubre: mapeo de los 6 bloques,
// % sobre el clasificado (SIN_CLASIFICAR queda fuera del denominador y su
// % es NULL), % NULL sin base (universo vacío), orden documentado de los
// rangos de edad y degradación honesta por bloque (una consulta rota no
// tumba la sección).

import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRawMock } = vi.hoisted(() => ({
    queryRawMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: queryRawMock } }));

import { getReportes360 } from "@/lib/bi/reportes360";

// ─── Helpers de mock (mismo patrón que bi-analitica.test.ts) ─────────────────

type Filas = Record<string, unknown>[];
type Respuesta = Filas | Error;

/**
 * Despacha por fragmento distintivo del SQL (primer match gana). Un Error en
 * la respuesta simula el fallo de ESA consulta: el bloque debe degradar a
 * vacío, nunca reventar la sección entera.
 */
function mockConsultas(mapa: Array<[string, Respuesta]>): void {
    queryRawMock.mockImplementation((partes: unknown) => {
        const sql = (Array.isArray(partes) ? partes.join(" ") : String(partes)).replace(
            /\s+/g,
            " ",
        );
        for (const [fragmento, respuesta] of mapa) {
            if (sql.includes(fragmento)) {
                return respuesta instanceof Error
                    ? Promise.reject(respuesta)
                    : Promise.resolve(respuesta);
            }
        }
        return Promise.resolve([]);
    });
}

// Fragmentos distintivos de cada query de reportes360.ts.
const F = {
    categoria: "SIN_CLASIFICAR",
    estado: 'r."estado"::text',
    plataforma: 'JOIN "Plataforma"',
    anonimato: '"prioridadAlta"',
    edad: "menores_13",
    evolucion: "'1 month' *",
} as const;

/** Fila agregada estándar: 100 reportes, 70 anónimos, 5 de prioridad alta. */
const FILA_ANONIMATO = { total: 100, anonimos: 70, autenticados: 30, prioridad_alta: 5 };

/** Fila de edad estándar con dato en cada rango. */
const FILA_EDAD = {
    menores_13: 20,
    edad_13_15: 30,
    edad_16_17: 10,
    edad_18_mas: 5,
    sin_dato: 35,
};

/** Serie mensual de 24 entradas (2024-10 … 2025-09), totales 1..24. */
function filasEvolucion(): Filas {
    const meses = [
        "2024-10", "2024-11", "2024-12", "2025-01", "2025-02", "2025-03",
        "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09",
        "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03",
        "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09",
    ];
    return meses.map((mes, i) => ({ mes, total: i + 1 }));
}

beforeEach(() => {
    queryRawMock.mockReset();
});

// ─── getReportes360 ──────────────────────────────────────────────────────────

describe("getReportes360", () => {
    it("mapea los 6 bloques y calcula los % sobre las filas del ResultSet", async () => {
        mockConsultas([
            [F.categoria, [
                { categoria: "CONTACTO_INSISTENTE", total: 40 },
                { categoria: "ACOSO", total: 40 },
                { categoria: "SIN_CLASIFICAR", total: 20 },
            ]],
            [F.estado, [
                { estado: "CLASIFICADO", total: 60 },
                { estado: "PENDIENTE", total: 40 },
            ]],
            [F.plataforma, [
                { plataforma: "WhatsApp", total: 55 },
                { plataforma: "Roblox", total: 45 },
            ]],
            [F.anonimato, [FILA_ANONIMATO]],
            [F.edad, [FILA_EDAD]],
            [F.evolucion, filasEvolucion()],
        ]);

        const datos = await getReportes360();

        // Universo: el total del barrido agregado (100).
        expect(datos.totalReportes).toBe(100);

        // Categoría: % sobre el CLASIFICADO (80): 40/80 = 50%.
        expect(datos.porCategoria).toEqual([
            { categoria: "CONTACTO_INSISTENTE", total: 40, pctClasificado: 50 },
            { categoria: "ACOSO", total: 40, pctClasificado: 50 },
            { categoria: "SIN_CLASIFICAR", total: 20, pctClasificado: null },
        ]);

        // Estado y plataforma pasan tal cual (orden del SQL).
        expect(datos.porEstado).toEqual([
            { estado: "CLASIFICADO", total: 60 },
            { estado: "PENDIENTE", total: 40 },
        ]);
        expect(datos.porPlataforma).toEqual([
            { plataforma: "WhatsApp", total: 55 },
            { plataforma: "Roblox", total: 45 },
        ]);

        // Anonimato y prioridad: % sobre el total del universo.
        expect(datos.anonimato).toEqual({ anonimos: 70, autenticados: 30, pctAnonimos: 70 });
        expect(datos.prioridadAlta).toEqual({ total: 5, pct: 5 });

        // Edad: orden documentado de los rangos.
        expect(datos.porEdad.map((e) => e.rango)).toEqual([
            "MENOR_13",
            "EDAD_13_15",
            "EDAD_16_17",
            "EDAD_18_MAS",
            "SIN_DATO",
        ]);
        expect(datos.porEdad.map((e) => e.total)).toEqual([20, 30, 10, 5, 35]);

        // Evolución: las 24 entradas pasan tal cual (huecos ya venían a 0).
        expect(datos.evolucionMensual).toHaveLength(24);
        expect(datos.evolucionMensual[23]).toEqual({ mes: "2026-09", total: 24 });
    });

    it("pctClasificado es NULL cuando nadie quedó clasificado", async () => {
        mockConsultas([
            [F.categoria, [{ categoria: "SIN_CLASIFICAR", total: 7 }]],
            [F.anonimato, [{ total: 7, anonimos: 7, autenticados: 0, prioridad_alta: 0 }]],
            [F.edad, [FILA_EDAD]],
        ]);

        const datos = await getReportes360();

        expect(datos.porCategoria).toEqual([
            { categoria: "SIN_CLASIFICAR", total: 7, pctClasificado: null },
        ]);
    });

    it("% globales NULL cuando el universo está vacío (candado 9)", async () => {
        mockConsultas([
            [F.categoria, []],
            [F.estado, []],
            [F.plataforma, []],
            [F.anonimato, [{ total: 0, anonimos: 0, autenticados: 0, prioridad_alta: 0 }]],
            [F.edad, [{
                menores_13: 0, edad_13_15: 0, edad_16_17: 0, edad_18_mas: 0, sin_dato: 0,
            }]],
            [F.evolucion, []],
        ]);

        const datos = await getReportes360();

        expect(datos.totalReportes).toBe(0);
        expect(datos.anonimato.pctAnonimos).toBeNull();
        expect(datos.prioridadAlta.pct).toBeNull();
        expect(datos.porEdad.every((e) => e.total === 0)).toBe(true);
        expect(datos.evolucionMensual).toEqual([]);
    });

    it("degrada el bloque que falla sin tumbar el resto (candado 9)", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        mockConsultas([
            [F.categoria, new Error("réplica caída")],
            [F.estado, [{ estado: "CLASIFICADO", total: 60 }]],
            [F.plataforma, new Error("permisos")],
            [F.anonimato, [FILA_ANONIMATO]],
            [F.edad, new Error("timeout")],
            [F.evolucion, filasEvolucion()],
        ]);

        const datos = await getReportes360();

        expect(datos.porCategoria).toEqual([]);
        expect(datos.porPlataforma).toEqual([]);
        expect(datos.porEdad.map((e) => e.total)).toEqual([0, 0, 0, 0, 0]);
        expect(datos.porEstado).toEqual([{ estado: "CLASIFICADO", total: 60 }]);
        expect(datos.anonimato.anonimos).toBe(70);
        expect(datos.evolucionMensual).toHaveLength(24);
        // Un warn por bloque caído, con el prefijo del módulo.
        expect(warn).toHaveBeenCalledTimes(3);
        expect(warn.mock.calls[0]?.[0]).toContain("[Reportes360]");
        warn.mockRestore();
    });
});
