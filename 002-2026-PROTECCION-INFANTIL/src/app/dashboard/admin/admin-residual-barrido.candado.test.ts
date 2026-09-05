/**
 * SPEC-483 (Lote-2 · Ola A · Diseño) · Candado del barrido residual del ADMIN.
 *
 * La Ola A migró el crudo NO-rojo mecánico del territorio admin al Sistema de
 * Diseño: `slate/gray` → neutros (`--linea` = tinta/10, `--velo` = tinta/5,
 * superficie = papel, texto por jerarquía), `sky/cyan` → cielo, `emerald` → pino.
 * El `amber` queda para la Ola B (criterio fino de Diseño: ámbar-ink texto /
 * acento admin / neutro decorativo), así que este candado NO lo vigila.
 *
 * Conducta: ninguna pantalla de `app/dashboard/admin/**` puede volver a traer
 * crudo de las cinco familias mecánicas. Verificado por mutación: reintroducir
 * un `bg-slate-50`, `text-emerald-600` o `border-sky-500` en cualquier pantalla
 * admin hace caer el candado.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const DIR_ADMIN = path.resolve(__dirname);
const SRC = path.resolve(__dirname, "../../..");

function* recorrer(dir: string): Generator<string> {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, e.name);
        if (e.isDirectory()) yield* recorrer(ruta);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) yield ruta;
    }
}

// Las cinco familias mecánicas de la Ola A, en cualquier utilidad de Tailwind
// (bg/text/border/ring/divide/from/to/via/fill/stroke/placeholder/shadow y sus
// prefijos hover:/dark:/etc.). `amber` queda fuera a propósito (Ola B).
const CRUDO_OLA_A = /-(slate|gray|sky|cyan|emerald)-[0-9]{2,3}(\/[0-9]{1,3})?\b/;

describe("SPEC-483 · barrido residual del admin (Ola A mecánica)", () => {
    it("ninguna pantalla de admin trae crudo slate/gray/sky/cyan/emerald", () => {
        const hits: string[] = [];
        for (const archivo of recorrer(DIR_ADMIN)) {
            const codigo = fs.readFileSync(archivo, "utf-8");
            for (const [i, linea] of codigo.split("\n").entries()) {
                const m = linea.match(CRUDO_OLA_A);
                if (m) {
                    const rel = path.relative(SRC, archivo);
                    hits.push(`${rel}:${i + 1} → «${m[0]}»: ${linea.trim().slice(0, 90)}`);
                }
            }
        }
        expect(hits, `crudo de Ola A reintroducido en admin:\n${hits.join("\n")}`).toEqual([]);
    });
});
