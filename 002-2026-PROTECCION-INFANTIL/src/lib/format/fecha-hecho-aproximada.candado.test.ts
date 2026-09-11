import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fechaHechoLegible, fechaHoraSinMinutos } from "./fecha";
import { ETIQUETA_FRANJA } from "@/lib/reportes/franja-aproximada";

/**
 * SPEC-626 · CANDADO: cuando la hora del hecho es APROXIMADA, ninguna superficie
 * muestra una hora — el padre no la dio y fingirla en un caso sobre un menor es
 * peor que no tenerla (condición no-negociable del CEO).
 *
 * Dos afirmaciones:
 *  (helper) `fechaHechoLegible` NO muestra hora con `horaAproximada=true`, y SÍ
 *           la muestra con hora precisa.
 *  (clase)  ningún fuente formatea la fecha del HECHO (`fechaIncidente`) con
 *           `fechaHoraSinMinutos` DIRECTO — debe pasar por `fechaHechoLegible`,
 *           que respeta la bandera. Así una superficie nueva no puede volver a
 *           mostrar la hora sin honrarla. (Ejercita la LECTURA, no la escritura.)
 *
 * Muere por mutación: revertir un caller a `fechaHoraSinMinutos(x.fechaIncidente)`
 * pone rojo la parte (clase); mostrar la hora con el flag pone rojo (helper).
 * fs + helper puro → unit, sin base.
 */

describe("SPEC-626 (I-379) · la hora aproximada se lee como FRANJA, la exacta como hora", () => {
    // Centro de «mañana» en Bogotá = 9:00 a.m. = UTC 14:00. Con horaAproximada=true,
    // la hora guardada es siempre uno de los centros {3,9,15,21}.
    const ISO_MANANA = "2026-09-08T14:00:00.000Z";

    it("(helper·APROXIMADA) muestra la FRANJA, NUNCA la hora representativa (9)", () => {
        const aproximada = fechaHechoLegible(ISO_MANANA, true);
        // la franja, con su rango (de ETIQUETA_FRANJA) — no la hora de reloj.
        expect(aproximada).toContain(ETIQUETA_FRANJA.manana);
        // la hora representativa (9) JAMÁS como hora de reloj (I-379 aceptación #1).
        expect(aproximada).not.toMatch(/\b9\s*(a\.?\s*m\.?|:00)/i);
        expect(aproximada).toContain("2026");
    });

    it("(helper·EXACTA) muestra la hora tal cual — con el flag en false Y sin flag", () => {
        // Ejercitar el flag en FALSE, no solo en true: si no, no sabríamos si
        // rompimos el caso donde la hora SÍ es real y debe verse (condición CEO).
        const exacta = fechaHechoLegible(ISO_MANANA, false);
        expect(exacta).toBe(fechaHoraSinMinutos(ISO_MANANA));
        expect(exacta).toMatch(/9\s*a\.?\s*m\.?/i); // la hora real SÍ aparece
        // sin bandera (undefined) = exacta — compatibilidad con llamadas viejas.
        expect(fechaHechoLegible(ISO_MANANA)).toBe(exacta);
    });

    it("(clase) ningún fuente formatea `fechaIncidente` con `fechaHoraSinMinutos` directo", () => {
        const SRC = path.resolve(__dirname, "..", "..");
        const hits: string[] = [];
        // `fechaHoraSinMinutos( ... fechaIncidente ... )` en una misma línea.
        const RE = /fechaHoraSinMinutos\([^)]*fechaIncidente[^)]*\)/;
        const stack = [SRC];
        while (stack.length) {
            const dir = stack.pop()!;
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const ruta = path.join(dir, e.name);
                if (e.isDirectory()) {
                    if (e.name === "node_modules" || e.name === ".next") continue;
                    stack.push(ruta);
                } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
                    const codigo = fs.readFileSync(ruta, "utf-8");
                    codigo.split("\n").forEach((linea, i) => {
                        if (RE.test(linea)) hits.push(`${path.relative(SRC, ruta)}:${i + 1}: ${linea.trim().slice(0, 90)}`);
                    });
                }
            }
        }
        expect(
            hits,
            ["SPEC-626 — la fecha del hecho se formatea con hora sin honrar `horaAproximada`:",
                ...hits, "",
                "Usá `fechaHechoLegible(fechaIncidente, horaAproximada)`: con la bandera muestra solo la fecha."].join("\n"),
        ).toEqual([]);
    });
});
