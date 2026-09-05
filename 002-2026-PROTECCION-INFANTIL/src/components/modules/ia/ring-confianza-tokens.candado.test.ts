/**
 * SPEC-489 · el medidor de confianza de IaDocsPanel a tokens (escala §7.9 de Diseño).
 *
 * El ring codifica un valor; la escala la fija Diseño: en/sobre umbral → pino,
 * bajo umbral → ámbar, arco neutro (--linea), marcador tinta-muted, NUNCA rojo.
 * La lógica del umbral (`confianza >= umbral`) no cambia — solo el color por token.
 *
 * Conducta, muere por mutación:
 *  - el arco de valor usa `text-estado-pino`/`text-estado-ambar` según el umbral.
 *  - 0 crudo `green/amber/slate` y CERO rojo (`red`/`rubi`) en el ring.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ARCHIVO = path.resolve(__dirname, "IaDocsPanel.tsx");

describe("SPEC-489 · el ring de confianza usa la escala por token (nunca rojo)", () => {
    const src = fs.readFileSync(ARCHIVO, "utf-8");

    it("el arco de valor mapea el umbral a pino/ámbar por token", () => {
        expect(src).toMatch(/confianza >= umbral \? "text-estado-pino" : "text-estado-ambar"/);
    });

    it("0 crudo green/amber/slate en IaDocsPanel (ring tokenizado)", () => {
        const hits = src
            .split("\n")
            .map((l, i) => ({ l, i }))
            .filter(({ l }) => /-(green|amber|slate|gray)-[0-9]/.test(l))
            .map(({ l, i }) => `IaDocsPanel.tsx:${i + 1}: ${l.trim().slice(0, 80)}`);
        expect(hits, hits.join("\n")).toEqual([]);
    });

    it("NUNCA rojo en el ring: sin text-red ni rubi en el medidor", () => {
        // El medidor es la única superficie donde el color = valor; la regla dura
        // de PI («nunca rojo donde importa») aplica: bajo umbral es ámbar, no rojo.
        expect(src).not.toMatch(/-red-[0-9]/);
        expect(src).not.toMatch(/text-estado-rubi|-rubi\b/);
    });
});
