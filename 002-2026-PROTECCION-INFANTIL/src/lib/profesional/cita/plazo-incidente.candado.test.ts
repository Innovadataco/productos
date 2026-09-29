/**
 * SPEC-753 · CANDADO del término del incidente POR CLASE (fuente única, legal clavado).
 *
 * Espejo del candado de 752: TODA clase de contradicción está mapeada; el término LEGAL
 * (reclamo del padre por no-prestación) queda CLAVADO en 15 hábiles con ancla en la
 * respuesta del padre — subirlo/bajarlo o mover su ancla rompe el candado. venceEn >
 * reclamadoEn SIEMPRE (sostiene el CHECK), es HÁBILES no calendario. Puro, sin BD.
 */
import { describe, it, expect } from "vitest";
import { esDiaHabilColombia } from "@/lib/fechas/dias-habiles-colombia";
import {
    PLAZO_POR_CLASE,
    claseTieneTerminoLegal,
    reclamadoEnDeClase,
    venceEnIncidente,
    type ClaseContradiccion,
} from "@/lib/profesional/cita/plazo-incidente";

const DIA = 86_400_000;
const TODAS: ClaseContradiccion[] = [
    "NO_PRESTACION_RECLAMO_PADRE",
    "NO_PRESTACION_DICHA_PROFESIONAL",
    "DISCREPANCIA_SERVICIO",
];

describe("SPEC-753 · término del incidente por clase (fuente única)", () => {
    it("el LEGAL está clavado: reclamo del padre = 15 hábiles, ancla en la respuesta del padre", () => {
        expect(PLAZO_POR_CLASE.NO_PRESTACION_RECLAMO_PADRE).toEqual({
            diasHabiles: 15,
            legal: true,
            ancla: "PADRE_RESPONDIO",
        });
        expect(claseTieneTerminoLegal("NO_PRESTACION_RECLAMO_PADRE")).toBe(true);
    });

    it("los otros dos son INTERNOS (10 hábiles) y anclados en la DETECCIÓN (no legales)", () => {
        for (const clase of ["NO_PRESTACION_DICHA_PROFESIONAL", "DISCREPANCIA_SERVICIO"] as const) {
            expect(PLAZO_POR_CLASE[clase].legal, `${clase} no debe ser legal`).toBe(false);
            expect(PLAZO_POR_CLASE[clase].ancla, `${clase} ancla en detección`).toBe("DETECCION");
            expect(PLAZO_POR_CLASE[clase].diasHabiles, `${clase} término interno = 10`).toBe(10);
            expect(claseTieneTerminoLegal(clase)).toBe(false);
        }
    });

    it("legal ≠ interno: los términos NO comparten valor (poder de discriminación) y el interno cae ANTES", () => {
        const legal = PLAZO_POR_CLASE.NO_PRESTACION_RECLAMO_PADRE.diasHabiles;
        const interno = PLAZO_POR_CLASE.NO_PRESTACION_DICHA_PROFESIONAL.diasHabiles;
        expect(legal, "el legal y el interno no pueden compartir valor por defecto").not.toBe(interno);
        expect(interno, "el interno cae antes que el legal (holgura, no a la par)").toBeLessThan(legal);
    });

    it("SOLO el reclamo del padre ancla en su respuesta; nadie más", () => {
        const padreRespondio = new Date("2026-02-02T10:00:00Z");
        const deteccion = new Date("2026-02-20T10:00:00Z");
        const fechas = { padreRespondioEn: padreRespondio, deteccion };
        expect(reclamadoEnDeClase("NO_PRESTACION_RECLAMO_PADRE", fechas)).toEqual(padreRespondio);
        expect(reclamadoEnDeClase("NO_PRESTACION_DICHA_PROFESIONAL", fechas)).toEqual(deteccion);
        expect(reclamadoEnDeClase("DISCREPANCIA_SERVICIO", fechas)).toEqual(deteccion);
    });

    it("venceEn > reclamadoEn SIEMPRE, para TODA clase (sostiene el CHECK), y es día hábil", () => {
        for (const clase of TODAS) {
            for (const s of ["2026-02-02T10:00:00Z", "2026-02-06T18:00:00Z", "2026-02-08T05:00:00Z"]) {
                const reclamadoEn = new Date(s);
                const venceEn = venceEnIncidente(clase, reclamadoEn);
                expect(venceEn.getTime(), `${clase} @ ${s}`).toBeGreaterThan(reclamadoEn.getTime());
                expect((venceEn.getTime() - reclamadoEn.getTime()) / DIA, `${clase} @ ${s} hábiles≠calendario`).toBeGreaterThan(
                    PLAZO_POR_CLASE[clase].diasHabiles,
                );
                expect(esDiaHabilColombia(venceEn), `${clase} @ ${s}`).toBe(true);
            }
        }
    });
});
