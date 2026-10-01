/**
 * CANDADO ESTRUCTURAL · SPEC-790 (D-8, reescrito) · el predicado de estado del DIRECTORIO es PROPIEDAD del
 * builder — pero el candado gobierna las lecturas del DIRECTORIO, no cualquier uso de `"ACTIVO"` del archivo.
 *
 * La afirmación:
 *   El literal `"ACTIVO"` (el filtro de estado del directorio) es dueño de `whereDirectorioPublico`. Toda OTRA
 *   escritura a mano de `"ACTIVO"` en el repo DEBE declarar, EN EL SITIO, que NO es una lectura del directorio
 *   (marcador `ACTIVO-NO-DIRECTORIO` + la razón). El candado exige que TODA ocurrencia a mano lleve ese
 *   marcador; una nueva SIN marcador sale ROJA. Nadie puede copiar el predicado en silencio.
 *
 * Por qué el marcador y NO un allowlist de funciones: una lista de excepciones envejece con la primera que
 * nadie anticipó (el patrón que ya nos mordió). El marcador OBLIGA A DECLARAR en cada sitio —distinto de
 * PERMITIR por nombre—: es universal (aplica a CUALQUIER ocurrencia, conocida o futura) y local (la razón
 * vive junto al código que la necesita). Una declaración FALSA (marcar como «no-directorio» una lectura que
 * SÍ es del directorio) es una mentira visible en revisión; el control por mutación de abajo caza la copia
 * SILENCIOSA (sin marcador), que es la regresión estructural de I-432 (facetas copiaba el predicado a mano).
 *
 * Por qué un candado de FUENTE y no de conducta: la fuga es ESTRUCTURAL (un callsite que no pasa por el
 * builder), no un valor de datos; se caza en el árbol del repo, antes de que ninguna fila exista. La vigencia
 * EFECTIVA de las lecturas del directorio la vigila, por conducta, `perfil-profesional-directorio-vigencia`.
 *
 * Invariantes HEREDADAS del candado viejo (no se pierden al reescribir):
 *  · `whereDirectorioPublico` es el único dueño del `"ACTIVO"` del directorio (test 1).
 *  · `facetas` (y toda lectura del directorio) ya no copia el predicado a mano, I-432 — una copia SILENCIOSA
 *    se caza (test 3, control positivo por mutación sobre una lectura REAL del directorio).
 *  · Control positivo POR MUTACIÓN con aserción de que la mutación aplicó sobre una lectura real (test 3).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const RUTA_REPO = path.resolve(__dirname, "perfil-profesional.ts");
const FUENTE = fs.readFileSync(RUTA_REPO, "utf-8");

/** El marcador que declara, EN EL SITIO, que un `"ACTIVO"` a mano NO es una lectura del directorio. */
const MARCADOR = "ACTIVO-NO-DIRECTORIO";

/**
 * Enmascara comentarios con espacios del MISMO largo (preserva offsets y saltos de línea). Así los `"ACTIVO"`
 * de la prosa desaparecen del análisis de código, pero las posiciones y los números de línea se mantienen —
 * necesario para mapear cada ocurrencia de código a su línea original y buscar el marcador (un comentario).
 */
function enmascararComentarios(src: string): string {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
        .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

/** Acota el cuerpo de `whereDirectorioPublico` por balanceo de llaves (sobre la fuente enmascarada). */
function spanDelBuilder(codigo: string): [number, number] {
    const decl = codigo.indexOf("private async whereDirectorioPublico");
    if (decl < 0) throw new Error("no se encontró la declaración de whereDirectorioPublico");
    const abre = codigo.indexOf("{", codigo.indexOf(")", decl));
    let prof = 0;
    for (let i = abre; i < codigo.length; i++) {
        if (codigo[i] === "{") prof++;
        else if (codigo[i] === "}") {
            prof--;
            if (prof === 0) return [abre, i];
        }
    }
    throw new Error("no se pudo acotar el cuerpo de whereDirectorioPublico");
}

/** ¿La ocurrencia (línea 1-based) lleva el marcador? En su propio renglón (comentario de cola) o en el
 *  bloque de comentarios contiguo inmediatamente ARRIBA (tolera una razón de varias líneas). */
function tieneMarcador(lineasSrc: string[], linea: number): boolean {
    if ((lineasSrc[linea - 1] ?? "").includes(MARCADOR)) return true;
    for (let i = linea - 2; i >= 0; i--) {
        const l = (lineasSrc[i] ?? "").trim();
        const esComentario = l.startsWith("//") || l.startsWith("*") || l.startsWith("/*") || l.endsWith("*/");
        if (!esComentario) break; // se cortó el bloque de comentarios contiguo
        if (l.includes(MARCADOR)) return true;
    }
    return false;
}

/** Cada `"ACTIVO"` de CÓDIGO fuera del builder, con su línea y si está marcado. */
function ocurrenciasFueraDelBuilder(src: string): Array<{ linea: number; conMarcador: boolean }> {
    const codigo = enmascararComentarios(src);
    const [ini, fin] = spanDelBuilder(codigo);
    const lineasSrc = src.split("\n");
    const out: Array<{ linea: number; conMarcador: boolean }> = [];
    const re = /"ACTIVO"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(codigo)) !== null) {
        if (m.index >= ini && m.index <= fin) continue; // dentro del builder: el dueño legítimo
        const linea = codigo.slice(0, m.index).split("\n").length; // 1-based
        out.push({ linea, conMarcador: tieneMarcador(lineasSrc, linea) });
    }
    return out;
}

const INYECTAR_EN = "where: await this.whereDirectorioPublico(ahora, viewerUsuarioId),";
const REGRESION_SIN_MARCADOR = 'where: { estado: "ACTIVO", ...(await this.exclusionSembradosPara(viewerUsuarioId)) },';
const REGRESION_CON_MARCADOR = `${REGRESION_SIN_MARCADOR} // ${MARCADOR}: inyección de prueba`;

describe("SPEC-790 (D-8) · el predicado del directorio ('ACTIVO') es propiedad de whereDirectorioPublico", () => {
    it("el builder EXISTE y contiene el único literal 'ACTIVO' del directorio", () => {
        const codigo = enmascararComentarios(FUENTE);
        const [ini, fin] = spanDelBuilder(codigo);
        expect(codigo.slice(ini, fin)).toContain('"ACTIVO"');
    });

    it("TODA escritura a mano de 'ACTIVO' fuera del builder lleva el marcador ACTIVO-NO-DIRECTORIO (ninguna silenciosa)", () => {
        const sinMarcar = ocurrenciasFueraDelBuilder(FUENTE).filter((o) => !o.conMarcador);
        expect(
            sinMarcar.map((o) => o.linea),
            `un 'ACTIVO' a mano fuera de whereDirectorioPublico SIN el marcador ${MARCADOR}: o pasa por el builder (hereda vigencia/exclusión/REPS), o declara en el sitio por qué NO es una lectura del directorio`,
        ).toEqual([]);
    });

    it("control positivo (mutación): una lectura del directorio que copia 'ACTIVO' a mano SIN marcador se CAZA (I-432)", () => {
        const regresion = FUENTE.replace(INYECTAR_EN, REGRESION_SIN_MARCADOR);
        expect(regresion, "la mutación debía aplicar sobre una lectura REAL del directorio").not.toBe(FUENTE);
        const sinMarcar = ocurrenciasFueraDelBuilder(regresion).filter((o) => !o.conMarcador);
        expect(
            sinMarcar.length,
            "una copia SILENCIOSA del predicado en una lectura del directorio debe salir roja (sin marcador)",
        ).toBeGreaterThan(0);
    });

    it("control del discriminador: la MISMA copia PERO con el marcador NO se marca como silenciosa (declarar ≠ copiar en silencio)", () => {
        const conMarcador = FUENTE.replace(INYECTAR_EN, REGRESION_CON_MARCADOR);
        expect(conMarcador, "la mutación debía aplicar").not.toBe(FUENTE);
        // Lo que levanta la bandera es la AUSENCIA del marcador, no la mera presencia de 'ACTIVO': con el
        // marcador puesto, no quedan ocurrencias silenciosas nuevas. (Una declaración falsa es otra cosa: la
        // caza la revisión, no el checker — el marcador obliga a DECLARAR, que es el punto.)
        const sinMarcar = ocurrenciasFueraDelBuilder(conMarcador).filter((o) => !o.conMarcador);
        expect(sinMarcar).toEqual([]);
    });
});
