/**
 * CANDADO · SPEC-886 (I-438) · los servicios que SIRVEN rotan sus logs.
 *
 * El driver por defecto `json-file` SIN `max-size`/`max-file` perdía los logs al recrear el contenedor
 * (cada deploy) y crecía sin tope (riesgo de disco) → sin forense cuando algo revienta. Este candado exige
 * que cada servicio que SIRVE (imagen `pi-app`: la app + todos los workers) declare `logging` con
 * `max-size` en `docker-compose.prod.yml`. `db` (pgvector) queda fuera del alcance de esta SPEC.
 *
 * Control positivo: quitarle el bloque `logging` (o el `max-size`) a un serving service → rojo.
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

/** "Sirve" = corre la imagen de la app (app + todos los workers). db (pgvector) no sirve. */
function sirve(bloque: string): boolean {
    return /^\s*image:\s*pi-app:/m.test(bloque);
}

describe("SPEC-886 · rotación de logs en los servicios que sirven", () => {
    const servidores = servicios().filter((s) => sirve(s.bloque));

    it("sanidad del parseo: ≥12 serving services, incluye app y worker", () => {
        const nombres = servidores.map((s) => s.nombre);
        expect(nombres.length).toBeGreaterThanOrEqual(12);
        expect(nombres).toContain("app");
        expect(nombres).toContain("worker");
    });

    it("db NO está entre los que sirven (fuera del alcance de esta SPEC)", () => {
        expect(servidores.map((s) => s.nombre)).not.toContain("db");
    });

    it("cada servicio que sirve declara logging con max-size (rotación)", () => {
        const violaciones: string[] = [];
        for (const { nombre, bloque } of servidores) {
            const tieneLogging = /\n\s*logging:\s*$/m.test(bloque);
            const tieneMaxSize = /\n\s*max-size:\s*["']?\d+\s*[kmg]b?["']?/i.test(bloque);
            if (!tieneLogging || !tieneMaxSize) {
                violaciones.push(`${nombre}: ${!tieneLogging ? "sin bloque logging" : "logging sin max-size"}`);
            }
        }
        expect(violaciones, `serving services sin rotación de logs: ${violaciones.join(" · ")}`).toEqual([]);
    });
});
