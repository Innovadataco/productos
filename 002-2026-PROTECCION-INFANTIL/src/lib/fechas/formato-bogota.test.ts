/**
 * SPEC-447 (I-311) · la hora de Bogotá vive en un solo lugar.
 *
 * La lección de I-247 y de SPEC-431: un offset copiado a mano a la pantalla se
 * desincroniza en silencio y le miente al usuario y al modelo. `instanteDesdeHoraBogota`
 * es el ÚNICO camino de «lo que la persona escribió» a «lo que se guarda», y
 * usa `fromZonedTime` en vez de restar cinco horas a pulso.
 */
import { describe, it, expect } from "vitest";
import { instanteDesdeHoraBogota, sumarMinutos, formatoHoraBogota } from "./formato-bogota";

describe("SPEC-447 · de la hora de pared de Bogotá al instante guardado", () => {
    it("las 10:00 de Bogotá son las 15:00 UTC del mismo día", () => {
        expect(instanteDesdeHoraBogota("2026-09-10", "10:00").toISOString()).toBe("2026-09-10T15:00:00.000Z");
    });

    it("una hora de la noche cruza al día siguiente en UTC — el error clásico", () => {
        // 21:00 en Bogotá es 02:00 UTC del 11. Leer esto en UTC sin convertir
        // es exactamente el defecto que SPEC-431 corrigió en el payload del modelo.
        expect(instanteDesdeHoraBogota("2026-09-10", "21:00").toISOString()).toBe("2026-09-11T02:00:00.000Z");
    });

    it("ida y vuelta: lo que se guarda se vuelve a mostrar igual que se escribió", () => {
        for (const hora of ["00:00", "06:30", "12:00", "18:45", "23:59"]) {
            const instante = instanteDesdeHoraBogota("2026-09-10", hora);
            expect(formatoHoraBogota(instante, { hour: "2-digit", minute: "2-digit", hour12: false })).toBe(hora);
        }
    });

    it("el fin sale de la duración, no de una cuenta a mano", () => {
        const inicio = instanteDesdeHoraBogota("2026-09-10", "10:00");
        expect(sumarMinutos(inicio, 50).toISOString()).toBe("2026-09-10T15:50:00.000Z");
        // Una duración que cruza la hora en punto tampoco se rompe.
        expect(sumarMinutos(inicio, 90).toISOString()).toBe("2026-09-10T16:30:00.000Z");
    });

    it("un texto con forma equivocada NO se guarda callado: lanza", () => {
        expect(() => instanteDesdeHoraBogota("10/09/2026", "10:00")).toThrow(/Día inválido/);
        expect(() => instanteDesdeHoraBogota("2026-09-10", "10")).toThrow(/Hora inválida/);
        expect(() => instanteDesdeHoraBogota("", "")).toThrow();
    });

    it("no hay horario de verano que corra la hora: enero y julio dan el mismo offset", () => {
        const enero = instanteDesdeHoraBogota("2026-01-15", "10:00");
        const julio = instanteDesdeHoraBogota("2026-07-15", "10:00");
        expect(enero.getUTCHours()).toBe(15);
        expect(julio.getUTCHours()).toBe(15);
    });
});
