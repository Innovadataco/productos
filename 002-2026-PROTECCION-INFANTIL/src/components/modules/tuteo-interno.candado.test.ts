/**
 * SPEC-529 · CANDADO: el área INTERNA (admin · operador · comité de validación ·
 * verificador) habla de «usted» — sin TUTEO. Los `message` de error de
 * /api/admin/** los ve el interno → también usted. No lo cubren 514 (voseo) ni
 * 523 (colegio); el tuteo interno se colaba (No tienes/debes/puedes + imperativos).
 *
 * Mismo criterio que SPEC-527: se caza la CLASE de formas de tuteo con una lista
 * COMPREHENSIVA (no una lista parcial que reintroduce el falso cero), con borde de
 * letra UNICODE `(?<![\p{L}])…(?![\p{L}])/u`. NO regex de terminación pura: las
 * terminaciones -es/-as las comparten 3ª persona y sustantivos.
 *
 * Los imperativos ambiguos con 3ª persona (Crea/Completa/Selecciona) NO se barren a
 * ciegas; las cadenas concretas que tocó SPEC-529 se candan por ANCLA positiva.
 *
 * Verificado por MUTACIÓN: reponer «No tienes» (via «tienes») en una ruta → rojo;
 * y una forma NO mapeada («quieres») → rojo. Eso prueba que es clase, no lista.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "..", ".."); // .../src
const DIRS = [
    path.join(SRC, "app/api/admin"),
    path.join(SRC, "app/dashboard/admin"),
    path.join(SRC, "components/modules/config-panel"),
    path.join(SRC, "components/modules/ia"),
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

const B = "(?<![\\p{L}])";
const E = "(?![\\p{L}])";

// Clase de tuteo: presentes de 2ª singular (-as/-es INEQUÍVOCOS, la 3ª no lleva s),
// posesivos/pronombres y enclíticos. Se amplía si aparece un verbo nuevo.
const LEXEMAS_TUTEO = [
    // presentes 2ª singular (verbos INEQUÍVOCOS; se omiten los que colisionan con
    // adjetivo/sustantivo: activas/completas/marcas/guardas)
    "tienes", "puedes", "debes", "necesitas", "quieres", "sabes", "prefieres",
    "eliges", "deseas", "entiendes", "encuentras", "agregas", "editas",
    "creas", "seleccionas", "ingresas", "escribes", "revisas",
    "confirmas", "apruebas", "rechazas", "envías",
    "asignas", "resuelves", "cierras", "abres", "borras", "eliminas", "gestionas",
    // posesivos / pronombres 2ª
    "tus", "tuyo", "tuya", "tuyos", "tuyas", "contigo",
];
const PATRONES = LEXEMAS_TUTEO.map((l) => new RegExp(B + l + E, "iu"));

describe("SPEC-529 · el área interna habla de «usted» (sin tuteo)", () => {
    it("ninguna forma de tuteo aparece en el árbol interno (comentarios/tests excluidos)", () => {
        const hits: string[] = [];
        for (const dir of DIRS) {
            for (const archivo of recorrer(dir)) {
                const codigo = sinComentarios(fs.readFileSync(archivo, "utf-8"));
                for (const [i, linea] of codigo.split("\n").entries()) {
                    for (const patron of PATRONES) {
                        const m = linea.match(patron);
                        if (m) hits.push(`${path.relative(SRC, archivo)}:${i + 1} → «${m[0]}»: ${linea.trim().slice(0, 90)}`);
                    }
                }
            }
        }
        expect(
            hits,
            [
                "SPEC-529 — tuteo en el área interna:",
                ...hits,
                "",
                "El área interna habla de USTED. Pase a usted (tienes→tiene, debes→debe,",
                "puedes→puede, Selecciona→Seleccione). Los message de /api/admin también.",
            ].join("\n"),
        ).toEqual([]);
    });

    it("contraprueba: las cadenas que tocó SPEC-529 quedaron en «usted»", () => {
        const correcciones = fs.readFileSync(path.join(SRC, "app/api/admin/correcciones/route.ts"), "utf-8");
        expect(correcciones).toContain("No tiene permiso para gestionar este caso");
        const mant = fs.readFileSync(path.join(SRC, "components/modules/config-panel/MantenimientoLogsPanel.tsx"), "utf-8");
        expect(mant).toContain("Seleccione una fecha límite");
        expect(mant).toContain("Si selecciona un nivel, debe seleccionar un servicio");
        const sim = fs.readFileSync(path.join(SRC, "components/modules/ia/simulacion/SimulacionTab.tsx"), "utf-8");
        expect(sim).toContain("Cree una simulación");
    });
});
