/**
 * CANDADO · SPEC-897 (regla dura de producto 091-US1/D) · la consulta pública NO acepta el
 * identificador por GET (URL).
 *
 * El identificador (teléfono/nick del presunto agresor — y la señal de a quién investiga un padre)
 * NUNCA debe viajar en la URL: quedaría en el historial del navegador, en los logs de proxy/CDN y en
 * la cabecera Referer (fuga por canal lateral). El cliente web ya usa POST con el identificador en el
 * CUERPO; el handler GET quedaba vivo como vector. SPEC-897 lo retira de `/api/consulta` y
 * `/api/consulta/detalle` → Next responde 405 a GET (método no exportado); solo queda POST.
 *
 * ESTRUCTURAL (fuente, sin importar el módulo → sin arrastrar prisma): afirma que ninguna de las dos
 * rutas exporta `GET` y que ambas exportan `POST`. Muere con el defecto por MUTACIÓN: reponer un
 * `export async function GET` en cualquiera de las dos → rojo.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const AQUI = __dirname; // src/app/api/consulta
const leer = (rel: string) => readFileSync(resolve(AQUI, rel), "utf8");
const exportaGET = (src: string) => /export\s+(?:async\s+)?function\s+GET\b/.test(src);
const exportaPOST = (src: string) => /export\s+(?:async\s+)?function\s+POST\b/.test(src);

const RUTAS: ReadonlyArray<readonly [string, string]> = [
    ["/api/consulta", "route.ts"],
    ["/api/consulta/detalle", "detalle/route.ts"],
];

describe("SPEC-897 · la consulta pública no acepta el identificador por GET (URL)", () => {
    for (const [nombre, archivo] of RUTAS) {
        it(`${nombre} NO exporta GET y SÍ exporta POST`, () => {
            const src = leer(archivo);
            expect(
                exportaGET(src),
                `${nombre}: el handler GET debe estar RETIRADO (el identificador no va en la URL → 405 de Next)`,
            ).toBe(false);
            expect(exportaPOST(src), `${nombre}: POST sigue siendo la vía (identificador en el cuerpo)`).toBe(true);
        });
    }
});
