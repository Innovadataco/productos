/**
 * CANDADO · SPEC-883 / I-407 · el resumen del poblador CUADRA con lo sembrado (franjas libres).
 *
 * El defecto (I-407): `poblar-red-apoyo.ts` inicializa `resumen.franjasLibres: 0` y el bucle de
 * profesionales solo hacía `resumen.profesionales++` — nunca sumaba las franjas que `sembrarProfesional`
 * crea (`for f < libres`). El resumen reportaba **0 franjas** sobre las reales: el operador que lee el
 * resumen para verificar la corrida veía un cero que mentía.
 *
 * El fix ata el conteo a lo realmente sembrado: `sembrarProfesional` DEVUELVE `franjasLibres: libres`
 * (la MISMA variable que gobierna el `for` que crea las franjas), y el bucle principal ACUMULA cada
 * conteo en `resumen.franjasLibres`. Así el total del resumen es, por construcción, la suma de las
 * franjas creadas.
 *
 * Fuente pura (sin BD), como el resto de candados del poblador (`red-apoyo-plan`): correr el poblador
 * completo (50 profesionales + citas + encuestas + …) es desproporcionado. Muere con el defecto por
 * MUTACIÓN: quitar el `franjasLibres: libres` del return, o el `resumen.franjasLibres += …` del bucle,
 * o desatar el conteo de la variable `libres`, reenciende el candado.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const fuente = readFileSync(path.join(__dirname, "poblar-red-apoyo.ts"), "utf8");
/** Fuente sin comentarios (para no cazar menciones en prosa). */
const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("SPEC-883 / I-407 · el resumen cuadra con lo sembrado (franjas libres)", () => {
    it("el resumen arranca franjasLibres en 0 (la base de la acumulación)", () => {
        expect(codigo, "el resumen inicializa franjasLibres: 0").toMatch(/resumen[\s\S]*?franjasLibres:\s*0/);
    });

    it("sembrarProfesional DEVUELVE el conteo real de franjas (la misma variable `libres` que crea el for)", () => {
        // El `for (… f < libres …)` que CREA las franjas y el `return { … franjasLibres: libres }` comparten
        // la variable `libres`: el conteo devuelto es exactamente lo sembrado, no un número fabricado.
        expect(codigo, "el for de franjas usa `libres`").toMatch(/for\s*\([^)]*<\s*libres\s*;/);
        expect(codigo, "sembrarProfesional devuelve franjasLibres: libres").toMatch(/return\s*\{[^}]*franjasLibres:\s*libres\b/);
    });

    it("el bucle principal ACUMULA el conteo de cada profesional en resumen.franjasLibres", () => {
        expect(
            codigo,
            "falta `resumen.franjasLibres += p.franjasLibres` en el bucle de profesionales",
        ).toMatch(/resumen\.franjasLibres\s*\+=\s*\w+\.franjasLibres/);
    });
});
