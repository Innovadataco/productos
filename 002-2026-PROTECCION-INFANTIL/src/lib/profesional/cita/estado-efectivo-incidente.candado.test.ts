/**
 * SPEC-753 · CANDADO del reloj del incidente de contradicción.
 *
 * Prueba que el «venció sin resolver → a favor del padre» salta SOLO al cruzar
 * `venceEn`, sin criterio de nadie, y que ante un reloj no confiable el default
 * cae al lado que PROTEGE al padre (nunca ABIERTO, que sería «caduca en silencio»).
 *
 * Límites exactos (now===venceEn / −1 ms) → mutar la comparación pone rojo. Puro,
 * sin BD.
 */
import { describe, it, expect } from "vitest";
import {
    estadoEfectivoIncidente,
    type EstadoIncidenteContradiccion,
} from "@/lib/profesional/cita/estado-efectivo-incidente";

const NOW = new Date("2026-09-29T15:00:00.000Z");
const HORA = 3_600_000;
const FUTURO = new Date(NOW.getTime() + HORA);
const PASADO = new Date(NOW.getTime() - HORA);

describe("SPEC-753 · estadoEfectivoIncidente — reloj del plazo legal", () => {
    it("resuelto (tiene resueltoEn) → RESUELTO, aunque el plazo haya vencido (la resolución es un hecho)", () => {
        expect(estadoEfectivoIncidente(NOW, PASADO, NOW)).toBe("RESUELTO");
    });

    it("sin resolver, dentro del plazo (now < venceEn) → ABIERTO", () => {
        expect(estadoEfectivoIncidente(null, FUTURO, NOW)).toBe("ABIERTO");
    });

    it("sin resolver, vencido (now >= venceEn) → VENCIDO_A_FAVOR_PADRE", () => {
        expect(estadoEfectivoIncidente(null, PASADO, NOW)).toBe("VENCIDO_A_FAVOR_PADRE");
    });

    it("borde: now === venceEn → VENCIDO_A_FAVOR_PADRE (el plazo vence al alcanzarlo)", () => {
        expect(estadoEfectivoIncidente(null, NOW, NOW)).toBe("VENCIDO_A_FAVOR_PADRE");
    });

    it("borde: now === venceEn − 1 ms → ABIERTO", () => {
        expect(estadoEfectivoIncidente(null, new Date(NOW.getTime() + 1), NOW)).toBe("ABIERTO");
    });

    describe("fallo conservador: protege al padre, JAMÁS ABIERTO", () => {
        const assertFavorPadre = (nombre: string, efectivo: EstadoIncidenteContradiccion) => {
            it(`${nombre} → VENCIDO_A_FAVOR_PADRE (no ABIERTO)`, () => {
                expect(efectivo, `${nombre} debe caer a favor del padre`).toBe("VENCIDO_A_FAVOR_PADRE");
                expect(efectivo, `${nombre} JAMÁS ABIERTO (sería «caduca en silencio»)`).not.toBe("ABIERTO");
            });
        };
        // now no confiable, con un plazo FUTURO: aun así no lo dejamos ABIERTO.
        assertFavorPadre("now undefined", estadoEfectivoIncidente(null, FUTURO, undefined));
        assertFavorPadre("now null", estadoEfectivoIncidente(null, FUTURO, null));
        assertFavorPadre("now Date inválida", estadoEfectivoIncidente(null, FUTURO, new Date("basura")));
        assertFavorPadre("now string vacío", estadoEfectivoIncidente(null, FUTURO, ""));
        // venceEn no confiable: no sabemos el plazo → a favor del padre.
        assertFavorPadre("venceEn undefined", estadoEfectivoIncidente(null, undefined, NOW));
        assertFavorPadre("venceEn basura", estadoEfectivoIncidente(null, "no-es-fecha", NOW));

        it("pero resueltoEn válido gana aun con now/venceEn basura → RESUELTO", () => {
            expect(estadoEfectivoIncidente(NOW, "basura", undefined)).toBe("RESUELTO");
        });
    });

    describe("tolerancia de formato (misma respuesta con Date, ISO y epoch ms)", () => {
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
