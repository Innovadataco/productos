/**
 * CANDADO · SPEC-790 · la traducción cita→REPS vive en un solo lugar, es EXHAUSTIVA sobre `ModalidadCita`
 * y un valor sin mapeo FALLA HACIA NEGAR + queda REGISTRADO.
 *
 *  · VIRTUAL→TELEMEDICINA, PRESENCIAL→PRESENCIAL (los dos ejes no son el mismo nombre).
 *  · Exhaustividad: TODO valor de `ModalidadCita` mapea — si mañana se agrega uno sin mapearlo, este
 *    candado cae (complementa la exhaustividad del `Record` en compilación, para el camino de `string`).
 *  · No-mapeo: un valor desconocido NO se traduce en silencio — `modalidadCitaAReps` lo marca `mapea:false`
 *    y `modalidadRepsRequerida` NIEGA (`null`) y REGISTRA (warn). Control positivo: el warn se dispara.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { ModalidadCita } from "@prisma/client";
import { modalidadCitaAReps, modalidadRepsRequerida } from "./modalidad-cita-a-reps";

afterEach(() => vi.restoreAllMocks());

describe("SPEC-790 · modalidad cita→REPS", () => {
    it("traduce entre los dos ejes: VIRTUAL→TELEMEDICINA, PRESENCIAL→PRESENCIAL", () => {
        expect(modalidadCitaAReps(ModalidadCita.VIRTUAL)).toEqual({ mapea: true, reps: "TELEMEDICINA" });
        expect(modalidadCitaAReps(ModalidadCita.PRESENCIAL)).toEqual({ mapea: true, reps: "PRESENCIAL" });
    });

    it("exhaustivo: TODO valor de ModalidadCita mapea (un valor nuevo sin mapear cae acá)", () => {
        for (const v of Object.values(ModalidadCita)) {
            const m = modalidadCitaAReps(v);
            expect(m.mapea, `ModalidadCita.${v} no está mapeada al eje REPS`).toBe(true);
        }
    });

    it("no-mapeo: un valor desconocido NO se traduce en silencio (mapea:false, lleva el valor)", () => {
        const m = modalidadCitaAReps("HIBRIDA");
        expect(m.mapea).toBe(false);
        expect(m).toEqual({ mapea: false, valorSinMapeo: "HIBRIDA" });
    });

    it("modalidadRepsRequerida: conocido→eje REPS; desconocido→NIEGA (null) y REGISTRA (warn)", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(modalidadRepsRequerida(ModalidadCita.VIRTUAL)).toBe("TELEMEDICINA");
        expect(warn).not.toHaveBeenCalled();

        expect(modalidadRepsRequerida("HIBRIDA"), "un valor sin mapeo niega, no se cuela").toBeNull();
        expect(warn, "el no-mapeo queda registrado: si no, un habilitado cae del directorio en silencio").toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0]?.[0])).toContain("HIBRIDA");
    });
});
