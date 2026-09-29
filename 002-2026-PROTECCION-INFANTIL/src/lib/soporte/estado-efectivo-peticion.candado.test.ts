/**
 * SPEC-752 · CANDADO del estado efectivo de la petición.
 *
 * Prueba que resolver DESPUÉS del término no se presenta como cumplimiento
 * (RESUELTA_TARDE, no RESUELTA) y que el fallo conservador nunca deja ABIERTA ni
 * afirma RESUELTA. `esPeticionIncumplida` cubre VENCIDA_SIN_RESOLVER + RESUELTA_TARDE.
 * Puro, sin BD.
 */
import { describe, it, expect } from "vitest";
import {
    estadoEfectivoPeticion,
    esPeticionIncumplida,
    type EstadoPeticionServicio,
} from "@/lib/soporte/estado-efectivo-peticion";

const NOW = new Date("2026-09-29T15:00:00.000Z");
const HORA = 3_600_000;
const DIA = 86_400_000;
const FUTURO = new Date(NOW.getTime() + HORA);
const PASADO = new Date(NOW.getTime() - HORA);

describe("SPEC-752 · estadoEfectivoPeticion", () => {
    describe("resolución: RESUELTA solo EN PLAZO", () => {
        it("resuelta antes del vencimiento → RESUELTA", () => {
            expect(estadoEfectivoPeticion(NOW, new Date(NOW.getTime() + DIA), NOW)).toBe("RESUELTA");
        });
        it("resuelta exacto en el vencimiento (resueltoEn === venceEn) → RESUELTA (borde inclusivo)", () => {
            expect(estadoEfectivoPeticion(NOW, NOW, NOW)).toBe("RESUELTA");
        });
        it("resuelta un instante después (venceEn + 1 ms) → RESUELTA_TARDE, NUNCA RESUELTA", () => {
            const efectivo = estadoEfectivoPeticion(NOW, new Date(NOW.getTime() - 1), NOW);
            expect(efectivo).toBe("RESUELTA_TARDE");
            expect(efectivo).not.toBe("RESUELTA");
        });
        it("resuelta un día después → RESUELTA_TARDE", () => {
            expect(estadoEfectivoPeticion(NOW, new Date(NOW.getTime() - DIA), NOW)).toBe("RESUELTA_TARDE");
        });
    });

    describe("sin resolver: ABIERTA dentro del plazo, VENCIDA al cruzarlo", () => {
        it("now < venceEn → ABIERTA", () => {
            expect(estadoEfectivoPeticion(null, FUTURO, NOW)).toBe("ABIERTA");
        });
        it("now >= venceEn → VENCIDA_SIN_RESOLVER", () => {
            expect(estadoEfectivoPeticion(null, PASADO, NOW)).toBe("VENCIDA_SIN_RESOLVER");
        });
        it("borde: now === venceEn → VENCIDA_SIN_RESOLVER", () => {
            expect(estadoEfectivoPeticion(null, NOW, NOW)).toBe("VENCIDA_SIN_RESOLVER");
        });
        it("borde: now === venceEn − 1 ms → ABIERTA", () => {
            expect(estadoEfectivoPeticion(null, new Date(NOW.getTime() + 1), NOW)).toBe("ABIERTA");
        });
    });

    describe("fallo conservador: nunca ABIERTA ni RESUELTA con reloj no confiable", () => {
        const chequea = (nombre: string, efectivo: EstadoPeticionServicio) => {
            it(nombre, () => {
                expect(efectivo, `${nombre}: no ABIERTA`).not.toBe("ABIERTA");
                expect(efectivo, `${nombre}: no RESUELTA`).not.toBe("RESUELTA");
                expect(esPeticionIncumplida(efectivo), `${nombre}: cuenta como incumplida`).toBe(true);
            });
        };
        chequea("sin resolver · now undefined", estadoEfectivoPeticion(null, FUTURO, undefined));
        chequea("sin resolver · venceEn basura", estadoEfectivoPeticion(null, "x", NOW));
        chequea("resuelta · venceEn basura (no se puede probar a tiempo)", estadoEfectivoPeticion(NOW, "basura", NOW));
    });

    it("esPeticionIncumplida: VENCIDA y RESUELTA_TARDE sí; RESUELTA y ABIERTA no", () => {
        expect(esPeticionIncumplida("VENCIDA_SIN_RESOLVER")).toBe(true);
        expect(esPeticionIncumplida("RESUELTA_TARDE")).toBe(true);
        expect(esPeticionIncumplida("RESUELTA")).toBe(false);
        expect(esPeticionIncumplida("ABIERTA")).toBe(false);
    });
});
