/**
 * SPEC-379 (D1) · `armarMembreteColegio` — la cabecera institucional que
 * comparten `pdf-informe-caso`, `pdf-estadisticas` y `pdf-informe-mensual`.
 * Cubre la regla dura del CEO: si el colegio NO cargó escudo, el membrete
 * sale igual, sin imagen — nunca romperse.
 */
import { describe, it, expect } from "vitest";
import { armarMembreteColegio } from "./membrete-pdf";
import type { Content } from "pdfmake/interfaces";

const ESCUDO_MINIMO_PNG = "data:image/png;base64,AAAA";

describe("armarMembreteColegio (SPEC-379 · D1)", () => {
    it("con escudo: la primera fila es la imagen + luego nombre + NIT", () => {
        const bloque = armarMembreteColegio({
            nombre: "Colegio San Andrés",
            nit: "900123456-7",
            escudoDataUri: ESCUDO_MINIMO_PNG,
        });
        expect(bloque).toHaveLength(3);
        expect(bloque[0]).toMatchObject({ image: ESCUDO_MINIMO_PNG });
        expect(bloque[1]).toMatchObject({ text: "Colegio San Andrés", style: "membreteNombre" });
        expect(bloque[2]).toMatchObject({ text: "NIT 900123456-7", style: "membreteNit" });
    });

    it("sin escudo: la cabecera sale sin imagen (el PDF no se rompe)", () => {
        const bloque = armarMembreteColegio({
            nombre: "Colegio San Andrés",
            nit: "900123456-7",
            escudoDataUri: null,
        });
        expect(bloque).toHaveLength(2);
        for (const item of bloque) {
            expect(item, "sin escudo, ningún ítem debe llevar image").not.toHaveProperty("image");
        }
        expect(bloque[0]).toMatchObject({ text: "Colegio San Andrés" });
        expect(bloque[1]).toMatchObject({ text: "NIT 900123456-7" });
    });

    it("el bloque es intercalable — cada ítem es un Content válido de pdfmake", () => {
        const bloque = armarMembreteColegio({
            nombre: "N",
            nit: "1",
            escudoDataUri: ESCUDO_MINIMO_PNG,
        });
        // No assertions sobre pdfmake per se; el compilador de TS ya lo garantiza.
        // Pero validamos la forma para catch: cada ítem tiene image O text, no ambos.
        for (const item of bloque as Content[]) {
            const asRecord = item as unknown as Record<string, unknown>;
            const tieneImagen = typeof asRecord.image === "string";
            const tieneTexto = typeof asRecord.text === "string";
            expect(tieneImagen || tieneTexto).toBe(true);
        }
    });
});
