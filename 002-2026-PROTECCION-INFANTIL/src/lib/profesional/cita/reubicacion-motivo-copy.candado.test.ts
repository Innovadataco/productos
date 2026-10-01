/**
 * SPEC-814 · CANDADO del §1-ter (FORMA v1.5): los DOS motivos de orfandad NUNCA leen igual.
 *
 * Es el candado que pidió Diseño para que nadie «unifique» el copy más adelante — que es el defecto
 * entero: si los dos motivos leyeran igual, el operador reubicaría de inmediato un caso que el
 * profesional iba a renovar (anulando el aviso de SPEC-813) o esperaría uno que nadie va a arreglar.
 * El contraste es por ACCIÓN (puede resolverse sin reubicar / única salida), nunca por tiempo, nunca
 * exponiendo el estado de la cuenta, nunca insinuando reubicación automática.
 *
 * Puro (sin BD): el copy es un dato; `MotivoReubicacion` llega por `import type` (se borra en runtime).
 */
import { describe, it, expect } from "vitest";
import { COPY_MOTIVO_REUBICACION } from "./reubicacion-motivo-copy";

const PANEL = COPY_MOTIVO_REUBICACION.PANEL_BLOQUEADO;
const REGISTRO = COPY_MOTIVO_REUBICACION.REGISTRO_NO_VIGENTE;
const TODOS = Object.values(COPY_MOTIVO_REUBICACION);

describe("SPEC-814 · §1-ter · los dos motivos de orfandad leen DISTINTO", () => {
    it("ambos motivos tienen título y detalle no vacíos", () => {
        for (const c of TODOS) {
            expect(c.titulo.trim().length).toBeGreaterThan(0);
            expect(c.detalle.trim().length).toBeGreaterThan(0);
        }
    });

    it("NUNCA leen igual — título Y detalle distintos (impide «unificar» el copy)", () => {
        expect(PANEL.titulo).not.toBe(REGISTRO.titulo);
        expect(PANEL.detalle).not.toBe(REGISTRO.detalle);
    });

    it("el contraste es la ACCIÓN: panel = única salida; registro = puede resolverse sin reubicar", () => {
        expect(PANEL.detalle).toMatch(/única salida/i);
        expect(REGISTRO.detalle).toMatch(/sin reubicar/i);
    });

    it("NUNCA exponen el estado de la cuenta (inhabilitado/sancionado/suspendido)", () => {
        for (const c of TODOS) {
            expect(`${c.titulo} ${c.detalle}`).not.toMatch(/inhabilitad|sancionad|suspendid/i);
        }
    });

    it("NUNCA un plazo/umbral (sin dígitos) ni reubicación automática", () => {
        for (const c of TODOS) {
            const texto = `${c.titulo} ${c.detalle}`;
            expect(texto, "sin «48h», «3 días», etc. — la urgencia la da el orden, no el texto").not.toMatch(/\d/);
            expect(texto).not.toMatch(/autom[aá]tic/i);
        }
    });
});
