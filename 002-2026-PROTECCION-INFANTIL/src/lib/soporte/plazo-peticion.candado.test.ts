/**
 * SPEC-752 · CANDADO del término de la petición (venceEn) POR MOTIVO.
 *
 * Fuente ÚNICA (un mapa, NO un switch): CADA valor del enum MotivoPeticionServicio
 * está mapeado y NINGUNA clave sobra (paridad con el enum de Prisma — control
 * positivo en ambos sentidos; si mañana se agrega un motivo al enum sin plazo, ROJO).
 * Son DOS términos LEGALES con plazos DISTINTOS (datos=10 Ley 1581, pago=15 Decreto
 * 1074/2015) + tres internos de 5. Los legales quedan CLAVADOS: subirlos o bajarlos
 * («optimizar») rompe el candado. venceEn > creadoEn SIEMPRE (sostiene el CHECK), es
 * HÁBILES no calendario, y cae en día hábil. Puro, sin BD.
 */
import { describe, it, expect } from "vitest";
import { MotivoPeticionServicio } from "@prisma/client";
import { esDiaHabilColombia } from "@/lib/fechas/dias-habiles-colombia";
import {
    venceEnPeticionServicio,
    plazoDeMotivoDiasHabiles,
    motivoTieneTerminoLegal,
    PLAZO_POR_MOTIVO,
    PLAZO_INTERNO_DIAS_HABILES,
} from "@/lib/soporte/plazo-peticion";

const DIA = 86_400_000;
const CREADOS = ["2026-02-02T10:00:00Z", "2026-02-06T18:00:00Z", "2026-02-08T05:00:00Z"];
const INTERNOS = ["CITA", "SERVICIO_PLATAFORMA", "OTRA"] as const;

describe("SPEC-752 · término por motivo (fuente única, sin switch)", () => {
    it("paridad con el enum: TODO motivo está mapeado y NINGUNA clave sobra", () => {
        const valores = new Set<string>(Object.values(MotivoPeticionServicio));
        for (const m of valores) {
            expect(PLAZO_POR_MOTIVO[m], `motivo ${m} sin mapear (hueco)`).toBeDefined();
        }
        for (const k of Object.keys(PLAZO_POR_MOTIVO)) {
            expect(valores.has(k), `clave ${k} no es un motivo del enum`).toBe(true);
        }
    });

    it("DOS legales con plazos DISTINTOS, clavados: datos=10 (Ley 1581), pago=15 (Dcto 1074/2015)", () => {
        expect(PLAZO_POR_MOTIVO.DATOS_PERSONALES).toEqual({ diasHabiles: 10, legal: true });
        expect(PLAZO_POR_MOTIVO.PAGO_O_COBRO).toEqual({ diasHabiles: 15, legal: true });
        expect(PLAZO_POR_MOTIVO.DATOS_PERSONALES.diasHabiles).not.toBe(
            PLAZO_POR_MOTIVO.PAGO_O_COBRO.diasHabiles,
        );
    });

    it("tres internos de 5 (no legal)", () => {
        expect(PLAZO_INTERNO_DIAS_HABILES).toBe(5);
        for (const m of INTERNOS) {
            expect(PLAZO_POR_MOTIVO[m]).toEqual({ diasHabiles: 5, legal: false });
        }
    });

    it("motivoTieneTerminoLegal: solo los dos legales; los tres internos no", () => {
        expect(motivoTieneTerminoLegal("DATOS_PERSONALES")).toBe(true);
        expect(motivoTieneTerminoLegal("PAGO_O_COBRO")).toBe(true);
        for (const m of INTERNOS) {
            expect(motivoTieneTerminoLegal(m)).toBe(false);
        }
    });

    it("venceEn > creadoEn SIEMPRE, para TODO motivo (sostiene el CHECK venceEn > creadoEn)", () => {
        for (const m of Object.values(MotivoPeticionServicio)) {
            for (const s of CREADOS) {
                const c = new Date(s);
                expect(venceEnPeticionServicio(m, c).getTime(), `${m} @ ${s}`).toBeGreaterThan(
                    c.getTime(),
                );
            }
        }
    });

    it("es HÁBILES no calendario (cruza findes/festivos) y cae en día hábil, para TODO motivo", () => {
        for (const m of Object.values(MotivoPeticionServicio)) {
            const dias = plazoDeMotivoDiasHabiles(m);
            for (const s of CREADOS) {
                const c = new Date(s);
                const v = venceEnPeticionServicio(m, c);
                expect((v.getTime() - c.getTime()) / DIA, `${m} @ ${s}`).toBeGreaterThan(dias);
                expect(esDiaHabilColombia(v), `${m} @ ${s}`).toBe(true);
            }
        }
    });

    it("un plazo mayor vence más tarde: pago(15) > datos(10) > interno(5) desde el mismo creadoEn", () => {
        const c = new Date("2026-02-02T10:00:00Z");
        const pago = venceEnPeticionServicio("PAGO_O_COBRO", c).getTime();
        const datos = venceEnPeticionServicio("DATOS_PERSONALES", c).getTime();
        const interno = venceEnPeticionServicio("CITA", c).getTime();
        expect(pago).toBeGreaterThan(datos);
        expect(datos).toBeGreaterThan(interno);
    });
});
