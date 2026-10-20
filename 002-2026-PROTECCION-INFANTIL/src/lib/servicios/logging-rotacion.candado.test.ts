/**
 * CANDADO · SPEC-886 (I-438) · TODOS los servicios de prod rotan sus logs.
 *
 * El driver por defecto `json-file` SIN `max-size`/`max-file` perdía los logs al recrear el contenedor
 * (cada deploy) y crecía sin tope (riesgo de disco) → sin forense cuando algo revienta. Este candado exige
 * que CADA servicio de `docker-compose.prod.yml` —la app, todos los workers (imagen `pi-app`) Y la `db`
 * (pgvector)— declare `logging` con `max-size`. db se incluyó por decisión del CEO: mismo riesgo de disco,
 * mismo fix; no se deja el hueco.
 *
 * Control positivo: quitarle el bloque `logging` (o el `max-size`) a cualquier servicio → rojo.
 * Reusa el parser por-servicio de `compose.ratchet.test.ts` (por línea, sin librería YAML nueva).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const COMPOSE = fs.readFileSync(path.join(process.cwd(), "docker-compose.prod.yml"), "utf8");

/** Bloques por servicio (indent nivel 2 bajo `services:`), igual que compose.ratchet. */
function servicios(): Array<{ nombre: string; bloque: string }> {
    const lineas = COMPOSE.split("\n");
    const out: Array<{ nombre: string; bloque: string }> = [];
    let seccion: "services" | "otra" | "inicio" = "inicio";
    let servicio: string | null = null;
    let acum: string[] = [];
    for (const linea of lineas) {
        const topLevel = linea.match(/^([a-z][a-z0-9_-]*):\s*$/);
        if (topLevel) {
            if (servicio && seccion === "services") out.push({ nombre: servicio, bloque: acum.join("\n") });
            servicio = null;
            acum = [];
            seccion = topLevel[1] === "services" ? "services" : "otra";
            continue;
        }
        if (seccion !== "services") continue;
        const svc = linea.match(/^  ([a-z][a-z0-9_-]*):\s*$/);
        if (svc) {
            if (servicio) out.push({ nombre: servicio, bloque: acum.join("\n") });
            servicio = svc[1];
            acum = [];
        } else if (servicio) {
            acum.push(linea);
        }
    }
    if (servicio && seccion === "services") out.push({ nombre: servicio, bloque: acum.join("\n") });
    return out;
}

function tieneRotacion(bloque: string): boolean {
    const tieneLogging = /\n\s*logging:\s*$/m.test(bloque);
    const tieneMaxSize = /\n\s*max-size:\s*["']?\d+\s*[kmg]b?["']?/i.test(bloque);
    return tieneLogging && tieneMaxSize;
}

describe("SPEC-886 · rotación de logs en TODOS los servicios (app + workers + db)", () => {
    const svcs = servicios();

    it("sanidad del parseo: ≥13 servicios, incluye app, worker y db", () => {
        const nombres = svcs.map((s) => s.nombre);
        expect(nombres.length).toBeGreaterThanOrEqual(13);
        expect(nombres).toContain("app");
        expect(nombres).toContain("worker");
        expect(nombres).toContain("db");
    });

    it("db también tiene rotación (mismo riesgo de disco; no se deja el hueco)", () => {
        const db = svcs.find((s) => s.nombre === "db");
        expect(db, "db presente en el compose").toBeTruthy();
        expect(tieneRotacion(db!.bloque), "db con logging + max-size").toBe(true);
    });

    it("cada servicio declara logging con max-size (rotación)", () => {
        const violaciones: string[] = [];
        for (const { nombre, bloque } of svcs) {
            if (!tieneRotacion(bloque)) {
                const sinLogging = !/\n\s*logging:\s*$/m.test(bloque);
                violaciones.push(`${nombre}: ${sinLogging ? "sin bloque logging" : "logging sin max-size"}`);
            }
        }
        expect(violaciones, `servicios sin rotación de logs: ${violaciones.join(" · ")}`).toEqual([]);
    });
});
