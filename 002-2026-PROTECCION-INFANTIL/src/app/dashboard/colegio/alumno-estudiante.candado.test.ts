/**
 * SPEC-522 · CANDADO DE CLASE: el colegio dice «estudiante», nunca «alumno» en
 * TEXTO VISIBLE. Palabra vetada (§3 del Sistema de Diseño); el enum ya es
 * ESTUDIANTE. Auditoría de forma 05-09: 4 pantallas marcadas ✗ pese a SPEC-463.
 *
 * Detecta el PATRÓN, no una lista de cadenas. Borde de letra UNICODE
 * `(?<![\p{L}])…(?![\p{L}])` (el `\b` ASCII muere en vocal acentuada — lección
 * SPEC-501/504) y ADEMÁS excluye del lookbehind «/» y «.» para NO cazar lo que
 * NO es texto: rutas (`/api/colegio/alumnos/…`, `/dashboard/colegio/alumnos/…`)
 * ni accesos a campo del modelo (`curso.alumnos`, `data.alumno`). Esos se
 * CONSERVAN por orden del radicado (es copy, no refactor: rutas, ids de código y
 * modelo de datos no se tocan).
 *
 * Verificado por MUTACIÓN: reponer un «alumno» de texto (p.ej. «Ir a Alumnos»)
 * en una pantalla del colegio pone el candado en rojo con archivo:línea.
 *
 * SIN excepciones: Diseño extendió el mapa y aprobó las 2 residuales que Dev 2
 * cazó (ColegioAuditoria «cursos, estudiantes…» y Alertas «registró para un
 * estudiante»); el candado ya cubre TODO el árbol del colegio.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "../../.."); // .../src
const DIRS_COLEGIO = [
    path.join(SRC, "app/dashboard/colegio"),
    path.join(SRC, "components/modules/colegio"),
];

function sinComentarios(codigo: string): string {
    return codigo
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function* recorrer(dir: string): Generator<string> {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, e.name);
        if (e.isDirectory()) yield* recorrer(ruta);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) yield ruta;
    }
}

// «alumno/a/os/as» de TEXTO: borde de letra Unicode + excluye «/» y «.» antes
// (rutas y accesos a campo, que se conservan). Global para recorrer la línea.
const VETADA = /(?<![\p{L}./])alumn[oa]s?(?![\p{L}])/giu;

describe("SPEC-522 · el colegio dice «estudiante» (sin «alumno» en texto visible)", () => {
    it("ninguna cadena visible del árbol del colegio contiene «alumno»", () => {
        const hits: string[] = [];
        for (const dir of DIRS_COLEGIO) {
            for (const archivo of recorrer(dir)) {
                const codigo = sinComentarios(fs.readFileSync(archivo, "utf-8"));
                for (const [i, linea] of codigo.split("\n").entries()) {
                    const m = linea.match(VETADA);
                    if (m) {
                        const rel = path.relative(SRC, archivo);
                        hits.push(`${rel}:${i + 1} → «${m[0]}»: ${linea.trim().slice(0, 90)}`);
                    }
                }
            }
        }
        expect(
            hits,
            [
                "SPEC-522 — «alumno» en texto visible del colegio:",
                ...hits,
                "",
                "El colegio dice «estudiante» (§3). Cambie alumno→estudiante,",
                "alumnos→estudiantes, «Alumno»→«Estudiante». NO toque rutas",
                "(/…/alumnos) ni campos del modelo (curso.alumnos): son código.",
            ].join("\n"),
        ).toEqual([]);
    });

    it("contraprueba: las pantallas barridas ya dicen «estudiante»", () => {
        // Ancla positiva: si alguien borra el copy para pasar, esto cae.
        const alumnoDetalle = fs.readFileSync(
            path.join(SRC, "app/dashboard/colegio/alumnos/[id]/AlumnoDetallePageClient.tsx"),
            "utf-8",
        );
        expect(alumnoDetalle.includes('label: "Estudiante"')).toBe(true);
        expect(alumnoDetalle.includes("No tiene acceso a este estudiante")).toBe(true);
        const cursos = fs.readFileSync(
            path.join(SRC, "app/dashboard/colegio/cursos/CursosPageClient.tsx"),
            "utf-8",
        );
        expect(cursos.includes("gestionar estudiantes")).toBe(true);
    });
});
