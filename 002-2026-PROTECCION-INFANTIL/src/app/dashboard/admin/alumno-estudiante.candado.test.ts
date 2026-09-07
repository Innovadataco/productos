/**
 * SPEC-577 · CANDADO DE CLASE (hermano de SPEC-522): el área admin también dice
 * «estudiante», nunca «alumno» en TEXTO VISIBLE. Delta-audit 07-09: 3 frentes
 * residuales (DetalleRector, EstructuraColegioClient, humanizador de audit-log).
 *
 * Mismo patrón de SPEC-522: borde de letra UNICODE (`\b` ASCII muere en vocal
 * acentuada) y lookbehind que excluye «/» y «.» (rutas `/…/alumnos` y campos
 * del modelo `curso.alumnos`, que son código y se conservan). AÑADE dos
 * exclusiones del área admin: «_» antes (claves de enum técnicas como
 * `COLEGIO_ALUMNO_CREADO`) y «:» después (declaraciones de campo tipado como
 * `alumnos: number`, contrato del API).
 *
 * Verificado por MUTACIÓN: reponer un «alumno» de texto visible en el árbol
 * admin pone el candado en rojo con archivo:línea.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "../../.."); // .../src
const DIRS_ADMIN = [
    path.join(SRC, "app/dashboard/admin"),
    path.join(SRC, "components/modules/audit-log"),
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

// «alumno/a/os/as» de TEXTO: borde de letra Unicode + excluye «/», «.» y «_»
// antes (rutas, accesos a campo y claves de enum) y «:» después (campos
// tipados). Global para recorrer la línea.
const VETADA = /(?<![\p{L}./_])alumn[oa]s?(?![\p{L}:])/giu;

describe("SPEC-577 · el área admin dice «estudiante» (sin «alumno» en texto visible)", () => {
    it("ninguna cadena visible del árbol admin contiene «alumno»", () => {
        const hits: string[] = [];
        for (const dir of DIRS_ADMIN) {
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
                "SPEC-577 — «alumno» en texto visible del área admin:",
                ...hits,
                "",
                "El área admin dice «estudiante» (§3, extiende SPEC-522). Cambie",
                "alumno→estudiante, alumnos→estudiantes. NO toque rutas (/…/alumnos),",
                "campos del modelo (curso.alumnos), claves de enum (COLEGIO_ALUMNO_*)",
                "ni declaraciones tipadas (alumnos: number): son código.",
            ].join("\n"),
        ).toEqual([]);
    });

    it("contraprueba: las pantallas barridas ya dicen «estudiante»", () => {
        // Ancla positiva: si alguien borra el copy para pasar, esto cae.
        const detalleRector = fs.readFileSync(
            path.join(SRC, "app/dashboard/admin/usuarios/[id]/components/DetalleRector.tsx"),
            "utf-8",
        );
        expect(detalleRector.includes("Estudiantes")).toBe(true);
        const estructura = fs.readFileSync(
            path.join(SRC, "app/dashboard/admin/colegios/[id]/estructura/EstructuraColegioClient.tsx"),
            "utf-8",
        );
        expect(estructura.includes("Ver estudiantes")).toBe(true);
        const legible = fs.readFileSync(
            path.join(SRC, "components/modules/audit-log/legible.ts"),
            "utf-8",
        );
        expect(legible.includes("Carga masiva de estudiantes")).toBe(true);
    });
});
