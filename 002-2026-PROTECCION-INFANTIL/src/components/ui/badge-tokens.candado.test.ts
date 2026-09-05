/**
 * SPEC-457 · Badge al Sistema de Diseño (la peor deuda de color: 24 crudos × 79 pantallas).
 *
 * Candado de conducta en fuente: el mueble más repetido del producto no puede
 * traer NINGÚN color crudo, y cada estado mapea a su token SEMÁNTICO por función
 * (no por color decorativo): criticidad = `rubi`, nunca un rojo suelto.
 *
 * Contraprueba (por mutación, comprobada al escribir el candado):
 *  · devolver `bg-red-100` (o cualquier hex/escala) a una variante → rojo del test 1;
 *  · mapear `danger` a algo que no sea `rubi` → rojo del test 2.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RAIZ = resolve(__dirname, "..", "..", "..");
const src = readFileSync(resolve(RAIZ, "src/components/ui/Badge.tsx"), "utf-8");
const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const CRUDO =
    /#[0-9a-fA-F]{3,8}\b|\b(?:text|bg|border|ring|from|to|via|divide|outline|placeholder|caret|accent|decoration|stroke|fill|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/g;

describe("SPEC-457 · el Badge vive en tokens semánticos", () => {
    it("no trae ningún color crudo (hex ni escala Tailwind) — barrido del mueble", () => {
        const crudos = sinComentarios.match(CRUDO) ?? [];
        expect(
            crudos,
            "Color crudo en Badge.tsx: es el mueble más repetido del producto (79 pantallas). " +
                `Todo por token semántico. Encontrado: ${crudos.join(", ")}`,
        ).toEqual([]);
    });

    it("cada estado mapea a su token por FUNCIÓN — criticidad = rubi, nunca rojo decorativo", () => {
        const variante = (nombre: string) => {
            const m = new RegExp(`${nombre}:\\s*"([^"]*)"`).exec(sinComentarios);
            return m ? m[1] : "";
        };
        expect(variante("danger"), "danger = criticidad real → rubi").toMatch(/\brubi\b/);
        expect(variante("success"), "success = ok/verificado → pino").toMatch(/\bpino\b/);
        expect(variante("warning"), "warning = atención → ambar").toMatch(/\bambar\b/);
        // Y ninguna variante puede llevar `red-*` decorativo (criticidad es rubi, no rojo).
        expect(/\bred-[0-9]/.test(sinComentarios), "ningún rojo decorativo en el Badge").toBe(false);
    });
});
