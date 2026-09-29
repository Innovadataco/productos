/**
 * CANDADO · INVARIANTE DE PRODUCTO (veredicto CEO 29-09-2026) — el camino de REPORTE y los
 * canales oficiales de emergencia NUNCA se gatean.
 *
 * Es protección infantil: una compuerta que impida a un padre DENUNCIAR porque no completó un
 * trámite (consentimiento, audiencia del menor, vigencia, perfil, pago) es el producto trabajando
 * CONTRA su propósito. No hay formalidad —ni legal— que lo justifique.
 *
 * ── QUÉ AFIRMA ESTE CANDADO (lista completa, para que el split no pierda invariantes) ──────────
 *   1. El set `SUPERFICIES_PROTECCION` está bien formado (no vacío, no vacuo).
 *   2. NINGUNA compuerta EXISTENTE del padre (consentimiento → camino → vigencia) tapa las
 *      superficies de protección (cada una exenta o pública).
 *   3. Los canales oficiales (141 / CAI / Te Protejo) viven en una superficie PÚBLICA (`/reportar`).
 *   4. La compuerta de AUDIENCIA del menor (SPEC-751, `audienciaGateDetiene`) nunca detiene la vía
 *      de reporte — con control positivo (gate cerrado SÍ detiene lo operativo, NUNCA la protección).
 *
 * PROCEDENCIA (SPEC-751 → PR propio): los invariantes 1–3 se SACARON a un PR propio (#764) porque
 * arreglan un defecto VIVO (padre con consentimiento pendiente rebotado de la vía de reporte) y
 * Dev-1 los necesita como fuente única (SPEC-784). El invariante 4 —la MITAD de audiencia— se quedó
 * en SPEC-751 (con la tabla `AudienciaMenor`). RE-AGREGADO acá al rebasar 751 sobre el main que ya
 * trae 1–3: el candado vuelve a vigilar las CUATRO cosas, no tres.
 *
 * Estructural, con control positivo (gate cerrado → reporte accesible); cae si una compuerta los tapa.
 * Unit puro (sin BD).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
    GUARDIAS_ACCESO,
    SUPERFICIES_PROTECCION,
    esSuperficieDeProteccion,
    esRutaPublica,
    matcheaRuta,
} from "./guardias";
import { audienciaGateDetiene } from "@/lib/consentimiento/audiencia-gate";

/** ¿`ruta` está exenta de un guardián? En sus `exentas`, o por ser pública (universal). */
const exentaEn = (ruta: string, exentas: readonly string[]): boolean =>
    esRutaPublica(ruta) || exentas.some((e) => matcheaRuta(ruta, e));

describe("INVARIANTE · el set de protección está bien formado (no vacío, no vacuo)", () => {
    it("esSuperficieDeProteccion reconoce cada miembro del set", () => {
        expect(SUPERFICIES_PROTECCION.length).toBeGreaterThanOrEqual(4);
        for (const r of SUPERFICIES_PROTECCION) expect(esSuperficieDeProteccion(r)).toBe(true);
    });
    it("NO reconoce una ruta operativa cualquiera (control: el matcher no es vacuo)", () => {
        expect(esSuperficieDeProteccion("/dashboard/padre/suscripcion")).toBe(false);
        expect(esSuperficieDeProteccion("/dashboard/padre/profesionales")).toBe(false);
    });
});

describe("INVARIANTE · ninguna compuerta EXISTENTE tapa la vía de reporte", () => {
    // Los tres guardianes que corren para el padre, en el ORDEN real de guardias.ts
    // (consentimiento → camino → vigencia). Cada uno debe eximir TODA superficie de protección.
    const guardianesDelPadre: Array<[string, readonly string[]]> = [
        ["consentimiento", GUARDIAS_ACCESO.consentimiento.exentas],
        ["camino", GUARDIAS_ACCESO.camino.exentas],
        ["vigencia.PARENT", GUARDIAS_ACCESO.vigencia.PARENT.exentas],
    ];

    for (const [nombre, exentas] of guardianesDelPadre) {
        for (const ruta of SUPERFICIES_PROTECCION) {
            it(`${nombre} exime ${ruta}`, () => {
                expect(exentaEn(ruta, exentas), `la compuerta ${nombre} tapa la vía de reporte ${ruta}`).toBe(true);
            });
        }
    }
});

describe("INVARIANTE · la compuerta de AUDIENCIA (SPEC-751) nunca detiene la vía de reporte", () => {
    it("gate CERRADO (titular NO al día) → NO detiene ninguna superficie de protección", () => {
        for (const r of SUPERFICIES_PROTECCION) {
            expect(audienciaGateDetiene(r, false), `la audiencia tapó la vía de reporte ${r}`).toBe(false);
        }
    });
    it("gate CERRADO → SÍ detiene la continuación OPERATIVA (control: el gate sí actúa)", () => {
        expect(audienciaGateDetiene("/dashboard/padre/profesionales", false)).toBe(true);
        expect(audienciaGateDetiene("/dashboard/padre", false)).toBe(true);
    });
    it("gate ABIERTO (titular al día) → no detiene nada", () => {
        expect(audienciaGateDetiene("/dashboard/padre", true)).toBe(false);
    });
});

describe("INVARIANTE · los canales oficiales de emergencia viven en una superficie pública", () => {
    it("/reportar es PÚBLICO (sin JWT) y renderiza CanalesOficiales (141 / CAI / Te Protejo)", () => {
        expect(esRutaPublica("/reportar")).toBe(true);
        const page = fs.readFileSync(path.resolve(__dirname, "../../app/reportar/page.tsx"), "utf-8");
        expect(page, "la página pública de reporte dejó de mostrar los canales oficiales").toContain("CanalesOficiales");
    });
});
