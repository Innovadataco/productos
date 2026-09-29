/**
 * SPEC-753 · CANDADO del reloj del incidente de contradicción.
 *
 * Prueba lo que el CEO señaló como RIESGO: una resolución POSTERIOR al vencimiento
 * NO es cumplimiento (la obligación de reversar ya se disparó al vencer). Por eso
 * `RESUELTO` es SOLO la resolución en plazo, y resolver tarde → `RESUELTO_TARDE`.
 * Y `esIncumplimiento` incluye a los resueltos tarde: el conteo no se les escapa.
 *
 * Control positivo en las direcciones que importan (a tiempo→RESUELTO, un instante
 * tarde→RESUELTO_TARDE, sin resolver+vencido→VENCIDO_A_FAVOR_PADRE) y fallo
 * conservador (reloj no confiable → nunca ABIERTO, nunca RESUELTO). Límites exactos
 * → mutar la comparación pone rojo. Puro, sin BD.
 */
import { describe, it, expect } from "vitest";
import {
    estadoEfectivoIncidente,
    esIncumplimiento,
    type EstadoIncidenteContradiccion,
} from "@/lib/profesional/cita/estado-efectivo-incidente";

const NOW = new Date("2026-09-29T15:00:00.000Z");
const HORA = 3_600_000;
const DIA = 86_400_000;
const FUTURO = new Date(NOW.getTime() + HORA);
const PASADO = new Date(NOW.getTime() - HORA);

describe("SPEC-753 · estadoEfectivoIncidente — reloj del plazo legal", () => {
    describe("resolución: RESUELTO solo EN PLAZO; tarde NO es cumplimiento", () => {
        it("resuelto ANTES del plazo → RESUELTO", () => {
            const venceEn = new Date(NOW.getTime() + DIA);
            expect(estadoEfectivoIncidente(NOW, venceEn, NOW)).toBe("RESUELTO");
        });

        it("resuelto EXACTO en el plazo (resueltoEn === venceEn) → RESUELTO (borde inclusivo)", () => {
            expect(estadoEfectivoIncidente(NOW, NOW, NOW)).toBe("RESUELTO");
        });

        it("resuelto UN INSTANTE después del plazo (venceEn + 1 ms) → RESUELTO_TARDE, NUNCA RESUELTO", () => {
            const venceEn = new Date(NOW.getTime() - 1);
            const efectivo = estadoEfectivoIncidente(NOW, venceEn, NOW);
            expect(efectivo).toBe("RESUELTO_TARDE");
            expect(efectivo, "resolver tarde no puede presentarse como cumplimiento").not.toBe("RESUELTO");
        });

        it("resuelto UN DÍA después del plazo → RESUELTO_TARDE (el caso del RIESGO del CEO)", () => {
            const venceEn = new Date(NOW.getTime() - DIA); // venció ayer
            expect(estadoEfectivoIncidente(NOW, venceEn, NOW)).toBe("RESUELTO_TARDE");
        });
    });

    describe("sin resolver: ABIERTO dentro del plazo, VENCIDO al cruzarlo", () => {
        it("now < venceEn → ABIERTO", () => {
            expect(estadoEfectivoIncidente(null, FUTURO, NOW)).toBe("ABIERTO");
        });

        it("now >= venceEn → VENCIDO_A_FAVOR_PADRE", () => {
            expect(estadoEfectivoIncidente(null, PASADO, NOW)).toBe("VENCIDO_A_FAVOR_PADRE");
        });

        it("borde: now === venceEn → VENCIDO_A_FAVOR_PADRE (vence al alcanzarlo)", () => {
            expect(estadoEfectivoIncidente(null, NOW, NOW)).toBe("VENCIDO_A_FAVOR_PADRE");
        });

        it("borde: now === venceEn − 1 ms → ABIERTO", () => {
            expect(estadoEfectivoIncidente(null, new Date(NOW.getTime() + 1), NOW)).toBe("ABIERTO");
        });
    });

    describe("fallo conservador: reloj no confiable → nunca ABIERTO ni RESUELTO", () => {
        const noEsCumplimientoNiAbierto = (nombre: string, efectivo: EstadoIncidenteContradiccion) => {
            it(`${nombre}`, () => {
                expect(efectivo, `${nombre}: no ABIERTO`).not.toBe("ABIERTO");
                expect(efectivo, `${nombre}: no RESUELTO (no se afirma cumplimiento)`).not.toBe("RESUELTO");
                expect(esIncumplimiento(efectivo), `${nombre}: cuenta como incumplimiento`).toBe(true);
            });
        };
        // Sin resolver + reloj roto → VENCIDO_A_FAVOR_PADRE.
        noEsCumplimientoNiAbierto("sin resolver · now undefined", estadoEfectivoIncidente(null, FUTURO, undefined));
        noEsCumplimientoNiAbierto("sin resolver · venceEn basura", estadoEfectivoIncidente(null, "x", NOW));
        // Resuelto pero venceEn no confiable → RESUELTO_TARDE (no se puede probar a tiempo).
        noEsCumplimientoNiAbierto("resuelto · venceEn undefined", estadoEfectivoIncidente(NOW, undefined, NOW));
        noEsCumplimientoNiAbierto("resuelto · venceEn basura", estadoEfectivoIncidente(NOW, "basura", NOW));
    });

    describe("esIncumplimiento: fuente única de «la obligación se disparó»", () => {
        it("VENCIDO_A_FAVOR_PADRE y RESUELTO_TARDE → incumplimiento; RESUELTO y ABIERTO → no", () => {
            expect(esIncumplimiento("VENCIDO_A_FAVOR_PADRE")).toBe(true);
            expect(esIncumplimiento("RESUELTO_TARDE"), "resolver tarde SIGUE siendo incumplimiento").toBe(true);
            expect(esIncumplimiento("RESUELTO")).toBe(false);
            expect(esIncumplimiento("ABIERTO")).toBe(false);
        });
    });

    describe("tolerancia de formato (Date, ISO, epoch ms)", () => {
        it("los tres formatos coinciden", () => {
            const conDate = estadoEfectivoIncidente(null, PASADO, NOW);
            const conISO = estadoEfectivoIncidente(null, PASADO.toISOString(), NOW.toISOString());
            const conMs = estadoEfectivoIncidente(null, PASADO.getTime(), NOW.getTime());
            expect(conDate).toBe("VENCIDO_A_FAVOR_PADRE");
            expect(conISO).toBe(conDate);
            expect(conMs).toBe(conDate);
        });
    });
});
