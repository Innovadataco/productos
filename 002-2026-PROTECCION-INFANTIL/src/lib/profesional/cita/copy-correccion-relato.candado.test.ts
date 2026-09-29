/**
 * SPEC-780 · CANDADO del copy del límite (FORMA-SPEC780). El copy DEBE decir los dos límites que
 * el padre no adivina, y NUNCA prometer un borrado (es corrección con rastro, no un borrón). Puro.
 */
import { describe, it, expect } from "vitest";
import { COPY_CORRECCION_RELATO } from "@/lib/profesional/cita/copy-correccion-relato";

const TODO = Object.values(COPY_CORRECCION_RELATO).join(" \n ");

describe("SPEC-780 · copy del límite de corregir el relato", () => {
    it("límite 1: dice que las versiones anteriores NO cambian y son el registro de entonces", () => {
        expect(COPY_CORRECCION_RELATO.limiteVersiones).toMatch(/no cambian/i);
        expect(COPY_CORRECCION_RELATO.limiteVersiones).toMatch(/registro/i);
        expect(COPY_CORRECCION_RELATO.limiteVersiones).toMatch(/no borra/i); // negación explícita
    });

    it("límite 2: dice que el profesional ya leyó y que la corrección queda anotada (rastro)", () => {
        expect(COPY_CORRECCION_RELATO.limiteProfesional).toMatch(/ya ley[óo]/i);
        expect(COPY_CORRECCION_RELATO.limiteProfesional).toMatch(/anotad|no reemplaza en silencio/i);
    });

    it("NUNCA promete un borrado (corrección con rastro, no borrón) y no promete plazo", () => {
        // Prohíbe la afirmación POSITIVA de borrado; «no borra» (negación) sí es válido.
        expect(TODO).not.toMatch(/\bborramos\b|\beliminamos\b|\beliminad|\bborrad[ao]s?\b/i);
        expect(TODO, "sin plazo en la cara del padre").not.toMatch(/\bd[ií]as\b|\bplazo\b|\ben \d+\b/i);
    });
});
