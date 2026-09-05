/**
 * SPEC-482 (barrido residual del colegio, Lote-2 · Olas A+B): el territorio del
 * colegio no usa color crudo Tailwind — emerald→pino, slate/gray→neutros
 * (tinta / text-muted / text-subtle), amber→ambar (texto en `text-estado-ambar`,
 * el ambar-ink AA). Candado de fuente, sin BD.
 *
 * EXCLUYE `pdf-informe-mensual.tsx` (Diseño lo revisa aparte, orden del CEO).
 * Contraprueba (mutación): reintroducir un crudo emerald/slate/gray/amber en
 * cualquier archivo de colegio (fuera del pdf) → rojo.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const RAICES = [
    resolve(__dirname, "..", "..", "app/dashboard/colegio"),
    resolve(__dirname, "..", "..", "components/modules/colegio"),
];
const EXCLUYE = /pdf-informe-mensual|\.test\.tsx?$/;
const CRUDO =
    /\b(?:text|bg|border|ring|from|to|via|divide|fill|stroke|shadow)-(?:emerald|slate|gray|amber)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/g;

function* recorrer(dir: string): Generator<string> {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const ruta = join(dir, e.name);
        if (e.isDirectory()) yield* recorrer(ruta);
        else if (/\.tsx?$/.test(e.name)) yield ruta;
    }
}

describe("SPEC-482 · colegio sin color crudo (barrido residual)", () => {
    it("cero emerald/slate/gray/amber crudo en colegio (excl. pdf-informe-mensual)", () => {
        const ofensores: string[] = [];
        for (const raiz of RAICES) {
            for (const ruta of recorrer(raiz)) {
                if (EXCLUYE.test(ruta)) continue;
                const m = readFileSync(ruta, "utf-8").match(CRUDO);
                if (m) ofensores.push(`${ruta.split("/colegio/")[1] ?? ruta}: ${[...new Set(m)].join(", ")}`);
            }
        }
        expect(ofensores, `Color crudo en colegio:\n${ofensores.join("\n")}`).toEqual([]);
    });
});
