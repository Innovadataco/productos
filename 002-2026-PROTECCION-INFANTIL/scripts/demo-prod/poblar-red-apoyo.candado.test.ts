/**
 * CANDADO · SPEC-676 / I-405 · CONDUCTA DEL LLAMADOR: `poblar-red-apoyo.ts` NUNCA
 * invoca a `purgar-demo.ts`.
 *
 * El defecto (I-405): el poblador tenía una rama `--force` que imprimía «purgando
 * corrida previa red-apoyo-676» pero spawneaba `purgar-demo.ts` SIN argumentos —
 * y ese purgador no filtra por corrida: borra TODO lo demo de TODAS las corridas
 * (colegios, alumnos, reportes, alertas, cuentas). La frase prometía un alcance
 * chico; la conducta era global. Familia I-394: la conducta no está mal, la
 * AFIRMACIÓN sobre la conducta sí — y un mensaje así tumba justo al operador que
 * lee bien.
 *
 * El arreglo es IMPOSIBILIDAD ESTRUCTURAL: se quitó la rama `--force`. Este candado
 * impide que el camino peligroso vuelva por CUALQUIER ruta — y no vigila el MENSAJE
 * (un candado de texto sobre el log dejaría pasar la próxima llamada), sino la
 * CAPACIDAD de invocar:
 *   · no importa `child_process` → no puede spawnear el purgador (ni nada);
 *   · no importa/resuelve `purgar-demo` → no puede dispararlo al importarlo
 *     (ese script corre `main()` al ser importado);
 *   · no parsea `--force`.
 * Mencionar `purgar-demo.ts` en el throw (guía al operador) es texto, no invocación:
 * este candado apunta a `from/import/require/URL(...purgar-demo...)`, no a la palabra.
 *
 * Muere si alguien re-introduce el spawn/import del purgador. Fuente pura (sin BD).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const fuente = readFileSync(path.join(__dirname, "poblar-red-apoyo.ts"), "utf8");

describe("SPEC-676 / I-405 · el poblador no invoca al purgador (conducta del llamador)", () => {
    it("no importa child_process → no puede lanzar un proceso hijo (ni el purgador)", () => {
        expect(fuente, "poblar-red-apoyo.ts no debe importar child_process").not.toMatch(/child_process/);
    });

    it("no importa ni resuelve purgar-demo por ninguna vía (import/require/URL) — solo lo NOMBRA como guía", () => {
        // Matchea la INVOCACIÓN/RESOLUCIÓN del módulo, no la mención en el mensaje.
        expect(
            fuente,
            "no debe haber from/import()/require()/new URL(...) que apunte a purgar-demo",
        ).not.toMatch(/\b(?:from|require|import|URL)\s*\(?\s*["'`][^"'`]*purgar-demo/);
    });

    it("no parsea la bandera --force (el camino peligroso no es alcanzable)", () => {
        expect(fuente, "no debe volver a leer --force de argv").not.toMatch(/includes\(\s*["'`]--force/);
    });
});
