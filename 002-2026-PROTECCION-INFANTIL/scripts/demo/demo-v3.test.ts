/**
 * SPEC-371 · candados del poblador demo v3 (lógica pura, sin BD).
 */
import { describe, it, expect } from "vitest";
import { rng, DEMO } from "./_common";
import { DEMO2 } from "./_common-v2";
import { DEMO3, id3, cadenaParaEstado, fechasEscalonadas, fraccionDe } from "./_common-v3";

describe("demo v3 · reversibilidad por marca", () => {
    it("el prefijo `demo3-` es DISJUNTO de v1 y v2 en todas las direcciones", () => {
        // Lo que hace seguro el borrado: ningún borrador alcanza las filas de otro.
        const ejemplos = [id3.transicion("demo-r-00001", 1), id3.solicitud("demo-al-x")];
        for (const e of ejemplos) {
            expect(e.startsWith(DEMO.prefix)).toBe(false);
            expect(e.startsWith(DEMO2.prefix)).toBe(false);
        }
        expect(`${DEMO.prefix}r-00001`.startsWith(DEMO3.prefix)).toBe(false);
        expect(`${DEMO2.prefix}r-00001`.startsWith(DEMO3.prefix)).toBe(false);
    });

    it("los ids son deterministas (idempotente) y distintos por paso", () => {
        expect(id3.transicion("demo-r-00007", 1)).toBe(id3.transicion("demo-r-00007", 1));
        expect(id3.transicion("demo-r-00007", 1)).not.toBe(id3.transicion("demo-r-00007", 2));
    });

    it("el número de solicitud demo no puede chocar con uno real (SOL- + 8 hex)", () => {
        const n = id3.numeroSolicitud(42);
        expect(n).toBe("SOL-D3-000042");
        expect(/^SOL-[0-9A-F]{8}$/.test(n)).toBe(false);
    });
});

describe("demo v3 · cadena de vida coherente con el presente", () => {
    const r = rng(2026);

    it("empieza en PENDIENTE, es contigua y TERMINA en el estado actual del reporte", () => {
        for (const estado of ["CLASIFICADO", "REVISION_MANUAL", "POSIBLE_SPAM"] as const) {
            for (let i = 0; i < 30; i++) {
                const pasos = cadenaParaEstado(estado, r);
                expect(pasos.length).toBeGreaterThan(0);
                expect(pasos[0]!.estadoAnterior).toBe("PENDIENTE");
                for (let k = 1; k < pasos.length; k++) {
                    expect(pasos[k]!.estadoAnterior).toBe(pasos[k - 1]!.estadoNuevo);
                }
                expect(pasos[pasos.length - 1]!.estadoNuevo).toBe(estado);
            }
        }
    });

    it("no inventa historia para estados que el demo no produce", () => {
        expect(cadenaParaEstado("DUPLICADO", r)).toEqual([]);
        expect(cadenaParaEstado("CORREGIDO", r)).toEqual([]);
    });

    it("las fechas son crecientes, nunca ANTES del creadoEn ni DESPUÉS de ahora", () => {
        const creadoEn = new Date("2026-09-01T10:00:00Z");
        const ahora = new Date("2026-09-02T18:00:00Z");
        for (let i = 0; i < 100; i++) {
            const pasos = cadenaParaEstado("CLASIFICADO", r);
            const fechas = fechasEscalonadas(creadoEn, pasos, ahora);
            let prev = creadoEn.getTime();
            for (const f of fechas) {
                expect(f.getTime()).toBeGreaterThanOrEqual(prev);
                expect(f.getTime()).toBeLessThanOrEqual(ahora.getTime());
                prev = f.getTime();
            }
        }
    });

    it("un reporte muy reciente se recorta a 'ahora' en vez de fabricar futuro", () => {
        const creadoEn = new Date("2026-09-02T17:59:00Z");
        const ahora = new Date("2026-09-02T18:00:00Z");
        const fechas = fechasEscalonadas(creadoEn, cadenaParaEstado("CLASIFICADO", r), ahora);
        expect(fechas.every((f) => f.getTime() <= ahora.getTime())).toBe(true);
    });
});

describe("demo v3 · reparto DESIGUAL para el semáforo de capacidad", () => {
    it("las fracciones van de casi al tope a casi libre y promedian ≈ 70 %", () => {
        const f = [...DEMO3.fraccionesAsignacion];
        expect(Math.max(...f)).toBeGreaterThanOrEqual(0.9);
        expect(Math.min(...f)).toBeLessThanOrEqual(0.2);
        const prom = f.reduce((s, x) => s + x, 0) / f.length;
        expect(prom).toBeGreaterThan(0.6);
        expect(prom).toBeLessThan(0.8);
    });

    it("fraccionDe recorre las fracciones y no se sale del rango", () => {
        for (let i = 0; i < 12; i++) {
            const x = fraccionDe(i);
            expect(x).toBeGreaterThan(0);
            expect(x).toBeLessThanOrEqual(1);
        }
        expect(fraccionDe(0)).toBe(DEMO3.fraccionesAsignacion[0]);
        expect(fraccionDe(DEMO3.fraccionesAsignacion.length)).toBe(DEMO3.fraccionesAsignacion[0]);
    });
});
