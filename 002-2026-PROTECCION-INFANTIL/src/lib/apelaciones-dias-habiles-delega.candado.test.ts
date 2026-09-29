/**
 * SPEC-768 · CANDADO: apelaciones DELEGA los días hábiles al módulo corregido, y
 * NO reintroduce el bug de tipos en su propio archivo.
 *
 * El CEO lo pidió explícito: el instante y TODAS las comparaciones pasan por el
 * mismo camino consciente de zona. Si apelaciones volviera a calcular con `getDay`
 * crudo / `Date.UTC` medianoche, el bug vuelve en el sitio de lectura. Este candado
 * (a) prueba la paridad conductual (los exports de apelaciones == el módulo) y
 * (b) escanea la fuente: apelaciones ya no importa de `date-fns` ni define su
 * medianoche-UTC — el camino sesgado se REMOVIÓ, no se sumó al lado.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { formatInTimeZone } from "date-fns-tz";
import { esDiaHabil, sumarDiasHabiles, diasHabilesTranscurridos } from "@/lib/apelaciones";
import {
    esDiaHabilColombia,
    sumarDiasHabilesColombia,
    diasHabilesTranscurridosColombia,
} from "@/lib/fechas/dias-habiles-colombia";

describe("SPEC-768 · apelaciones delega al módulo de días hábiles", () => {
    it("los exports de apelaciones dan lo MISMO que el módulo (delegación real, no copia)", () => {
        for (const f of [new Date("2026-01-03T10:00:00Z"), new Date("2026-01-12T10:00:00Z"), new Date("2026-02-02T10:00:00Z")]) {
            expect(esDiaHabil(f)).toBe(esDiaHabilColombia(f));
            expect(sumarDiasHabiles(f, 15).toISOString()).toBe(sumarDiasHabilesColombia(f, 15).toISOString());
        }
        const desde = new Date("2026-01-05T10:00:00Z");
        const hasta = new Date("2026-01-14T10:00:00Z");
        expect(diasHabilesTranscurridos(desde, hasta)).toBe(diasHabilesTranscurridosColombia(desde, hasta));
    });

    it("por la API de apelaciones, el ancla en sábado ya NO vence en sábado (el arreglo llega a sus consumidores)", () => {
        const venceEn = sumarDiasHabiles(new Date("2026-01-03T10:00:00Z"), 15);
        expect(formatInTimeZone(venceEn, "America/Bogota", "yyyy-MM-dd")).toBe("2026-01-26");
        expect(esDiaHabil(venceEn)).toBe(true);
    });

    it("apelaciones.ts ya NO calcula días hábiles con el camino sesgado (getDay crudo / medianoche UTC)", () => {
        const src = readFileSync(path.resolve(__dirname, "apelaciones.ts"), "utf8");
        expect(src, "no reimporta getDay/addDays de date-fns (el camino del bug)").not.toMatch(/from ["']date-fns["']/);
        expect(src, "no vuelve a definir su medianoche-UTC (el aliasing)").not.toMatch(/inicioDeDiaBogota/);
    });
});
