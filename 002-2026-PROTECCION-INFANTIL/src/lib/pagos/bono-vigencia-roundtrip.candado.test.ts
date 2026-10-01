/**
 * SPEC-805 · Candado de ROUND-TRIP: la vigencia de un cupón se ESCRIBE y se LEE en el mismo espacio.
 *
 * El escritor (`calcularVentanaVigenciaCupon`, entregar-cupones-recompensa) y el lector vivo
 * (`esVigente`, bono-aplicacion) deben compartir espacio de instante. Si uno queda en pseudo-instante
 * (`toZonedTime(new Date(), Bogota)` = instante real − 5h) y el otro en instante real, un cupón recién
 * creado NO es vigente en su propio instante de creación, o caduca 5h antes de lo debido.
 *
 * Este candado COMPONE las dos funciones REALES (no reconstruye la lógica → no es tautológico) y fija:
 *   1) round-trip: un cupón creado en T es vigente en T y en los bordes de su ventana.
 *   2) control positivo del par: desincronizar UN solo lado produce el sesgo — en el lector (no-vigente
 *      en T) y en el escritor (caduca 5h antes). Deja la trampa documentada en el ÁRBOL, no en un
 *      comentario que alguien borra.
 */
import { describe, it, expect, vi } from "vitest";
import type { BonoPromocional } from "@prisma/client";

// esVigente y calcularVentanaVigenciaCupon son puras, pero importar sus módulos arrastra la cadena de
// auditoría (`@/lib/audit` → anti-abuso → requireEnv ANTI_ABUSO_SALT), que no vive en el entorno unit.
// Mismo patrón que los demás tests unitarios de pagos: se mockea audit (estas funciones no lo usan).
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));

import { esVigente } from "./bono-aplicacion.service";
import { calcularVentanaVigenciaCupon } from "./entregar-cupones-recompensa.service";

const DIA_MS = 24 * 60 * 60 * 1000;
// El pseudo-instante era `toZonedTime(new Date(), Bogota)`; en el entorno de prod/CI (UTC) eso da
// instante real − 5h. Lo modelamos con un offset EXPLÍCITO, no llamando a toZonedTime: su resultado
// depende del TZ del runner (en una Mac con TZ=America/Bogota es identidad), y un candado no puede
// cambiar de veredicto según dónde corra. 5h es el corrimiento que el pseudo-instante producía.
const OFFSET_PSEUDO_MS = 5 * 60 * 60 * 1000;

function bonoConVentana(base: Date, dias: number): BonoPromocional {
    const { vigenciaInicio, vigenciaFin } = calcularVentanaVigenciaCupon(base, dias);
    return { vigenciaInicio, vigenciaFin } as unknown as BonoPromocional;
}

describe("SPEC-805 · round-trip vigencia de cupón (escritor ↔ esVigente)", () => {
    const base = new Date("2026-03-15T20:00:00.000Z"); // instante real arbitrario
    const dias = 30;

    it("un cupón creado en T es vigente evaluado en T (mismo espacio)", () => {
        const bono = bonoConVentana(base, dias);
        expect(esVigente(bono, base)).toBe(true);
    });

    it("la ventana abre en T y cierra en T+dias (bordes)", () => {
        const bono = bonoConVentana(base, dias);
        expect(esVigente(bono, new Date(base.getTime() - 1))).toBe(false); // 1 ms antes de abrir
        expect(esVigente(bono, bono.vigenciaFin)).toBe(true); // último instante vigente
        expect(esVigente(bono, new Date(bono.vigenciaFin.getTime() + 1))).toBe(false); // 1 ms tras cerrar
    });

    it("control positivo: desincronizar el LECTOR a pseudo-instante → no-vigente en T", () => {
        const bono = bonoConVentana(base, dias); // escritor REAL
        const lectorPseudo = new Date(base.getTime() - OFFSET_PSEUDO_MS); // el viejo esVigente: real − 5h
        expect(esVigente(bono, lectorPseudo)).toBe(false); // el sesgo: cupón recién creado, NO vigente
    });

    it("control positivo: desincronizar el ESCRITOR a pseudo-instante → caduca 5h antes", () => {
        const basePseudo = new Date(base.getTime() - OFFSET_PSEUDO_MS); // escritor en pseudo: ancla 5h atrás
        const bonoPseudo = bonoConVentana(basePseudo, dias);
        const casiCierreReal = new Date(base.getTime() + dias * DIA_MS - 1000); // 1 s antes del cierre REAL
        expect(esVigente(bonoPseudo, casiCierreReal)).toBe(false); // el sesgo: ya caducó
    });
});
