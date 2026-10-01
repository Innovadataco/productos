/**
 * CANDADO ESTRUCTURAL · SPEC-790 (D-8) · el predicado del directorio es PROPIEDAD del
 * builder. La afirmación NO es «el gate está en el builder» sino:
 *
 *   TODA consulta de `PerfilProfesionalRepository` que devuelve datos PÚBLICOS del
 *   profesional construye su `where` con `whereDirectorioPublico` — nadie escribe el
 *   predicado de estado a mano.
 *
 * Morfología, no lista: el centinela es el LITERAL `"ACTIVO"` (el filtro de estado del
 * directorio). `whereDirectorioPublico` es su ÚNICO dueño; cualquier otro `"ACTIVO"` en
 * el código ejecutable del repo es un `where` hecho a mano que se SALTA lo que el builder
 * compone (estado ∧ vigencia ∧ exclusión de sembrados ∧ —desde 790— REPS al día). Así, el
 * día que se meta `repsAlDia` en el builder, un `facetas` (o cualquier lectura nueva) que
 * copie el predicado a mano NO lo heredaría y el gate se filtraría por ahí — como ya se
 * filtraba la vigencia hasta esta misma spec.
 *
 * Por qué un candado de FUENTE y no de conducta: la fuga es ESTRUCTURAL (un callsite que
 * no pasa por el builder), no un valor de datos; se caza en el árbol del repo, antes de
 * que ninguna fila exista. La vigencia EFECTIVA de las cuatro lecturas (incluida `facetas`)
 * la vigila, por conducta, `perfil-profesional-directorio-vigencia`.
 *
 * Control positivo POR MUTACIÓN: se re-inyecta en la fuente un `where: { estado: "ACTIVO" }`
 * a mano (la regresión exacta que 790 cerró en `facetas`) y se exige que el checker lo cace.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const RUTA_REPO = path.resolve(__dirname, "perfil-profesional.ts");
const FUENTE = fs.readFileSync(RUTA_REPO, "utf-8");

/** Quita comentarios de bloque y de línea para no contar los `ACTIVO` de la prosa. */
function sinComentarios(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** Acota el cuerpo de `whereDirectorioPublico` por balanceo de llaves desde su declaración. */
function spanDelBuilder(src: string): [number, number] {
    const decl = src.indexOf("private async whereDirectorioPublico");
    if (decl < 0) throw new Error("no se encontró la declaración de whereDirectorioPublico");
    const abre = src.indexOf("{", src.indexOf(")", decl));
    let prof = 0;
    for (let i = abre; i < src.length; i++) {
        if (src[i] === "{") prof++;
        else if (src[i] === "}") {
            prof--;
            if (prof === 0) return [abre, i];
        }
    }
    throw new Error("no se pudo acotar el cuerpo de whereDirectorioPublico");
}

/** Cuántos literales `"ACTIVO"` viven FUERA del builder (0 = sano). */
function activosFueraDelBuilder(src: string): number {
    const limpio = sinComentarios(src);
    const [ini, fin] = spanDelBuilder(limpio);
    let n = 0;
    const re = /"ACTIVO"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(limpio)) !== null) {
        if (m.index < ini || m.index > fin) n++;
    }
    return n;
}

describe("SPEC-790 (D-8) · el predicado del directorio ('ACTIVO') es propiedad de whereDirectorioPublico", () => {
    it("el builder EXISTE y contiene el único literal 'ACTIVO' legítimo", () => {
        const limpio = sinComentarios(FUENTE);
        const [ini, fin] = spanDelBuilder(limpio);
        expect(limpio.slice(ini, fin)).toContain('"ACTIVO"');
    });

    it("ninguna otra consulta escribe 'ACTIVO' a mano (facetas ya no lo copia)", () => {
        expect(
            activosFueraDelBuilder(FUENTE),
            "una lectura del directorio escribe `estado: \"ACTIVO\"` a mano en vez de pasar por whereDirectorioPublico → no heredaría vigencia/exclusión/REPS",
        ).toBe(0);
    });

    it("control positivo (mutación): re-inyectar un where con 'ACTIVO' a mano se CAZA", () => {
        const regresion = FUENTE.replace(
            "where: await this.whereDirectorioPublico(ahora, viewerUsuarioId),",
            'where: { estado: "ACTIVO", ...(await this.exclusionSembradosPara(viewerUsuarioId)) },',
        );
        expect(regresion, "la mutación debía aplicar sobre una lectura real del directorio").not.toBe(FUENTE);
        expect(
            activosFueraDelBuilder(regresion),
            "el candado debe cazar un `where` del directorio que compone 'ACTIVO' fuera del builder",
        ).toBeGreaterThan(0);
    });
});
