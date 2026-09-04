/**
 * SPEC-420 · el borrado por lotes. Lógica pura + candado estático, sin BD.
 *
 * De dónde sale: el borrado de lo sembrado **falló en producción** con
 *
 * ```
 * too many bind variables in prepared statement,
 * expected maximum of 32767, received 37176
 * ```
 *
 * `where: { id: { in: [...] } }` gasta un parámetro por id, y PostgreSQL admite
 * 32.767 por sentencia. La corrida de ensayo había escrito **30.254** marcas y
 * pasó; producción tenía **37.176**.
 *
 * > **La lección: un volumen de prueba menor que producción no prueba el
 * > límite.** No estaba mal probado — estaba probado a otra escala, y esa
 * > escala caía justo por debajo del techo.
 *
 * Lo que sí funcionó y conviene no perder de vista: el guion es transaccional y
 * falla en cerrado, así que **no se borró nada** y la base quedó idéntica.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { enLotes, borrarEnLotes, contarEnLotes, LOTE_IDS } from "./_marcado";

const AQUI = __dirname;
const leerCodigo = (archivo: string) =>
    fs
        .readFileSync(path.join(AQUI, archivo), "utf-8")
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n");

/** El techo real de PostgreSQL. No es una preferencia nuestra. */
const LIMITE_POSTGRES = 32767;

describe("SPEC-420 · el tamaño de lote respeta el techo de PostgreSQL", () => {
    it("2.000 deja margen de sobra bajo los 32.767 parámetros", () => {
        expect(LOTE_IDS).toBeLessThan(LIMITE_POSTGRES);
        // Margen amplio a propósito: la consulta puede llevar OTROS parámetros
        // además de los ids (fechas, estados), y no queremos afinar al borde.
        expect(LOTE_IDS).toBeLessThanOrEqual(LIMITE_POSTGRES / 10);
    });

    it("el volumen que reventó producción se parte en tandas seguras", () => {
        const REVENTO_CON = 37176;
        expect(REVENTO_CON).toBeGreaterThan(LIMITE_POSTGRES);
        const tandas = Math.ceil(REVENTO_CON / LOTE_IDS);
        expect(tandas).toBe(19);
        expect(LOTE_IDS).toBeLessThan(LIMITE_POSTGRES);
    });

    it("el ensayo (30.254) NO habría disparado el defecto — por eso pasó", () => {
        // Se deja escrito el número para que nadie repita el razonamiento.
        expect(30254).toBeLessThan(LIMITE_POSTGRES);
        expect(37176).toBeGreaterThan(LIMITE_POSTGRES);
    });
});

describe("SPEC-420 · enLotes parte y no pierde nada", () => {
    it("respeta el tamaño de tanda y cubre todos los ids", async () => {
        const ids = Array.from({ length: 4501 }, (_, i) => `id-${i}`);
        const tandas: string[][] = [];
        await enLotes(ids, async (t) => { tandas.push(t); return t.length; }, 2000);

        expect(tandas.map((t) => t.length)).toEqual([2000, 2000, 501]);
        expect(tandas.flat()).toEqual(ids);
    });

    it("lista vacía → cero viajes a la base", async () => {
        let viajes = 0;
        await enLotes([], async () => { viajes++; return 0; }, 2000);
        expect(viajes).toBe(0);
        expect(await borrarEnLotes([], async () => ({ count: 1 }))).toBe(0);
        expect(await contarEnLotes([], async () => 1)).toBe(0);
    });

    it("borrarEnLotes suma los `count` de cada tanda", async () => {
        const ids = Array.from({ length: 5000 }, (_, i) => `id-${i}`);
        const total = await borrarEnLotes(ids, async (t) => ({ count: t.length }));
        expect(total, "el total borrado es el de la lista entera, no el del último lote").toBe(5000);
    });

    it("contarEnLotes suma los conteos de cada tanda", async () => {
        const ids = Array.from({ length: 5000 }, (_, i) => `id-${i}`);
        expect(await contarEnLotes(ids, async (t) => t.length)).toBe(5000);
    });

    it("las tandas van en ORDEN — el borrado FK-safe depende de eso", async () => {
        const vistos: string[] = [];
        await enLotes(["a", "b", "c", "d"], async (t) => { vistos.push(t.join("")); return 0; }, 2);
        expect(vistos).toEqual(["ab", "cd"]);
    });
});

describe("SPEC-420 · candado: ninguna consulta del borrado queda sin lotear", () => {
    const borrado = leerCodigo("_borrado-marcado.ts");

    it("no queda un solo `in:` sobre una lista de ids de tamaño no acotado", () => {
        // Las listas loteadas se pasan como `t` (el trozo). Cualquier otra
        // variable dentro de un `in:` es una lista sin techo.
        const ofensores = [...borrado.matchAll(/\{\s*in:\s*([A-Za-z_$][\w$.]*)\s*\}/g)]
            .map((m) => m[1])
            .filter((v) => v !== "t" && !v.startsWith("INTOCABLES."));
        expect(ofensores, `listas sin lotear: ${ofensores.join(", ")}`).toEqual([]);
    });

    it("tampoco queda un `notIn` con una lista de ids", () => {
        // El conteo de lo real pasó a LEFT JOIN: cero parámetros.
        expect(borrado).not.toContain("notIn:");
        expect(borrado).toContain("LEFT JOIN demo_marcado dm");
    });

    it("el candado detecta la forma vieja (contraprueba)", () => {
        const detecta = (linea: string) =>
            [...linea.matchAll(/\{\s*in:\s*([A-Za-z_$][\w$.]*)\s*\}/g)]
                .map((m) => m[1])
                .some((v) => v !== "t" && !v.startsWith("INTOCABLES."));
        expect(detecta("deleteMany({ where: { entidadId: { in: idsBorrados } } })")).toBe(true);
        expect(detecta("deleteMany({ where: { id: { in: ids } } })")).toBe(true);
        expect(detecta("deleteMany({ where: { id: { in: t } } })")).toBe(false);
    });

    it("la limpieza del marcador —la que reventó— va por lotes", () => {
        expect(borrado).toContain("borrarEnLotes(idsBorrados");
    });

    it("el marcado ya iba por lotes desde SPEC-412 y sigue igual", () => {
        // Por eso el marcado retroactivo de las 37.176 filas SÍ funcionó.
        expect(leerCodigo("_marcado.ts")).toContain("i += LOTE_MARCADO");
    });
});
