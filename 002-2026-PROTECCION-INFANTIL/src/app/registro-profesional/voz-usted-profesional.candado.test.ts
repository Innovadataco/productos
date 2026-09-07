/**
 * SPEC-505 (radicado CEO · decisión de Jelkin) · Candado de voz: el territorio
 * del PROFESIONAL (psicólogo) habla de «usted», SIN voseo. §1.9 + veredicto de
 * Jelkin (05-09): el profesional es un proveedor adulto en relación institucional.
 *
 * Detector: lexemas de voseo EXACTOS con borde de letra Unicode
 * `(?<![\p{L}])…(?![\p{L}])` (mismo que SPEC-504) — dispara en «Elegí»/«Intentá»
 * y NO por subcadena («revisándolo») ni en el `\b` ASCII muerto ante vocal
 * acentuada. Es **voseo-only**: NO marca tuteo (tu/su, «Revisa», «Adjunta»); ese
 * barrido es aparte. Un tuteo residual del profesional no rompe este candado.
 *
 * Alcance (evita pisar §C interno/admin, que NO es de este radicado):
 *  - Directorios profesional-namespaced completos (robusto ante archivos nuevos):
 *    registro-profesional, perfil-profesional, dashboard/profesional,
 *    api/profesional, components/modules/profesional.
 *  - Archivos §B puntuales que viven en dirs COMPARTIDos (por eso NO se escanea el
 *    dir entero): `lib/profesional/perfil-schema.ts` (el dir tiene además
 *    `cita/cita.service.ts`, cuyo «Elegí» de reasignación es §C admin) y
 *    `verificacion/EstadoVerificacionProfesionalClient.tsx` (el dir tiene además
 *    `FichaVerificacionClient.tsx`, §C del verificador interno).
 *  - `cambiar-password/page.tsx`: mixta que Diseño resolvió a usted.
 *
 * Verificado por MUTACIÓN: reintroducir voseo en cualquier archivo del alcance →
 * rojo. Un candado que pasa con el defecto es peor que ninguno.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "..", ".."); // .../src

const DIRS_PROFESIONAL = [
    path.join(SRC, "app/registro-profesional"),
    path.join(SRC, "app/perfil-profesional"),
    path.join(SRC, "app/dashboard/profesional"),
    path.join(SRC, "app/api/profesional"),
    path.join(SRC, "components/modules/profesional"),
];
// Archivos §B en directorios COMPARTIDos (no se escanea el dir entero para no
// pisar §C), + la mixta resuelta a usted.
const ARCHIVOS_PROFESIONAL = [
    path.join(SRC, "lib/profesional/perfil-schema.ts"),
    path.join(SRC, "components/modules/verificacion/EstadoVerificacionProfesionalClient.tsx"),
    path.join(SRC, "app/cambiar-password/page.tsx"),
];

function* recorrer(dir: string): Generator<string> {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, e.name);
        if (e.isDirectory()) yield* recorrer(ruta);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) yield ruta;
    }
}

function archivosDelAlcance(): string[] {
    const out = new Set<string>();
    for (const d of DIRS_PROFESIONAL) for (const f of recorrer(d)) out.add(f);
    for (const f of ARCHIVOS_PROFESIONAL) if (fs.existsSync(f)) out.add(f);
    return [...out];
}

function sinComentarios(codigo: string): string {
    return codigo
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const B = "(?<![\\p{L}])";
const E = "(?![\\p{L}])";
function vos(lexema: string): RegExp {
    return new RegExp(B + lexema + E, "iu");
}

/**
 * Lexemas de voseo EXACTOS (presentes -ás/-és/-ís, imperativos y enclíticos con
 * vocal acentuada, subjuntivos voseo, y `sos`). Sin morfología: cada uno es
 * inequívoco. Si mañana entra uno nuevo, se agrega acá.
 */
const LEXEMAS_VOSEO = [
    // presentes
    "recordás", "querés", "necesitás", "podés", "tenés", "buscás", "elegís",
    "sabés", "vivís", "completás", "subís", "sentís", "ponés", "hacés", "decís",
    // imperativos
    "elegí", "contá", "contale", "contales", "escribí", "indicá", "adjuntá",
    "revisá", "intentá", "reintentá", "reenviá", "mirá", "volvé", "subí", "avisá",
    "completá", "cargá",
    // subjuntivos voseo
    "terminés", "subás", "elijás",
    // otros
    "debés", "sos",
];
const PATRONES = LEXEMAS_VOSEO.map(vos);

// Guarda anti-falso-verde: el alcance debe resolver los archivos §B conocidos.
const CLAVE = [
    "registro-profesional/crear-clave/[token]/page.tsx",
    "registro-profesional/page.tsx",
    "api/profesional/documentos/route.ts",
    "components/modules/profesional/DocumentosRequisitos.tsx",
    "components/modules/profesional/SolicitudAcciones.tsx",
    "lib/profesional/perfil-schema.ts",
    "verificacion/EstadoVerificacionProfesionalClient.tsx",
    "cambiar-password/page.tsx",
];

describe("SPEC-505 · el profesional habla de «usted» (sin voseo)", () => {
    const archivos = archivosDelAlcance();

    it("el alcance resolvió los archivos §B conocidos (anti-falso-verde)", () => {
        expect(archivos.length).toBeGreaterThan(8);
        for (const c of CLAVE) {
            expect(
                archivos.some((a) => a.replace(/\\/g, "/").endsWith(c)),
                `el alcance no incluyó ${c}`,
            ).toBe(true);
        }
    });

    it("ningún lexema de voseo aparece en el área del profesional (comentarios excluidos)", () => {
        const hits: string[] = [];
        for (const archivo of archivos) {
            const codigo = sinComentarios(fs.readFileSync(archivo, "utf-8"));
            for (const [i, linea] of codigo.split("\n").entries()) {
                for (const patron of PATRONES) {
                    const m = linea.match(patron);
                    if (m) {
                        hits.push(`${path.relative(SRC, archivo)}:${i + 1} → «${m[0]}»: ${linea.trim().slice(0, 90)}`);
                    }
                }
            }
        }
        expect(
            hits,
            [
                "SPEC-505 — voseo en una pantalla del profesional:",
                ...hits,
                "",
                "El profesional habla de USTED (decisión de Jelkin). Cambie el verbo",
                "a su forma en usted (elegí→elija, tenés→tiene, intentá→intente). Si es",
                "un identificador legítimo, agregue una excepción explícita.",
            ].join("\n"),
        ).toEqual([]);
    });
});
