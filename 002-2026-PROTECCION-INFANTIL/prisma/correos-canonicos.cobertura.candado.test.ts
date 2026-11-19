/**
 * SPEC-923 · CANDADO de COBERTURA del barrido de correos (capa ESTÁTICA, unit).
 *
 * La escapada que lo motiva: `auth.crear_password.codigo.email` no estaba en ninguna FORMA ni en el registro,
 * y nadie lo veía. Ahora, toda clave está en el REGISTRO ÚNICO o en PENDIENTES (con familia/SPEC):
 *   - registro ∩ pendientes = ∅ (cuando una familia entra, sus claves SALEN de pendientes) y sin repetidas;
 *   - RATCHET: `TOPE_PENDIENTES` = largo de la lista (solo baja; subirlo es agregar deuda visible);
 *   - todo evento LITERAL que el código emite (`programar({ evento: "…" })`) tiene su plantilla cubierta.
 * La capa de BASE (lo que el seed crea DE VERDAD, incluidos los eventos por constante que este barrido de
 * fuente no ve) vive en `src/lib/notificaciones/cobertura-copys.integracion.test.ts`.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect } from "vitest";
import { CORREOS_CANONICOS } from "./correos-canonicos.seed-data";
import { COPYS_HUERFANOS, COPYS_PENDIENTES, TOPE_PENDIENTES, violacionesCobertura } from "./correos-canonicos.pendientes";

const RAIZ = path.resolve(__dirname, "..");
const REGISTRO = CORREOS_CANONICOS.map((c) => c.clave);
const PENDIENTES = COPYS_PENDIENTES.map((p) => p.clave);
const HUERFANAS = COPYS_HUERFANOS.map((h) => h.clave);

/** Archivos de producción de `src/` que llaman a `programar(`. */
function emisores(dir = path.join(RAIZ, "src")): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
        const p = path.join(dir, d.name);
        if (d.isDirectory()) return emisores(p);
        if (!/\.tsx?$/.test(d.name) || /\.test\.tsx?$/.test(d.name)) return [];
        return fs.readFileSync(p, "utf-8").includes("programar(") ? [p] : [];
    });
}

/** Eventos LITERALES (`evento: "…"`) en los archivos emisores. */
function eventosEmitidos(): string[] {
    const set = new Set<string>();
    for (const f of emisores()) {
        for (const m of fs.readFileSync(f, "utf-8").matchAll(/evento: "([a-z0-9_.]+)"/g)) set.add(m[1]!);
    }
    return [...set].sort();
}

describe("SPEC-923 · cobertura del barrido de correos (capa estática)", () => {
    it("control POSITIVO: cada clase de hueco se caza", () => {
        expect(violacionesCobertura({}, ["a.email"], ["a.email"])).toEqual([
            "«a.email» ya está en el registro: sacala de PENDIENTES (ratchet)",
        ]);
        expect(violacionesCobertura({}, ["a.email"], [], ["a.email"])).toEqual([
            "huérfana «a.email» también en registro/pendientes: es una u otra",
        ]);
        expect(violacionesCobertura({}, [], ["b.email", "b.email"])).toEqual(["PENDIENTES tiene claves repetidas"]);
        expect(violacionesCobertura({ vivas: ["x.email", "b.email"] }, [], ["b.email"])).toEqual([
            "plantilla viva sin cubrir: «x.email» (ni registro, ni PENDIENTES, ni HUERFANAS)",
        ]);
        expect(violacionesCobertura({ eventos: ["no.existe"] }, ["a.email"], [])).toEqual([
            "evento emitido sin plantilla cubierta: «no.existe»",
        ]);
        // Una huérfana cubre una fila viva (no es «sin cubrir») y un evento se cubre por .email o .in_app.
        expect(violacionesCobertura({ vivas: ["z.email"], eventos: ["a"] }, ["a.in_app"], [], ["z.email"])).toEqual([]);
    });

    it("registro ∩ pendientes ∩ huerfanas disjuntos y sin repetidas", () => {
        expect(violacionesCobertura({}, REGISTRO, PENDIENTES, HUERFANAS)).toEqual([]);
    });

    it("RATCHET: TOPE_PENDIENTES = largo de la lista (solo baja)", () => {
        expect(PENDIENTES.length, "si una familia entró al registro, bajá TOPE_PENDIENTES en el mismo PR").toBe(TOPE_PENDIENTES);
    });

    it("cada pendiente declara su familia; forma es null o SHA de 8 hex", () => {
        for (const p of COPYS_PENDIENTES) {
            expect(p.familia, p.clave).not.toBe("");
            expect(p.familia, `${p.clave}: sin clasificar`).not.toContain("SIN CLASIFICAR");
            if (p.forma !== null) expect(p.forma, p.clave).toMatch(/^[0-9a-f]{8}$/);
        }
    });

    it("todo evento LITERAL que el código emite tiene su plantilla cubierta", () => {
        const eventos = eventosEmitidos();
        expect(eventos.length, "el barrido de fuente tiene que encontrar eventos (si da 0, la sonda está rota)").toBeGreaterThan(20);
        expect(violacionesCobertura({ eventos }, REGISTRO, PENDIENTES, HUERFANAS)).toEqual([]);
    });
});
