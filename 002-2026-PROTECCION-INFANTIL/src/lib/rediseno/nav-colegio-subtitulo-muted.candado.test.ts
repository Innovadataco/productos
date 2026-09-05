/**
 * SPEC-478 (fallo de forma de Diseño): el subtítulo «Panel institucional» del
 * ColegioSideNav debe usar `text-muted` (AA 6.30 sobre el fondo con glow del
 * gradiente), no `text-subtle` (4.53, al filo). Candado de fuente, sin BD.
 * Contraprueba (mutación): volver el subtítulo a `text-subtle` → rojo en ambos tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
    resolve(__dirname, "..", "..", "components/modules/colegio/ColegioSideNav.tsx"),
    "utf-8",
);
const linea = src.split("\n").find((l) => l.includes("Panel institucional")) ?? "";

describe("SPEC-478 · subtítulo del nav de colegio en text-muted (AA)", () => {
    it("el subtítulo «Panel institucional» usa text-muted", () => {
        expect(linea, "no encontré el subtítulo «Panel institucional»").not.toBe("");
        expect(/\btext-muted\b/.test(linea), "El subtítulo debe usar text-muted (AA 6.30).").toBe(true);
    });
    it("no vuelve a text-subtle (4.53, al filo sobre el glow)", () => {
        expect(/\btext-subtle\b/.test(linea), "text-subtle queda al filo de AA; Diseño lo subió a text-muted.").toBe(false);
    });
});
