import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fechaHechoLegible, fechaHoraSinMinutos } from "./fecha";

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

describe("SPEC-626 · la hora aproximada no se muestra como precisa", () => {
    const iso = "2026-09-08T15:00:00.000Z";

    it("(helper) con horaAproximada=true NO aparece hora; con precisa SÍ", () => {
        const aproximada = fechaHechoLegible(iso, true);
        const precisa = fechaHechoLegible(iso, false);
        // La versión precisa lleva el separador « · » + hora; la aproximada no.
        expect(precisa).toBe(fechaHoraSinMinutos(iso));
        expect(precisa).toContain("·");
        expect(aproximada).not.toContain("·");
        expect(aproximada).not.toMatch(/\d\s*(a\.?\s*m\.?|p\.?\s*m\.?)/i);
        // La FECHA sí está en ambas.
        expect(aproximada).toContain("2026");
    });

    it("(helper) sin bandera (undefined) se comporta como precisa — compatibilidad", () => {
        expect(fechaHechoLegible(iso)).toBe(fechaHoraSinMinutos(iso));
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
