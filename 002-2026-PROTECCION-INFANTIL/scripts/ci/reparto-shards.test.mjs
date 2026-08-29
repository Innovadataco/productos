/**
 * SPEC-281: pruebas unitarias del algoritmo LPT de reparto.
 */
import { describe, it, expect } from "vitest";
import { repartirEnShards } from "./reparto-shards.mjs";

describe("repartirEnShards (SPEC-281)", () => {
    it("greedy LPT: los 8 archivos caros del brief §4.5 se reparten entre los 4 shards", () => {
        const durations = [
            { archivo: "aplicar-bono.test.ts", duracionMs: 99000 },
            { archivo: "alertas.test.ts", duracionMs: 98000 },
            { archivo: "digest-semanal.test.ts", duracionMs: 67000 },
            { archivo: "avisos-observacion.test.ts", duracionMs: 62000 },
            { archivo: "webhooks-resend.test.ts", duracionMs: 61000 },
            { archivo: "colegio-resumen.test.ts", duracionMs: 52000 },
            { archivo: "carga-confirmar.test.ts", duracionMs: 51000 },
            { archivo: "embedding.test.ts", duracionMs: 49000 },
        ];
        const shards = repartirEnShards(durations, 4);
        expect(shards).toHaveLength(4);
        // Cada shard con al menos un archivo pesado (no todo en uno solo).
        expect(shards.every((s) => s.archivos.length >= 1)).toBe(true);
        // La suma total coincide con el input.
        const sum = shards.reduce((a, s) => a + s.archivos.length, 0);
        expect(sum).toBe(durations.length);
        // El desbalance (max - min) debe ser < 30 % del promedio.
        const totales = shards.map((s) => s.totalMs);
        const max = Math.max(...totales);
        const min = Math.min(...totales);
        const promedio = totales.reduce((a, b) => a + b, 0) / totales.length;
        expect(max - min).toBeLessThan(promedio * 0.3);
    });

    it("determinista: dos ejecuciones con el mismo input producen la misma asignación", () => {
        const durations = [
            { archivo: "a.test.ts", duracionMs: 10 },
            { archivo: "b.test.ts", duracionMs: 20 },
            { archivo: "c.test.ts", duracionMs: 30 },
            { archivo: "d.test.ts", duracionMs: 15 },
            { archivo: "e.test.ts", duracionMs: 25 },
        ];
        const r1 = repartirEnShards(durations, 2);
        const r2 = repartirEnShards([...durations].reverse(), 2);
        // Ambas ejecuciones producen la misma partición de archivos por shard.
        const setsR1 = r1.map((s) => new Set(s.archivos));
        const setsR2 = r2.map((s) => new Set(s.archivos));
        // Compara sets ignorando orden entre shards (empatan por totalMs igual → misma partición conceptual).
        for (const s of setsR1) {
            const equivalente = setsR2.find((t) => t.size === s.size && [...s].every((x) => t.has(x)));
            expect(equivalente).toBeDefined();
        }
    });

    it("input vacío → 4 shards vacíos", () => {
        const shards = repartirEnShards([], 4);
        expect(shards).toHaveLength(4);
        expect(shards.every((s) => s.archivos.length === 0)).toBe(true);
        expect(shards.every((s) => s.totalMs === 0)).toBe(true);
    });

    it("un solo archivo → cae en el shard 0", () => {
        const shards = repartirEnShards([{ archivo: "solo.test.ts", duracionMs: 5000 }], 4);
        expect(shards[0].archivos).toEqual(["solo.test.ts"]);
        expect(shards[1].archivos).toEqual([]);
        expect(shards[2].archivos).toEqual([]);
        expect(shards[3].archivos).toEqual([]);
    });

    it("orden alfabético dentro de cada shard (determinismo interno)", () => {
        const durations = [
            { archivo: "z.test.ts", duracionMs: 100 },
            { archivo: "a.test.ts", duracionMs: 100 },
            { archivo: "m.test.ts", duracionMs: 100 },
        ];
        const shards = repartirEnShards(durations, 1);
        expect(shards[0].archivos).toEqual(["a.test.ts", "m.test.ts", "z.test.ts"]);
    });
});
