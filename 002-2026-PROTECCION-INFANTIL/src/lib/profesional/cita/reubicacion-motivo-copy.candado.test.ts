/**
 * SPEC-814/836/852 · CANDADO del copy del motivo de orfandad.
 *
 * SPEC-852 (eliminación de REPS) · la cola de reubicación colapsó a UN solo motivo (`PANEL_BLOQUEADO`):
 * se fueron `REGISTRO_NO_VIGENTE` y `REVISION_INTERNA`, que derivaban de `clasificarReps`. Con un solo
 * motivo ya no hay par que «unificar» ni eje REPS vs interno que confundir; lo que SOBREVIVE son las
 * invariantes del copy que NO dependían de REPS y que siguen protegiendo al operador y a la familia:
 *  1 · El copy es SOBRIO: nunca expone el estado de la cuenta (inhabilitado/sancionado/suspendido).
 *  2 · Nunca lleva plazo/umbral (sin dígitos) ni insinúa reubicación automática — la urgencia la da el
 *      orden de la cola, no el texto.
 *  3 · El motivo nombra la ACCIÓN del operador: `PANEL_BLOQUEADO` es la ÚNICA salida (el profesional no
 *      puede resolverlo por su cuenta).
 *
 * Puro (sin BD): el copy es un dato; `MotivoReubicacion` llega por `import type` (se borra en runtime).
 */
import { describe, it, expect } from "vitest";
import { COPY_MOTIVO_REUBICACION } from "./reubicacion-motivo-copy";

const PANEL = COPY_MOTIVO_REUBICACION.PANEL_BLOQUEADO;
const ENTRADAS = Object.entries(COPY_MOTIVO_REUBICACION);
const texto = (c: { titulo: string; detalle: string }) => `${c.titulo} ${c.detalle}`;

describe("SPEC-814/852 · copy del motivo de orfandad (PANEL_BLOQUEADO)", () => {
    it("todos los motivos tienen título y detalle no vacíos", () => {
        for (const [, c] of ENTRADAS) {
            expect(c.titulo.trim().length).toBeGreaterThan(0);
            expect(c.detalle.trim().length).toBeGreaterThan(0);
        }
    });

    it("PANEL_BLOQUEADO nombra la ACCIÓN: reubicar es la única salida", () => {
        expect(PANEL.detalle).toMatch(/única salida/i);
    });

    it("NINGÚN motivo expone el estado de la cuenta (inhabilitado/sancionado/suspendido)", () => {
        for (const [, c] of ENTRADAS) {
            expect(texto(c)).not.toMatch(/inhabilitad|sancionad|suspendid/i);
        }
    });

    it("NINGÚN motivo lleva plazo/umbral (sin dígitos) ni insinúa reubicación automática", () => {
        for (const [, c] of ENTRADAS) {
            expect(texto(c), "sin «48h», «3 días» — la urgencia la da el orden, no el texto").not.toMatch(/\d/);
            expect(texto(c)).not.toMatch(/autom[aá]tic/i);
        }
    });
});
