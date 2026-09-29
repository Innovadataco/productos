/**
 * SPEC-752 · CANDADO del término interno de la petición (venceEn).
 * `venceEn > creadoEn` SIEMPRE (sostiene el CHECK), 5 días HÁBILES (no calendario)
 * y cae en día hábil. Puro, sin BD.
 */
import { describe, it, expect } from "vitest";
import { esDiaHabilColombia } from "@/lib/fechas/dias-habiles-colombia";
import { venceEnPeticionServicio, PLAZO_INTERNO_PETICION_DIAS_HABILES } from "@/lib/soporte/plazo-peticion";

const DIA = 86_400_000;

describe("SPEC-752 · venceEnPeticionServicio (término interno de 5 hábiles)", () => {
    it("el término interno es 5 días hábiles (decisión CEO)", () => {
        expect(PLAZO_INTERNO_PETICION_DIAS_HABILES).toBe(5);
    });

    it("venceEn > creadoEn SIEMPRE (sostiene el CHECK venceEn > creadoEn)", () => {
        for (const s of ["2026-02-02T10:00:00Z", "2026-02-06T18:00:00Z", "2026-02-08T05:00:00Z"]) {
            const c = new Date(s);
            expect(venceEnPeticionServicio(c).getTime(), s).toBeGreaterThan(c.getTime());
        }
    });

    it("es HÁBILES no calendario (gap > 5 días: cruza fin de semana) y cae en día hábil", () => {
        for (const s of ["2026-02-02T10:00:00Z", "2026-02-06T18:00:00Z", "2026-02-08T05:00:00Z"]) {
            const c = new Date(s);
            const v = venceEnPeticionServicio(c);
            expect((v.getTime() - c.getTime()) / DIA, s).toBeGreaterThan(5);
            expect(esDiaHabilColombia(v), s).toBe(true);
        }
    });
});
