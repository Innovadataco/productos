/**
 * SPEC-768 · CANDADO de los festivos de Colombia (algorítmicos).
 *
 * Control positivo contra las listas PÚBLICAS conocidas (no re-derivadas del
 * mismo algoritmo): 2026 completo + puntos de 2025/2027. Cubre las tres familias:
 * fijos, Emiliani (mueve al lunes / se queda si ya es lunes) y relativos a Pascua
 * (Jueves/Viernes Santo NO se corren; Ascensión/Corpus/Sagrado Corazón sí).
 */
import { describe, it, expect } from "vitest";
import { festivosColombia, domingoDePascua, esFestivoColombia, isoCalendario } from "@/lib/fechas/festivos-colombia";

describe("SPEC-768 · festivos de Colombia", () => {
    it("2026 es EXACTAMENTE la lista pública (18 festivos)", () => {
        const esperado = [
            "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03",
            "2026-05-01", "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29",
            "2026-07-20", "2026-08-07", "2026-08-17", "2026-10-12", "2026-11-02",
            "2026-11-16", "2026-12-08", "2026-12-25",
        ];
        expect([...festivosColombia(2026)].sort()).toEqual([...esperado].sort());
    });

    it("Domingo de Pascua (gregoriano) para 2025/2026/2027", () => {
        expect(isoCalendario(domingoDePascua(2025))).toBe("2025-04-20");
        expect(isoCalendario(domingoDePascua(2026))).toBe("2026-04-05");
        expect(isoCalendario(domingoDePascua(2027))).toBe("2027-03-28");
    });

    it("Emiliani MUEVE al lunes: Reyes 2026 (6-ene martes) → 12-ene lunes", () => {
        expect(esFestivoColombia("2026-01-12")).toBe(true);
        expect(esFestivoColombia("2026-01-06")).toBe(false); // el 6 ya NO es festivo, se corrió
    });

    it("Emiliani se QUEDA si ya es lunes: Reyes 2025 (6-ene lunes) → 6-ene", () => {
        expect(esFestivoColombia("2025-01-06")).toBe(true);
    });

    it("Jueves y Viernes Santo NO se corren (2026: 2-abr y 3-abr, jueves y viernes)", () => {
        expect(esFestivoColombia("2026-04-02")).toBe(true); // Jueves Santo
        expect(esFestivoColombia("2026-04-03")).toBe(true); // Viernes Santo
    });

    it("relativos a Pascua movidos por Emiliani (2026): Ascensión 18-may, Corpus 8-jun, Sagrado Corazón 15-jun", () => {
        expect(esFestivoColombia("2026-05-18")).toBe(true);
        expect(esFestivoColombia("2026-06-08")).toBe(true);
        expect(esFestivoColombia("2026-06-15")).toBe(true);
    });

    it("un día común NO es festivo", () => {
        expect(esFestivoColombia("2026-01-02")).toBe(false);
        expect(esFestivoColombia("2026-07-21")).toBe(false);
    });
});
