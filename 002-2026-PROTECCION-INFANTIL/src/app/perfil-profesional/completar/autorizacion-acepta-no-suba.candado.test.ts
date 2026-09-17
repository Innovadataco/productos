/**
 * SPEC-704 (ajuste del CEO · hallazgo de Calidad) · CANDADO de copy de la ficha.
 *
 * La autorización se ACEPTA EN PANTALLA (SPEC-703), ya NO se sube un documento firmado. El
 * encabezado de la ficha todavía decía «Cuando termine la ficha y suba su autorización firmada…»
 * — una promesa que el producto ya no cumple (el usuario no sube nada, acepta un texto). Este
 * ratchet lee la pantalla y falla si reaparece el verbo de SUBIR o el adjetivo «firmada» aplicados
 * a la autorización. Comentarios excluidos (mismo `sinComentarios` que el candado de voz, que quita
 * bloques, líneas y comentarios JSX), para no cazar la explicación del cambio.
 *
 * Muere con el defecto: revertir el encabezado a «suba su autorización firmada» vuelve rojo.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const RUTA_PAGE = path.resolve(__dirname, "page.tsx");

/** Igual que el candado de voz: quita comentarios de bloque, de línea y JSX antes de escanear. */
function sinComentarios(codigo: string): string {
    return codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// Borde Unicode (no `\b` ASCII, que no cierra contra acentos) — mismo criterio que el candado de voz.
const B = "(?<![\\p{L}])";
const E = "(?![\\p{L}])";
// Morfología, no una lista de una sola forma: la raíz de SUBIR (suba/subir/subida…) y FIRMAR
// (firmada/firmado…). No caza «confirmar» (la raíz va pegada a otra letra → falla el borde).
const PROHIBIDOS: Array<{ patron: RegExp; que: string }> = [
    { patron: new RegExp(B + "sub(a|as|an|ir|ida|idas|iera|ió)" + E, "iu"), que: "verbo «subir» (la autorización se ACEPTA, no se sube)" },
    { patron: new RegExp(B + "firmad[ao]s?" + E, "iu"), que: "«firmada/firmado» (no hay documento firmado que subir)" },
];

describe("SPEC-704 · la ficha no dice «suba» ni «firmada» de la autorización", () => {
    it("la pantalla existe (contraprueba del scanner)", () => {
        expect(fs.existsSync(RUTA_PAGE)).toBe(true);
    });

    it("ninguna forma de «subir» ni «firmada» aparece en la pantalla (comentarios excluidos)", () => {
        const codigo = sinComentarios(fs.readFileSync(RUTA_PAGE, "utf-8"));
        const hits: string[] = [];
        for (const { patron, que } of PROHIBIDOS) {
            const m = codigo.match(patron);
            if (m) hits.push(`${que}: «${m[0]}»`);
        }
        expect(
            hits,
            [
                "SPEC-704 — la ficha promete subir/firmar la autorización, pero se ACEPTA en pantalla:",
                ...hits,
                "",
                "Cambie la copia por «acepte la autorización». Si es un caso legítimo,",
                "agregue una excepción explícita al ratchet.",
            ].join("\n"),
        ).toEqual([]);
    });
});
