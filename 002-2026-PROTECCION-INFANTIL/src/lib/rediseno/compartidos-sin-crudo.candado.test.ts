/**
 * SPEC-577 · barrido residual de FORMA (delta-audit 07-09): los módulos
 * compartidos y las páginas legales no usan familias de ESTADO crudas
 * (red/amber/green/emerald/rose/orange/yellow de Tailwind en utilidades de
 * color text-, bg-, border-…). El estado del sistema sale de tokens (pino =
 * cierre/éxito, ámbar = atención, rubí = criticidad, §4.2).
 *
 * PERMITE slate/sky/zinc/neutral: el papel/tinta/cielo del sistema son los
 * neutros canónicos, pero el chrome slate/sky residual es deuda menor que se
 * tokeniza en otra spec — este candado solo cierra el color de ESTADO.
 *
 * EXCLUYE los subárboles con candado propio (misma dirección, otro dueño):
 * admin (SPEC-464/483/536), colegio (SPEC-482), comité/config/expediente
 * (SPEC-530/534), ia/monitoreo (SPEC-483b), padre (SPEC-511/535) y archivos
 * de test (los candados hermanos cargan sus regex con estas familias).
 * Contraprueba (mutación): reintroducir un `text-green-600` en un módulo
 * compartido → rojo con archivo:línea.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const SRC = resolve(__dirname, "..", ".."); // .../src
const MODULES = join(SRC, "components", "modules");
const EXCLUYE_DIR = /\/(admin|colegio|comite|config-panel|ia|monitoreo|padre)\//;
const EXCLUYE_ARCHIVO = /\.test\.tsx?$/;
// Páginas legales + renderizador docs (DocsCapaPage entra por el walk de modules).
const EXTRAS = [
    join(SRC, "app", "terminos", "page.tsx"),
    join(SRC, "app", "privacidad", "page.tsx"),
    join(SRC, "lib", "docs", "markdown.tsx"),
];

const CRUDO =
    /\b(?:text|bg|border|ring|from|to|via|divide|fill|stroke|shadow|outline|placeholder|caret|accent|decoration)(?:-[ltrbxy])?-(?:red|amber|green|emerald|rose|orange|yellow)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/g;

function* tsx(dir: string): Generator<string> {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) yield* tsx(p);
        else if (/\.tsx?$/.test(e.name)) yield p;
    }
}

describe("SPEC-577 · compartidos y legales sin color crudo de estado", () => {
    it("cero red/amber/green/emerald/rose/orange/yellow en módulos compartidos y legales", () => {
        const ofensores: string[] = [];
        const limpiar = (codigo: string) =>
            codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
        for (const f of tsx(MODULES)) {
            if (EXCLUYE_DIR.test(f) || EXCLUYE_ARCHIVO.test(f)) continue;
            const m = limpiar(readFileSync(f, "utf-8")).match(CRUDO);
            if (m) ofensores.push(`${f.split("/components/")[1]}: ${[...new Set(m)].join(", ")}`);
        }
        for (const f of EXTRAS) {
            const m = limpiar(readFileSync(f, "utf-8")).match(CRUDO);
            if (m) ofensores.push(`${f.split("/src/")[1]}: ${[...new Set(m)].join(", ")}`);
        }
        expect(
            ofensores,
            [
                "Color de estado crudo en módulos compartidos/legales — el estado",
                "va por tokens (pino=cierre, ambar=atención, rubi=criticidad, §4.2):",
                ...ofensores,
            ].join("\n"),
        ).toEqual([]);
    });
});
