/**
 * SPEC-473 · GlassCard firma (fallo de Diseño 00-05-09-2026): el vidrio base del
 * producto (123 pantallas) cablea su radio al TOKEN del sistema (`--radio-card`),
 * y **NO lleva grano** — el grano vive solo sobre relleno de acento (globals:488);
 * GlassCard es vidrio neutro (material saturate+blur).
 *
 * Contraprueba (por mutación): volver a `rounded-3xl` (radio suelto) → rojo del test 1;
 * meter grano (`--pi-btn-grano`) → rojo del test 2.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(__dirname, "GlassCard.tsx"), "utf-8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("SPEC-473 · GlassCard firma", () => {
    it("el radio sale del token del sistema, no de una escala suelta", () => {
        expect(/rounded-\[var\(--radio-card\)\]/.test(src), "El radio va por el token `--radio-card`.").toBe(true);
        expect(/\brounded-(?:3xl|2xl|xl|\[[0-9])/.test(src), "Sin radio suelto: el sistema manda el radio.").toBe(false);
    });
    it("no lleva grano (es vidrio neutro, no relleno de acento)", () => {
        expect(/grano|pi-btn-grano/.test(src), "El grano vive solo sobre acento; GlassCard es vidrio neutro.").toBe(false);
    });
});
