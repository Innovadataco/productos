/**
 * SPEC-291 (002-PI-191) — Ratchet estático:
 * cada servicio en `docker-compose.prod.yml` DEBE tener bloque `healthcheck`.
 * Exención documentada:
 *   - pi-sesiones (SPEC-290/002-PI-190/D-1 — se agrega al mergear ese PR)
 * db tiene su propio healthcheck pg_isready (aceptado).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const COMPOSE_PATH = path.join(REPO_ROOT, "docker-compose.prod.yml");
const COMPOSE = fs.readFileSync(COMPOSE_PATH, "utf8");

// Exenciones — deben reducirse (nunca crecer) conforme mergeen otros SPECs.
// SPEC-290 (002-PI-190) ya agregó healthcheck a pi-sesiones → exención removida.
const EXENTOS = new Set<string>();

/**
 * Extrae bloques por servicio (indent nivel 2) y verifica presencia de `healthcheck:`.
 * Sin parser YAML full para no depender de librería nueva; usa regex y ventana por servicio.
 */
function servicios(): Array<{ nombre: string; bloque: string }> {
    const lineas = COMPOSE.split("\n");
    const out: Array<{ nombre: string; bloque: string }> = [];
    let seccion: "services" | "otra" | "inicio" = "inicio";
    let servicio: string | null = null;
    let acum: string[] = [];
    for (const linea of lineas) {
        // Cambio de sección top-level (0 indent).
        const topLevel = linea.match(/^([a-z][a-z0-9_-]*):\s*$/);
        if (topLevel) {
            if (servicio && seccion === "services") out.push({ nombre: servicio, bloque: acum.join("\n") });
            servicio = null;
            acum = [];
            seccion = topLevel[1] === "services" ? "services" : "otra";
            continue;
        }
        if (seccion !== "services") continue;
        // Servicio (indent 2, termina en `:`).
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

describe("SPEC-291 · ratchet healthcheck-completo", () => {
    const svcs = servicios();

    it("hay al menos 12 servicios (sanidad del parseo)", () => {
        const nombres = svcs.map((s) => s.nombre);
        expect(nombres.length).toBeGreaterThanOrEqual(12);
        expect(nombres).toContain("db");
        expect(nombres).toContain("app");
    });

    it("cada servicio tiene bloque healthcheck: (excepto exenciones documentadas)", () => {
        const violaciones: string[] = [];
        for (const { nombre, bloque } of svcs) {
            if (EXENTOS.has(nombre)) continue;
            if (!/\n\s*healthcheck:/.test(bloque)) {
                violaciones.push(`${nombre}: sin healthcheck`);
            }
        }
        expect(violaciones, violaciones.join(" · ")).toEqual([]);
    });
});
