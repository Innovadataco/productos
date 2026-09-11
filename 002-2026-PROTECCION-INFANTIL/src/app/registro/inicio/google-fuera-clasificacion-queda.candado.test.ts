/**
 * SPEC-647 (D-136) · CANDADO DE CONDUCTA — Google FUERA del producto, pero la pantalla de
 * CLASIFICACIÓN se queda.
 *
 * Jelkin sacó Google («fuera del todo», no oculto). Este candado fija las tres cosas del radicado:
 *  1. NINGUNA puerta ofrece Google — se barre el árbol de render de cada puerta (no la carpeta): el
 *     componente del botón NO existe y ninguna puerta lo renderiza ni ofrece «… con Google».
 *  2. NO existe ruta de OAuth alcanzable — en App Router una ruta existe sólo si existe su carpeta;
 *     se afirma que `src/app/api/auth/oauth` no está.
 *  3. La pantalla de clasificación SIGUE existiendo y SIGUE siendo el paso previo al alta —
 *     `/registro/inicio` con «¿Quién eres?» y sus TRES caminos (familia/colegio/profesional). Esto NO
 *     era de Google (Jelkin lo pidió aparte); si alguien se lo lleva al arrancar el botón, rojo.
 *
 * Sin BD: fs + lectura de fuente. Verificado por MUTACIÓN: reponer un botón de Google en una puerta,
 * o recrear la carpeta de OAuth, o quitar un camino de /registro/inicio → rojo.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "../../.."); // src/app/registro/inicio → src
const leer = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");
/** Fuente sin comentarios (para no cazar menciones históricas a «Google» en prosa). */
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const PUERTAS = [
    "app/login/page.tsx",
    "app/registro/page.tsx",
    "app/registro-colegio/page.tsx",
    "app/registro-profesional/page.tsx",
    "components/modules/RecuperarForm.tsx",
];

describe("SPEC-647 · Google fuera; la clasificación se queda", () => {
    it("NINGUNA puerta ofrece Google (ni el componente del botón ni un «… con Google» renderizado)", () => {
        // El componente del botón no existe → no hay forma de montarlo en ningún árbol de render.
        expect(
            fs.existsSync(path.join(SRC, "components/modules/BotonContinuaConGoogle.tsx")),
            "BotonContinuaConGoogle.tsx no debe existir",
        ).toBe(false);

        for (const puerta of PUERTAS) {
            const src = sinComentarios(leer(puerta));
            expect(src, `${puerta} no puede montar el botón de Google`).not.toMatch(/BotonContinuaConGoogle/);
            expect(src, `${puerta} no puede ofrecer «… con Google»`).not.toMatch(/con Google/i);
        }
    });

    it("NO existe ruta de OAuth alcanzable (la carpeta de rutas no está)", () => {
        expect(
            fs.existsSync(path.join(SRC, "app/api/auth/oauth")),
            "no debe existir ninguna ruta bajo /api/auth/oauth",
        ).toBe(false);
    });

    it("la CLASIFICACIÓN se queda: /registro/inicio con «¿Quién eres?» y los TRES caminos", () => {
        const inicio = leer("app/registro/inicio/page.tsx");
        expect(inicio, "el encabezado de clasificación se conserva").toContain("¿Quién eres?");
        // El paso previo al alta ofrece las tres puertas (familia/colegio/profesional).
        expect(inicio).toMatch(/href="\/registro"/);
        expect(inicio).toMatch(/href="\/registro-colegio"/);
        expect(inicio).toMatch(/href="\/registro-profesional"/);
        // Y sigue siendo una pantalla pública previa (no exige sesión): no llama a verifyAuth.
        expect(inicio, "la clasificación es el paso PREVIO, no una pantalla autenticada").not.toMatch(/verifyAuth/);
    });
});
