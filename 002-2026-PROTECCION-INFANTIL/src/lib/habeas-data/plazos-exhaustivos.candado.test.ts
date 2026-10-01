/**
 * CANDADO · SPEC-798 (paso 1) — `plazoMaximoLegalDiasHabiles` es EXHAUSTIVA.
 *
 * El centro del radicado: un tipo NUEVO de habeas data no puede heredar un plazo por el `else` de un
 * ternario (I-434). La exhaustividad en COMPILE-TIME la enforce `tsc` (el `const _: never = tipo` del
 * default); acá se prueba la CONDUCTA en runtime + el control positivo por MUTACIÓN:
 *
 *  · iterar TODO `Object.values(TipoSolicitudHabeasData)` (el enum REAL del cliente): cada valor devuelve
 *    un techo positivo. Si mañana se agrega un valor y no se le fija techo, la función LANZA para ese
 *    valor → este test se pone ROJO. Esa es la mutación: el candado vive atado al enum real, no a una lista.
 *  · control positivo explícito: un tipo NO manejado LANZA (no devuelve un número inventado).
 *
 * Puro (sin BD): la función es dato + lógica.
 */
import { describe, it, expect } from "vitest";
import { TipoSolicitudHabeasData } from "@prisma/client";
import {
    plazoMaximoLegalDiasHabiles,
    PLAZO_MAX_CONSULTA_DIAS_HABILES,
    PLAZO_MAX_RECLAMO_DIAS_HABILES,
} from "./plazos-legales";

describe("SPEC-798 · plazoMaximoLegalDiasHabiles es exhaustiva (ningún tipo hereda plazo por omisión)", () => {
    it("TODO valor del enum real devuelve un techo positivo (si se agrega uno sin techo, esto se pone rojo)", () => {
        const tipos = Object.values(TipoSolicitudHabeasData);
        expect(tipos.length).toBeGreaterThanOrEqual(3);
        for (const tipo of tipos) {
            const techo = plazoMaximoLegalDiasHabiles(tipo);
            expect(techo, `${tipo} no tiene techo legal fijado`).toBeGreaterThan(0);
        }
    });

    it("los techos de los tipos existentes son los de la NORMA (si suben, cambió la ley, no el código)", () => {
        expect(plazoMaximoLegalDiasHabiles("CONSULTA")).toBe(PLAZO_MAX_CONSULTA_DIAS_HABILES);
        expect(plazoMaximoLegalDiasHabiles("CONSULTA")).toBe(10);
        expect(plazoMaximoLegalDiasHabiles("RECTIFICACION")).toBe(PLAZO_MAX_RECLAMO_DIAS_HABILES);
        expect(plazoMaximoLegalDiasHabiles("SUPRESION")).toBe(15);
    });

    it("CONTROL POSITIVO por mutación: un tipo NO manejado LANZA (no inventa un plazo)", () => {
        // Simula agregar un cuarto valor al enum sin fijarle techo: el `default` DEBE lanzar.
        // En compile-time, además, `const _: never = tipo` haría fallar `tsc` — doble guarda.
        const tipoSinTecho = "TIPO_SIN_TECHO" as TipoSolicitudHabeasData;
        expect(() => plazoMaximoLegalDiasHabiles(tipoSinTecho)).toThrow(/sin techo legal/);
    });
});
