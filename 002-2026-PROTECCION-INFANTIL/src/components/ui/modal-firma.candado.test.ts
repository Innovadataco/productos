/**
 * SPEC-474 · Modal firma (fallo de Diseño): el radio sale del token `--radio-hero`
 * (22px, no «20px» ni «32%»), sobre material vidrio (`glass-strong` = saturate+blur),
 * **sin grano** (vidrio neutro). Diseño acotó el mueble a firma+radio; el hallazgo de
 * los 3 botones rubí sólido (I-320) NO se toca acá — sigue en la mesa de Diseño.
 *
 * Contraprueba (por mutación): volver a `rounded-2xl` → rojo del test 1; meter grano → rojo del test 2.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(__dirname, "Modal.tsx"), "utf-8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("SPEC-474 · Modal firma", () => {
    it("el radio sale del token `--radio-hero`, no de una escala suelta", () => {
        expect(/rounded-\[var\(--radio-hero\)\]/.test(src), "El radio va por el token `--radio-hero`.").toBe(true);
        expect(/\brounded-(?:3xl|2xl|xl|\[[0-9])/.test(src), "Sin radio suelto en el panel del modal.").toBe(false);
    });
    it("material vidrio (glass) sin grano", () => {
        expect(/glass-strong|glass\b/.test(src), "El modal usa el material vidrio (saturate+blur).").toBe(true);
        expect(/grano|pi-btn-grano/.test(src), "Sin grano: el modal es vidrio neutro.").toBe(false);
    });
});
