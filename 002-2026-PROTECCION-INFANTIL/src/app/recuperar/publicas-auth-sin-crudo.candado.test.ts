/**
 * SPEC-491 · las públicas de auth (recuperar contraseña + reportar) sin crudo.
 *
 * Hueco de «pantalla que no cae en ningún territorio»: recuperar/reportar quedaron
 * fuera de los barridos (colegio/admin/ia). Texto neutro sin semántica → tokens:
 * títulos `text-body`, secundario `.text-muted`. Patrón con direccionales.
 *
 * Muere por mutación: reintroducir `text-slate-600` en cualquiera → rojo.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const RAIZ = path.resolve(__dirname, "..", "..", "..");
const DIR_RECUPERAR = __dirname;
const REPORTAR = path.resolve(__dirname, "..", "reportar", "page.tsx");

function* recorrer(dir: string): Generator<string> {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, e.name);
        if (e.isDirectory()) yield* recorrer(ruta);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) yield ruta;
    }
}

// Con infijo direccional (lección SPEC-490).
const CRUDO = /\b(?:text|bg|border|ring|from|to|via|divide|fill|stroke)(?:-[ltrbxy])?-(?:slate|gray)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/;

describe("SPEC-491 · públicas de auth (recuperar + reportar) sin slate crudo", () => {
    it("0 crudo slate/gray en recuperar/** y reportar/page.tsx", () => {
        const archivos = [...recorrer(DIR_RECUPERAR), REPORTAR];
        const hits: string[] = [];
        for (const archivo of archivos) {
            for (const [i, linea] of fs.readFileSync(archivo, "utf-8").split("\n").entries()) {
                if (CRUDO.test(linea)) hits.push(`${path.relative(RAIZ, archivo)}:${i + 1}: ${linea.trim().slice(0, 80)}`);
            }
        }
        expect(hits, hits.join("\n")).toEqual([]);
    });
});
