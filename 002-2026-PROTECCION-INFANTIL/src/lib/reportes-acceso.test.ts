import { describe, it, expect } from "vitest";
import {
    whereReporteVigente,
    whereReporteEnEstado,
    whereReporteEnEstados,
    whereReporteAprobado,
    ESTADOS_APROBADOS,
} from "@/lib/reportes-acceso";
import { whereReporteAprobado as whereReporteAprobadoOriginal } from "@/lib/reporte-aprobado";

/**
 * SPEC-122 (bloque R4): tests de EQUIVALENCIA de la capa central de predicados.
 *
 * Cada caso compara el predicado central contra la copia manual EXACTA que
 * reemplaza (archivo:línea citado en cada test). Los `where` de Prisma son
 * objetos planos: si dos objetos son profundamente iguales, el SQL generado es
 * idéntico — no hace falta base de datos para demostrar la equivalencia.
 * La evidencia a nivel de fixtures la dan los tests de integración de cada ruta
 * migrada (siguen verdes tras el refactor).
 *
 * REGLA DEL REFACTOR: si alguno de estos tests falla, la migración está mal y
 * se PARA (no se "ajusta" la ruta para que pase).
 */

describe("whereReporteVigente", () => {
    it("equivale a `{ eliminado: false }` solo (admin/estadisticas/route.ts:80,86)", () => {
        expect(whereReporteVigente()).toEqual({ eliminado: false });
    });

    it("equivale a `{ eliminado: false, creadoEn: {...} }` (admin/estadisticas/route.ts:81,93)", () => {
        const hoy = new Date("2026-01-01T00:00:00Z");
        const hoySig = new Date("2026-01-02T00:00:00Z");
        expect(whereReporteVigente({ creadoEn: { gte: hoy, lt: hoySig } })).toEqual({
            eliminado: false,
            creadoEn: { gte: hoy, lt: hoySig },
        });
    });

    it("equivale a `{ eliminado: false, esAnonimo: bool }` (admin/estadisticas/route.ts:84-85)", () => {
        expect(whereReporteVigente({ esAnonimo: true })).toEqual({ eliminado: false, esAnonimo: true });
        expect(whereReporteVigente({ esAnonimo: false })).toEqual({ eliminado: false, esAnonimo: false });
    });

    it("equivale a `{ eliminado: false, plataformaId/ciudad: { not: '' } }` (admin/estadisticas/route.ts:88-89)", () => {
        expect(whereReporteVigente({ plataformaId: { not: "" } })).toEqual({
            eliminado: false,
            plataformaId: { not: "" },
        });
        expect(whereReporteVigente({ ciudad: { not: "" } })).toEqual({
            eliminado: false,
            ciudad: { not: "" },
        });
    });

    it("equivale a `{ usuarioId, eliminado: false }` (reportes/mis-reportes/route.ts:39)", () => {
        expect(whereReporteVigente({ usuarioId: "u-1" })).toEqual({ usuarioId: "u-1", eliminado: false });
    });

    it("equivale a `{ usuarioId: { in: ids }, eliminado: false }` (admin/padres/route.ts:72)", () => {
        const ids = ["u-1", "u-2"];
        expect(whereReporteVigente({ usuarioId: { in: ids } })).toEqual({
            usuarioId: { in: ids },
            eliminado: false,
        });
    });

    it("equivale a `{ operadorId, eliminado: false }` (admin/operadores/route.ts:68)", () => {
        expect(whereReporteVigente({ operadorId: "op-1" })).toEqual({ operadorId: "op-1", eliminado: false });
    });

    it("equivale a `{ eliminado: false, OR: [...] }` (composición con OR, p. ej. la cola de spam de admin/spam/pendientes)", () => {
        const OR = [
            { estado: "POSIBLE_SPAM" as const },
            { estado: "REVISION_MANUAL" as const, clasificacion: { categoria: "SPAM" as const } },
        ];
        expect(whereReporteVigente({ OR })).toEqual({ eliminado: false, OR });
    });

    it("equivale a `{ id: { in }, identificador, plataformaId, eliminado: false }` (admin/comite/apelaciones/[id]/resolver/route.ts:113-119)", () => {
        const reportesABajar = ["r-1", "r-2"];
        expect(
            whereReporteVigente({
                id: { in: reportesABajar },
                identificador: "+573001112233",
                plataformaId: "plat-1",
            })
        ).toEqual({
            id: { in: reportesABajar },
            identificador: "+573001112233",
            plataformaId: "plat-1",
            eliminado: false,
        });
    });

    it("sirve como filtro de relación anidado `{ reporte: {...} }` (admin/estadisticas/route.ts:87,100,105)", () => {
        expect({ reporte: whereReporteVigente() }).toEqual({ reporte: { eliminado: false } });
        expect({ confirmada: true, clasificacion: { reporte: whereReporteVigente() } }).toEqual({
            confirmada: true,
            clasificacion: { reporte: { eliminado: false } },
        });
    });

    it("el filtro de vigencia no es negociable: pisa un `eliminado` recibido en extra", () => {
        expect(whereReporteVigente({ eliminado: true })).toEqual({ eliminado: false });
    });
});

describe("whereReporteEnEstado", () => {
    it("equivale a `{ estado, operadorId: null, eliminado: false }` (admin/estadisticas/clasificacion/route.ts:71, admin/operadores/asignacion/route.ts:23-28)", () => {
        expect(whereReporteEnEstado("REVISION_MANUAL", { operadorId: null })).toEqual({
            estado: "REVISION_MANUAL",
            operadorId: null,
            eliminado: false,
        });
    });

    it("equivale a `{ estado, operadorId: { not: null }, eliminado: false }` (clasificacion/route.ts:74, asignacion/route.ts:37-41)", () => {
        expect(whereReporteEnEstado("REVISION_MANUAL", { operadorId: { not: null } })).toEqual({
            estado: "REVISION_MANUAL",
            operadorId: { not: null },
            eliminado: false,
        });
    });

    it("equivale a `{ estado, prioridadAlta: true, eliminado: false }` (admin/estadisticas/clasificacion/route.ts:83)", () => {
        expect(whereReporteEnEstado("REVISION_MANUAL", { prioridadAlta: true })).toEqual({
            estado: "REVISION_MANUAL",
            prioridadAlta: true,
            eliminado: false,
        });
    });

    it("equivale a `{ operadorId, estado, eliminado: false }` (admin/operadores/route.ts:61, reportes-revision/[id]/reasignar/route.ts:82)", () => {
        expect(whereReporteEnEstado("REVISION_MANUAL", { operadorId: "op-1" })).toEqual({
            operadorId: "op-1",
            estado: "REVISION_MANUAL",
            eliminado: false,
        });
    });

    it("equivale a `{ eliminado: false, estado: 'REQUIERE_ANONIMIZACION' }` (admin/estadisticas/route.ts:83)", () => {
        expect(whereReporteEnEstado("REQUIERE_ANONIMIZACION")).toEqual({
            eliminado: false,
            estado: "REQUIERE_ANONIMIZACION",
        });
    });
});

describe("whereReporteEnEstados", () => {
    it("equivale a `{ eliminado: false, estado: { in: ['REVISION_MANUAL','PROCESANDO'] } }` (admin/estadisticas/route.ts:82)", () => {
        expect(whereReporteEnEstados(["REVISION_MANUAL", "PROCESANDO"])).toEqual({
            eliminado: false,
            estado: { in: ["REVISION_MANUAL", "PROCESANDO"] },
        });
    });

    it("equivale a `{ identificador, estado: { in: ESTADOS_VISIBLES }, eliminado: false }` (consulta/detalle/route.ts:71-76)", () => {
        const ESTADOS_VISIBLES = ["CLASIFICADO", "CORREGIDO"] as const;
        expect(whereReporteEnEstados(ESTADOS_VISIBLES, { identificador: "+573001112233" })).toEqual({
            identificador: "+573001112233",
            estado: { in: ["CLASIFICADO", "CORREGIDO"] },
            eliminado: false,
        });
    });

    it("equivale al filtro anidado `reporte: { estado: { in: ESTADOS_APROBADOS }, eliminado: false }` (estadisticas-publicas/route.ts:45)", () => {
        expect({ reporte: whereReporteEnEstados(ESTADOS_APROBADOS) }).toEqual({
            reporte: { estado: { in: [...ESTADOS_APROBADOS] }, eliminado: false },
        });
    });
});

describe("reutilización de whereReporteAprobado", () => {
    it("reexporta la MISMA función de src/lib/reporte-aprobado.ts (no la duplica)", () => {
        expect(whereReporteAprobado).toBe(whereReporteAprobadoOriginal);
    });
});
