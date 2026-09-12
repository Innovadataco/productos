/**
 * SPEC-683 (I-401) · CANDADO — el aviso del hijo no puede estar PEOR SERVIDO que el del círculo.
 *
 * El hueco (medido en `prisma/seed.ts`): `padre.hijo.reporte` —«reportaron la
 * cuenta de tu hijo», el aviso más grave del producto— salía solo por EMAIL
 * (`:1208`), mientras el hermano del círculo `padre.circulo_confianza.reporte_
 * enriquecido` tiene EMAIL **y** IN_APP (la campanita, `:1237`). El más
 * importante era el único sin el canal más visible.
 *
 * Este candado NO vigila un canal puntual: vigila la RELACIÓN — que el aviso del
 * hijo tenga al menos los mismos canales que su equivalente del círculo. Si
 * mañana el círculo gana un canal que el hijo no tiene, cae; si alguien quita la
 * regla IN_APP del hijo, cae. Muere por mutación: sin la regla IN_APP de
 * `padre.hijo.reporte`, `faltantes` incluye IN_APP → rojo.
 *
 * Unit puro: escanea el texto del seed (las reglas son literales ahí). Sin base.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SEED = readFileSync(resolve(__dirname, "../../../prisma/seed.ts"), "utf-8");

/** El objeto `{...}` balanceado a partir de un índice (primer `{` en adelante). */
function bloqueLlaves(src: string, desde: number): string {
    const ini = src.indexOf("{", desde);
    if (ini === -1) return "";
    let depth = 0;
    for (let j = ini; j < src.length; j++) {
        if (src[j] === "{") depth++;
        else if (src[j] === "}" && --depth === 0) return src.slice(ini, j + 1);
    }
    return src.slice(ini);
}

/**
 * Canales declarados para un evento de notificación en el seed. Dos mecanismos:
 *  (1) EMAIL — el array `reglas` se upsertea TODO con `canal: "EMAIL"` en su loop
 *      (`for (const r of reglas)`); sus entradas son `{ evento:"E", plantillaClave:… }`.
 *  (2) otros canales — llamadas SUELTAS `upsertNotificacionRegla({ evento:"E", … canal:"X" })`.
 */
function canalesDe(evento: string): Set<string> {
    const canales = new Set<string>();
    const ev = evento.replace(/[.]/g, "\\.");
    if (new RegExp(`evento:\\s*"${ev}",\\s*plantillaClave:`).test(SEED)) canales.add("EMAIL");
    let k = 0;
    const NEEDLE = "upsertNotificacionRegla(";
    while ((k = SEED.indexOf(NEEDLE, k)) !== -1) {
        const bloque = bloqueLlaves(SEED, k);
        if (bloque.includes(`evento: "${evento}"`)) {
            const m = bloque.match(/canal:\s*"([^"]+)"/);
            if (m) canales.add(m[1]);
        }
        k += NEEDLE.length;
    }
    return canales;
}

/** La entrada del array `reglas` (canal EMAIL vía el loop) de un evento, o "". */
function entradaReglas(evento: string): string {
    const ev = evento.replace(/[.]/g, "\\.");
    const m = SEED.match(new RegExp(`\\{[^{}]*evento:\\s*"${ev}",\\s*plantillaClave:[^{}]*\\}`));
    return m ? m[0] : "";
}

/** El bloque de la llamada suelta `upsertNotificacionRegla` con ese evento+canal, o "". */
function bloqueReglaSuelta(evento: string, canal: string): string {
    let k = 0;
    const NEEDLE = "upsertNotificacionRegla(";
    while ((k = SEED.indexOf(NEEDLE, k)) !== -1) {
        const b = bloqueLlaves(SEED, k);
        if (b.includes(`evento: "${evento}"`) && b.includes(`canal: "${canal}"`)) return b;
        k += NEEDLE.length;
    }
    return "";
}

describe("I-401 · el aviso del hijo no es el peor servido", () => {
    const HIJO = "padre.hijo.reporte";
    const CIRCULO = "padre.circulo_confianza.reporte_enriquecido";

    it(`${HIJO} no tiene MENOS canales que ${CIRCULO}`, () => {
        const hijo = canalesDe(HIJO);
        const circulo = canalesDe(CIRCULO);
        const faltantes = [...circulo].filter((c) => !hijo.has(c));
        expect(
            faltantes,
            `El aviso del hijo (${[...hijo].join("+") || "ninguno"}) tiene MENOS canales que el círculo (${[...circulo].join("+")}): le falta ${faltantes.join(", ")}. I-401: el aviso más importante no puede ser el peor servido.`,
        ).toEqual([]);
    });

    it(`${HIJO} tiene la campanita (IN_APP), no solo el correo`, () => {
        expect(
            canalesDe(HIJO).has("IN_APP"),
            "falta la regla IN_APP de padre.hijo.reporte — el aviso del hijo se queda sin campanita.",
        ).toBe(true);
    });

    // I-401 (decisión de Jelkin): el aviso del hijo va OBLIGATORIO — no se puede
    // silenciar. Debe serlo en AMBOS canales: si uno queda apagable, el aviso más
    // importante del producto sigue silenciable por ese lado (media obligatoriedad
    // no es obligatoriedad). Muere por mutación: poner cualquiera de los dos en
    // `obligatoria: false` → rojo.
    it(`${HIJO} es OBLIGATORIO en sus DOS canales (no apagable por ningún lado)`, () => {
        const email = entradaReglas(HIJO);
        expect(email, "no encontré la regla EMAIL de padre.hijo.reporte").not.toBe("");
        expect(
            /obligatoria:\s*true/.test(email),
            "la regla EMAIL del aviso del hijo NO es obligatoria — se puede apagar por correo.",
        ).toBe(true);
        const inapp = bloqueReglaSuelta(HIJO, "IN_APP");
        expect(inapp, "no encontré la regla IN_APP de padre.hijo.reporte").not.toBe("");
        expect(
            /obligatoria:\s*true/.test(inapp),
            "la regla IN_APP del aviso del hijo NO es obligatoria — se puede apagar la campanita.",
        ).toBe(true);
    });
});
