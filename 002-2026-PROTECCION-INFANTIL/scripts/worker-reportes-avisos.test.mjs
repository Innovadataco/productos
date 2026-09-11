/**
 * CANDADO · SPEC-671 (I-397) — los avisos de coincidencia sobreviven al motor caído.
 *
 * El defecto vive en el CABLEADO, no en las funciones (sus 11 pruebas pasan). Así
 * que este candado NO prueba las funciones de aviso: prueba que
 *   (a) `rescatarYAvisar` —la ruta que toma el worker cuando la clasificación
 *       FALLA— dispara los TRES avisos una vez que el reporte quedó rescatado; y
 *       que si el rescate lanza (404: no existe) NO avisa, que es lo correcto;
 *   (b) los tres errores están AISLADOS (uno que falle no calla a los otros);
 *   (c) el worker cablea AMBAS rutas (éxito y rescate), para que nadie revierta
 *       al defecto de I-397 (avisos solo en la rama de éxito).
 *
 * Ejercido en las dos caras por mutación: quitar el disparo del rescate pone (a)
 * en rojo; quitar el `.catch` de un aviso rompe el aislamiento de (b).
 */
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { dispararAvisosDeCoincidencia, rescatarYAvisar } from "./worker-reportes-avisos.mjs";

function avisosMock() {
    return {
        circulo: vi.fn().mockResolvedValue(undefined),
        hijos: vi.fn().mockResolvedValue(undefined),
        colegio: vi.fn().mockResolvedValue(undefined),
    };
}

describe("dispararAvisosDeCoincidencia (SPEC-671)", () => {
    it("dispara los TRES avisos de coincidencia", async () => {
        const avisos = avisosMock();
        await dispararAvisosDeCoincidencia("r1", avisos);
        expect(avisos.circulo).toHaveBeenCalledWith("r1");
        expect(avisos.hijos).toHaveBeenCalledWith("r1");
        expect(avisos.colegio).toHaveBeenCalledWith("r1");
    });

    it("errores AISLADOS: si el aviso de un canal falla, los otros dos salen igual", async () => {
        const avisos = avisosMock();
        avisos.hijos.mockRejectedValue(new Error("boom hijos"));
        const onError = vi.fn();
        await dispararAvisosDeCoincidencia("r1", avisos, onError);
        expect(avisos.circulo).toHaveBeenCalledWith("r1");
        expect(avisos.colegio).toHaveBeenCalledWith("r1");
        expect(onError).toHaveBeenCalledWith("hijos", "r1", expect.any(Error));
    });
});

describe("rescatarYAvisar (SPEC-671) — el candado del CABLEADO con la clasificación fallando", () => {
    it("clasificación falló → rescate OK (REVISION_MANUAL, visible) → dispara LOS TRES", async () => {
        const avisos = avisosMock();
        const llamarFallback = vi.fn().mockResolvedValue({ estado: "REVISION_MANUAL" });
        await rescatarYAvisar("r1", "HTTP 500: worker processing failed", { llamarFallback, avisos });
        expect(llamarFallback).toHaveBeenCalledWith("r1", "HTTP 500: worker processing failed");
        expect(avisos.circulo).toHaveBeenCalledWith("r1");
        expect(avisos.hijos).toHaveBeenCalledWith("r1");
        expect(avisos.colegio).toHaveBeenCalledWith("r1");
    });

    it("el rescate LANZA (404: el reporte no existe) → NO avisa (no hay a quién)", async () => {
        const avisos = avisosMock();
        const llamarFallback = vi.fn().mockRejectedValue(new Error("Fallback HTTP 404: no encontrado"));
        await expect(rescatarYAvisar("r1", "x", { llamarFallback, avisos })).rejects.toThrow(/404/);
        expect(avisos.circulo).not.toHaveBeenCalled();
        expect(avisos.hijos).not.toHaveBeenCalled();
        expect(avisos.colegio).not.toHaveBeenCalled();
    });
});

describe("SPEC-671 · el worker cablea los avisos en las DOS rutas", () => {
    const RAIZ = path.resolve(__dirname, "..");
    const worker = fs
        .readFileSync(path.join(RAIZ, "scripts/worker-reportes.mjs"), "utf-8")
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n");

    it("ruta de ÉXITO: dispara los avisos de coincidencia (no llamadas sueltas)", () => {
        expect(
            /dispararAvisosDeCoincidencia\s*\(/.test(worker),
            "Si la ruta de éxito deja de usar el helper, se pierde la fuente única del cableado.",
        ).toBe(true);
    });

    it("ruta de RESCATE: rescata Y avisa — no un llamarFallback pelado que abandona el aviso (I-397)", () => {
        expect(/rescatarYAvisar\s*\(/.test(worker), "el rescate del worker tiene que ir por rescatarYAvisar").toBe(true);
        // El defecto de I-397 era rescatar con `llamarFallback(reporteId, msg)` pelado y NO avisar.
        // Ese patrón de LLAMADA (con `, msg`) no puede reaparecer en ningún sitio de rescate; la
        // definición usa `(reporteId, error)`, así que esto no la toca. Revertir cualquier sitio a
        // pelado vuelve a abandonar el aviso — y esta aserción se pone roja.
        expect(
            /llamarFallback\s*\(\s*reporteId\s*,\s*msg/.test(worker),
            "Un `llamarFallback(reporteId, msg)` pelado es el defecto de I-397: rescata y abandona el aviso.",
        ).toBe(false);
    });
});
