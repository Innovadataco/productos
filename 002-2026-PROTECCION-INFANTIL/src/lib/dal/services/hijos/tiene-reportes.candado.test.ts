/**
 * SPEC-660 (ola 2) · I-429 · CANDADO de `marcarTieneReportes`.
 *
 * Vigila tres cosas que el gráfico de hijos necesita duras:
 *  1. El CRITERIO — un identificador ACTIVO del hijo cuyo PAR (identificador, plataforma)
 *     coincide con el conjunto de «pares con reporte visible» (armado con el MISMO criterio del
 *     aviso, `hijos/notificaciones.ts`, y de «A quién protejo»). Un identificador apagado NO
 *     cuenta; y (I-429) el mismo alias en OTRA plataforma es OTRA cuenta → NO cuenta.
 *  2. Que lo que sale es un BOOLEANO y NADA MÁS — nunca un conteo (Diseño prohibió números).
 *  3. Muere por mutación: si el cruce deja de mirar `activo` o deja de mirar la plataforma, rojo.
 *
 * Puro, sin BD → unit.
 */
import { describe, it, expect } from "vitest";
import { marcarTieneReportes } from "./hijos";
import { claveParIdentificador } from "./cruce-identificador-plataforma";

type Id = { valor: string; activo: boolean; plataformaId: string | null };
const hijo = (id: string, ids: Id[]) => ({ id, identificadores: ids });
const par = (valor: string, plataformaId: string | null) => claveParIdentificador({ valor, plataformaId });

describe("SPEC-660 · I-429 · marcarTieneReportes (par identificador+plataforma; booleano)", () => {
    it("true cuando un identificador ACTIVO del hijo (par) está en el conjunto con-reporte", () => {
        const out = marcarTieneReportes([hijo("h1", [{ valor: "+57300", activo: true, plataformaId: "wa" }])], new Set([par("+57300", "wa")]));
        expect(out[0].tieneReportes).toBe(true);
    });

    it("false cuando el identificador que coincide está INACTIVO (el apagado del padre pesa)", () => {
        const out = marcarTieneReportes([hijo("h1", [{ valor: "+57300", activo: false, plataformaId: "wa" }])], new Set([par("+57300", "wa")]));
        expect(out[0].tieneReportes).toBe(false);
    });

    it("I-429: MISMO valor, OTRA plataforma → NO cuenta (el falso positivo que se cierra)", () => {
        // El hijo tiene el alias en Instagram; el reporte del conjunto es del mismo alias en WhatsApp.
        const out = marcarTieneReportes([hijo("h1", [{ valor: "@zaira", activo: true, plataformaId: "ig" }])], new Set([par("@zaira", "wa")]));
        expect(out[0].tieneReportes).toBe(false);
    });

    it("I-429: mismo valor en dos plataformas → cada par por su red (solo la reportada enciende)", () => {
        const out = marcarTieneReportes(
            [hijo("h1", [
                { valor: "@zaira", activo: true, plataformaId: "ig" },
                { valor: "@zaira", activo: true, plataformaId: "wa" },
            ])],
            new Set([par("@zaira", "wa")]),
        );
        expect(out[0].tieneReportes).toBe(true); // el par (@zaira, wa) SÍ está; el (@zaira, ig) no
    });

    it("identificador SIN plataforma (null) no matchea un reporte con plataforma", () => {
        const out = marcarTieneReportes([hijo("h1", [{ valor: "@zaira", activo: true, plataformaId: null }])], new Set([par("@zaira", "wa")]));
        expect(out[0].tieneReportes).toBe(false);
    });

    it("conjunto vacío (el 0-de-hoy real en prod) → todos en calma, sin romperse", () => {
        const out = marcarTieneReportes(
            [hijo("h1", [{ valor: "a", activo: true, plataformaId: "p" }]), hijo("h2", [{ valor: "b", activo: true, plataformaId: "p" }])],
            new Set<string>(),
        );
        expect(out.every((h) => h.tieneReportes === false)).toBe(true);
    });

    it("ESTRUCTURAL: agrega SOLO `tieneReportes` (boolean) — jamás un conteo", () => {
        const entrada = hijo("h1", [{ valor: "a", activo: true, plataformaId: "p" }]);
        const out = marcarTieneReportes([entrada], new Set([par("a", "p")]));
        const clavesAgregadas = Object.keys(out[0]).filter((k) => !(k in entrada));
        expect(clavesAgregadas, "el gráfico no puede recibir un número que tiene prohibido mostrar").toEqual([
            "tieneReportes",
        ]);
        expect(typeof out[0].tieneReportes).toBe("boolean");
    });
});
