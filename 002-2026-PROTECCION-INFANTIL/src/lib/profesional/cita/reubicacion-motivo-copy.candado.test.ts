/**
 * SPEC-814/836 · CANDADO del copy de los motivos de orfandad.
 *
 * Dos invariantes que cierran de raíz el defecto que encontramos (SPEC-836):
 *  1 · Los motivos NUNCA leen igual — para que nadie «unifique» el copy y el operador vuelva a no poder
 *      distinguir la ACCIÓN (esperar al profesional vs. es nuestro). Era el defecto entero.
 *  2 · La afirmación «ya se le avisó» (y variantes «avis…») SOLO puede vivir en el motivo cuyo estado
 *      DISPARA el banner de 813 — o sea CADUCADO (`REGISTRO_NO_VIGENTE`). En `PANEL_BLOQUEADO` y
 *      `REVISION_INTERNA` 813 NO le dijo nada al profesional, así que afirmar «ya se le avisó» ahí es
 *      mentira (el defecto de SPEC-836). Esto convierte «el copy no debe mentir» en algo que un test
 *      sostiene: el próximo que edite el texto no puede reintroducir la mentira sin ponerlo rojo.
 *
 * Puro (sin BD): el copy es un dato; `MotivoReubicacion` llega por `import type` (se borra en runtime).
 *
 * Nota SPEC-836: `REVISION_INTERNA` lleva HOY un PLACEHOLDER —Diseño emite el copy (lo pidió el CEO)—;
 * la página no está en el menú (no es alcanzable). El placeholder ya respeta las dos invariantes
 * (no dice «avis…», lee distinto); su contraste de ACCIÓN se afirma cuando llegue la forma.
 */
import { describe, it, expect } from "vitest";
import { COPY_MOTIVO_REUBICACION } from "./reubicacion-motivo-copy";

const PANEL = COPY_MOTIVO_REUBICACION.PANEL_BLOQUEADO;
const REGISTRO = COPY_MOTIVO_REUBICACION.REGISTRO_NO_VIGENTE;
const ENTRADAS = Object.entries(COPY_MOTIVO_REUBICACION);
const texto = (c: { titulo: string; detalle: string }) => `${c.titulo} ${c.detalle}`;

describe("SPEC-814/836 · copy de los motivos de orfandad", () => {
    it("todos los motivos tienen título y detalle no vacíos", () => {
        for (const [, c] of ENTRADAS) {
            expect(c.titulo.trim().length).toBeGreaterThan(0);
            expect(c.detalle.trim().length).toBeGreaterThan(0);
        }
    });

    it("NINGÚN par de motivos lee igual — título Y detalle distintos (impide «unificar» el copy)", () => {
        for (let i = 0; i < ENTRADAS.length; i++) {
            for (let j = i + 1; j < ENTRADAS.length; j++) {
                const [na, a] = ENTRADAS[i];
                const [nb, b] = ENTRADAS[j];
                expect(a.titulo, `${na} vs ${nb}: títulos iguales`).not.toBe(b.titulo);
                expect(a.detalle, `${na} vs ${nb}: detalles iguales`).not.toBe(b.detalle);
            }
        }
    });

    it("«avis…» SOLO en el motivo de CADUCADO (REGISTRO_NO_VIGENTE), el único con banner de 813", () => {
        const afirmaAviso = (c: { titulo: string; detalle: string }) => /avis/i.test(texto(c));
        // El único estado que 813 bannerea es CADUCADO → su motivo PUEDE afirmar que se avisó.
        expect(afirmaAviso(REGISTRO), "REGISTRO_NO_VIGENTE (CADUCADO) debería afirmar el aviso").toBe(true);
        // Todos los demás disparan en estados SIN banner → NUNCA pueden afirmar «avis…».
        for (const [nombre, c] of ENTRADAS) {
            if (nombre === "REGISTRO_NO_VIGENTE") continue;
            expect(afirmaAviso(c), `${nombre} dispara sin banner → no puede decir «avis…»`).toBe(false);
        }
    });

    it("el contraste conocido es la ACCIÓN: panel = única salida; registro = puede resolverse sin reubicar", () => {
        expect(PANEL.detalle).toMatch(/única salida/i);
        expect(REGISTRO.detalle).toMatch(/sin reubicar/i);
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
