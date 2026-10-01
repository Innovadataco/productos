/**
 * CANDADO · SPEC-796 (FORMA-SPEC796) — la forma de las dos superficies del contrato.
 *
 * Lee las fuentes REALES de los dos componentes (no una lista a mano):
 *  · CERO promesa de validez: no «firmado digitalmente / válido / verificado / autenticado» (§0 — no
 *    validamos la firma, solo la tenemos en archivo). Sí «registrado / en archivo».
 *  · El estado SIN contrato queda INTACTO, byte a byte (el texto ámbar aprobado).
 *  · «Ver contrato» del colegio va al ENDPOINT GUARDADO, NO a un href crudo a `contratoPDFUrl`.
 * Control positivo por mutación en memoria (una frase de validez → cae).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url)); // …/components/modules/cliente/suscripcion
const CONTRATO_CARD = resolve(AQUI, "ContratoCard.tsx");
const ADMIN_ADJUNTAR = resolve(AQUI, "../../admin/pagos/AdjuntarContratoColegio.tsx");

const TEXTO_SIN_CONTRATO =
    "Aún no hay un contrato firmado registrado. El equipo se pondrá en contacto para completarlo.";

/** Palabras/frases que AFIRMAN validez de la firma (prohibidas, §0). «firmado» a secas es el rótulo, OK. */
export function afirmaValidez(texto: string): boolean {
    return /digitalmente|verificad[oa]|autenticad[oa]|firma\s+válida|válid[oa]/i.test(texto);
}

describe("SPEC-796 · forma del contrato (dos superficies)", () => {
    const card = readFileSync(CONTRATO_CARD, "utf8");
    const admin = readFileSync(ADMIN_ADJUNTAR, "utf8");

    it("NINGUNA superficie afirma validez de la firma (§0)", () => {
        // Se mira el texto visible y el copy; el comentario de cabecera cita las palabras para
        // PROHIBIRLAS, así que el scan corre sobre el cuerpo sin el bloque de comentario superior.
        const cuerpo = (s: string) => s.replace(/\/\*\*[\s\S]*?\*\//, "");
        expect(afirmaValidez(cuerpo(card)), "ContratoCard afirma validez").toBe(false);
        expect(afirmaValidez(cuerpo(admin)), "AdjuntarContratoColegio afirma validez").toBe(false);
    });

    it("usa el vocabulario permitido (registrado / en archivo)", () => {
        expect(card).toMatch(/en archivo|registrado/i);
        expect(admin).toMatch(/adjuntado|registrado/i);
    });

    it("el estado SIN contrato queda INTACTO, byte a byte", () => {
        expect(card).toContain(TEXTO_SIN_CONTRATO);
    });

    it("«Ver contrato» del colegio va al endpoint GUARDADO, no a un href crudo del campo deprecado", () => {
        expect(card).toContain("/api/colegio/contrato/pdf");
        expect(card, "quedó un href directo al valor del contrato (URL cruda)").not.toMatch(/href=\{\s*contrato/);
        expect(card).not.toContain("contratoPDFUrl ?"); // ni el ternario viejo del campo deprecado
    });

    it("CONTROL POSITIVO: el detector de validez caza las frases prohibidas (y no el rótulo)", () => {
        expect(afirmaValidez("firma válida")).toBe(true);
        expect(afirmaValidez("firmado digitalmente")).toBe(true);
        expect(afirmaValidez("documento verificado")).toBe(true);
        expect(afirmaValidez("Contrato firmado")).toBe(false); // el rótulo NO es una afirmación de validez
        expect(afirmaValidez("Tenemos tu contrato en archivo.")).toBe(false);
    });
});
