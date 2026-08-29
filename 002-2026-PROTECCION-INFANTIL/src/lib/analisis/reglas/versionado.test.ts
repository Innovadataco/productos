/**
 * SPEC-224 (002-PI-125, FR-010/FR-011): tests de los helpers puros de
 * versionado del panel de reglas. Sin BD (se construye una ReglaRecomendacion
 * sintética tipada).
 */
import { describe, it, expect } from "vitest";
import type { ReglaRecomendacion } from "@prisma/client";
import { CAMPOS_FUNCIONALES, construirSnapshot, diffCampos } from "./versionado";

function reglaBase(): ReglaRecomendacion {
    return {
        id: "r1",
        clave: "test.regla",
        nombre: "Regla de prueba",
        descripcion: "Descripción",
        categoria: "renovacion",
        sqlQuery: "SELECT 1",
        plantillaRecomendacion: "Hola {{colegio}}",
        modo: "RECOMIENDA",
        accionEjecutable: null,
        accionParametros: null,
        prioridad: 80,
        umbralMinimo: 3,
        frecuenciaMin: 60,
        activa: true,
        version: 2,
        creadaPorAdminId: "admin1",
        createdAt: new Date("2026-08-01T12:00:00.000Z"),
        updatedAt: new Date("2026-08-10T12:00:00.000Z"),
        ultimaEvaluacionEn: null,
    };
}

describe("construirSnapshot", () => {
    it("serializa el estado completo con fechas ISO y cubre todos los campos funcionales", () => {
        const snapshot = construirSnapshot(reglaBase());
        expect(snapshot.createdAt).toBe("2026-08-01T12:00:00.000Z");
        expect(snapshot.ultimaEvaluacionEn).toBeNull();
        for (const campo of CAMPOS_FUNCIONALES) {
            expect(snapshot).toHaveProperty(campo);
        }
        expect(snapshot.version).toBe(2);
        expect(snapshot.modo).toBe("RECOMIENDA");
    });
});

describe("diffCampos", () => {
    it("detecta el campo cambiado y solo ese", () => {
        const antes = construirSnapshot(reglaBase());
        const despues = { ...antes, umbralMinimo: 5 };
        expect(diffCampos(antes, despues)).toEqual(["umbralMinimo"]);
    });
    it("distingue null de valor y compara JSON por contenido", () => {
        const antes = construirSnapshot(reglaBase());
        const conAccion = { ...antes, accionParametros: { bono: 10 } };
        expect(diffCampos(antes, conAccion)).toEqual(["accionParametros"]);
        const igualJson = { ...antes, accionParametros: null };
        expect(diffCampos(antes, igualJson)).toEqual([]);
    });
    it("detecta varios campos a la vez (activa + prioridad)", () => {
        const antes = construirSnapshot(reglaBase());
        const despues = { ...antes, activa: false, prioridad: 10 };
        expect(diffCampos(antes, despues).sort()).toEqual(["activa", "prioridad"]);
    });
    it("ignora campos no funcionales (modo, version)", () => {
        const antes = construirSnapshot(reglaBase());
        const despues = { ...antes, modo: "EJECUTA", version: 3 };
        expect(diffCampos(antes, despues)).toEqual([]);
    });
});
