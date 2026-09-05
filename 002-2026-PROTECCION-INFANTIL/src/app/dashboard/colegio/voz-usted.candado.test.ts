/**
 * SPEC-463 (D-107 · Jelkin) · Candado de voz: el territorio del colegio habla
 * de «usted». El rector es institucional (§2 del Sistema de Diseño) — su copy
 * nunca tutea. La marca inequívoca del tuteo son los pronombres/posesivos de
 * segunda persona (tu, tus, tú, tuyo/a, contigo); los verbos ya se migraron a
 * usted en esta spec y el candado los cubre por añadidura si reaparecen con
 * posesivo.
 *
 * Dos direcciones:
 *  (1) NINGUNA pantalla del colegio (app + components) trae tuteo.
 *  (2) Contraprueba: el PADRE conserva su «tú» — el candado NO lo toca y el
 *      tuteo del padre sigue vivo (su voz es cálida, decisión de Jelkin).
 *
 * Verificado por mutación: reintroducir «tu colegio» en cualquier pantalla del
 * colegio hace caer (1); si alguien "corrige" el padre a usted, cae (2).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "../../..");
const DIRS_COLEGIO = [
    path.join(SRC, "app/dashboard/colegio"),
    path.join(SRC, "components/modules/colegio"),
];
const DIR_PADRE = path.join(SRC, "app/dashboard/padre");

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

// Pronombres y posesivos de segunda persona «tú». `\b` ASCII no rompe con «tú»
// (la í/ú acentuada); usamos alternativas explícitas con y sin acento.
const TUTEO = /\b(tu|tus|tú|tuyo|tuya|tuyos|tuyas|contigo)\b/i;

describe("SPEC-463 · el colegio habla de usted (sin tuteo)", () => {
    it("ninguna pantalla del colegio trae tu/tus/tú/tuyo/contigo", () => {
        const hits: string[] = [];
        for (const dir of DIRS_COLEGIO) {
            for (const archivo of recorrer(dir)) {
                const codigo = sinComentarios(fs.readFileSync(archivo, "utf-8"));
                for (const [i, linea] of codigo.split("\n").entries()) {
                    const m = linea.match(TUTEO);
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
                "SPEC-463 (D-107) — tuteo en una pantalla del colegio:",
                ...hits,
                "",
                "El rector habla de USTED. Cambie tu→su, tus→sus, y el verbo a su",
                "forma en usted. Si es un identificador legítimo (no debería), agregue",
                "una excepción explícita.",
            ].join("\n"),
        ).toEqual([]);
    });

    it("contraprueba: el PADRE conserva su «tú» (no se le toca la voz)", () => {
        let tuteoDelPadre = 0;
        for (const archivo of recorrer(DIR_PADRE)) {
            const codigo = sinComentarios(fs.readFileSync(archivo, "utf-8"));
            if (TUTEO.test(codigo)) tuteoDelPadre++;
        }
        // El área del padre DEBE seguir tuteando en al menos una pantalla; si
        // este número cae a 0, alguien migró al padre a usted por error.
        expect(tuteoDelPadre).toBeGreaterThan(0);
    });
});
