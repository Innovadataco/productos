/**
 * CANDADO ESTRUCTURAL · SPEC-816 · la MINIMIZACIÓN no se toca: `SolicitudCita` NO se vincula a `Hijo`.
 *
 * La cita NO sabe de qué menor es — es la minimización de SPEC-750 y es **[NORMA]** (Ley 1581): el operador
 * ve «fecha, hora, duración, profesional, identificador de la cita y el enlace. Nada más». SPEC-816 decidió
 * MOSTRAR el rango etario declarado (el padre, que sabe la edad de su hijo, elige) en vez de FILTRAR por la
 * edad del menor — PRECISAMENTE para no agregar esta vinculación de PII. El filtro por edad sería IMPOSIBLE
 * sin ligar la cita al hijo, y esa liga es justo lo que evitamos.
 *
 * Este candado afirma que la liga sigue SIN existir: un campo `hijoId` o una relación cuyo tipo es `Hijo`
 * dentro de `SolicitudCita` lo pone ROJO. Si alguien la propone, es una decisión de PRIVACIDAD (vuelve a la
 * mesa del CEO), no un cambio que entre de contrabando por el schema.
 *
 * Fuente, no conducta: la fuga sería ESTRUCTURAL (una columna/relación nueva en el modelo), se caza en el
 * `schema.prisma` antes de que exista fila alguna. Control positivo POR MUTACIÓN: se inyecta la relación a
 * `Hijo` en el bloque del modelo y se exige que el checker la cace.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const RUTA_SCHEMA = path.resolve(__dirname, "../../../../prisma/schema.prisma");
const SCHEMA = fs.readFileSync(RUTA_SCHEMA, "utf-8");

/** Extrae el cuerpo del `model <nombre> { … }` por balanceo de llaves desde su declaración. */
function bloqueDeModelo(src: string, nombre: string): string {
    const decl = src.indexOf(`model ${nombre} {`);
    if (decl < 0) throw new Error(`no se encontró el modelo ${nombre}`);
    const abre = src.indexOf("{", decl);
    let prof = 0;
    for (let i = abre; i < src.length; i++) {
        if (src[i] === "{") prof++;
        else if (src[i] === "}") {
            prof--;
            if (prof === 0) return src.slice(abre + 1, i);
        }
    }
    throw new Error(`no se pudo acotar el modelo ${nombre}`);
}

/** Quita comentarios de línea para no contar un `Hijo` de la prosa (p. ej. «NO se liga a Hijo»). */
function sinComentarios(bloque: string): string {
    return bloque.replace(/\/\/[^\n]*/g, "");
}

/** ¿El bloque del modelo liga a `Hijo`? Un campo de tipo `Hijo` (relación) o un FK `hijoId`. */
function ligaAHijo(bloqueModelo: string): boolean {
    const codigo = sinComentarios(bloqueModelo);
    // `\bHijo\b` caza el TIPO de una relación (`hijo Hijo @relation(...)`); `\bhijoId\b` caza el FK.
    // El límite de palabra evita falsos positivos de camelCase (p. ej. `padreHijo` no es `Hijo`).
    return /\bHijo\b/.test(codigo) || /\bhijoId\b/.test(codigo);
}

describe("SPEC-816 · minimización · SolicitudCita NO se vincula a Hijo (la cita no sabe de qué menor es)", () => {
    it("el modelo SolicitudCita EXISTE y hoy NO liga a Hijo", () => {
        const bloque = bloqueDeModelo(SCHEMA, "SolicitudCita");
        expect(bloque.length).toBeGreaterThan(0);
        expect(
            ligaAHijo(bloque),
            "SolicitudCita liga a Hijo → rompe la minimización de SPEC-750 ([NORMA], Ley 1581); si se necesita, es decisión de privacidad del CEO",
        ).toBe(false);
    });

    it("control positivo (mutación): inyectar una relación a Hijo en SolicitudCita se CAZA", () => {
        // Inyecta la liga que la spec PROHÍBE, justo antes del cierre del modelo.
        const inyectado = SCHEMA.replace(
            "model SolicitudCita {",
            "model SolicitudCita {\n  hijoId String?\n  hijo   Hijo?   @relation(fields: [hijoId], references: [id])",
        );
        expect(inyectado, "la mutación debía aplicar sobre el modelo real").not.toBe(SCHEMA);
        expect(
            ligaAHijo(bloqueDeModelo(inyectado, "SolicitudCita")),
            "el candado debe cazar una relación a Hijo inyectada en SolicitudCita",
        ).toBe(true);
    });

    it("control del discriminador: un `Hijo` SOLO en un comentario NO cuenta como liga (prosa ≠ campo)", () => {
        const soloComentario = SCHEMA.replace(
            "model SolicitudCita {",
            "model SolicitudCita {\n  // SPEC-816: NO se liga a Hijo (minimización, [NORMA]).",
        );
        expect(soloComentario).not.toBe(SCHEMA);
        expect(
            ligaAHijo(bloqueDeModelo(soloComentario, "SolicitudCita")),
            "un `Hijo` en la prosa no es una relación — no debe disparar el candado",
        ).toBe(false);
    });
});
