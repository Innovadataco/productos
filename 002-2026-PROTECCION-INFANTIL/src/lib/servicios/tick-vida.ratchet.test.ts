/**
 * SPEC-291 (002-PI-191) — Ratchet estático:
 * cada worker `.mjs` que aparece como `command:` en docker-compose.prod.yml
 * DEBE llamar `iniciarTickVida("<contenedor>")` al inicio (después de imports).
 * Excepciones: pi-sesiones (lo agrega SPEC-290/002-PI-190/D-1).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const COMPOSE = fs.readFileSync(path.join(REPO_ROOT, "docker-compose.prod.yml"), "utf8");

// Servicios docker cuyo `command:` apunta a un script en `scripts/`.
// Regex tolerante: acepta `node ... scripts/<archivo>.mjs` con flags intermedios.
function extraerScriptsPorServicio(): Array<{ servicio: string; script: string }> {
    const lineas = COMPOSE.split("\n");
    const pares: Array<{ servicio: string; script: string }> = [];
    let servicioActual: string | null = null;
    for (const linea of lineas) {
        const matchServicio = linea.match(/^  ([a-z][a-z0-9_-]*):\s*$/);
        if (matchServicio) {
            servicioActual = matchServicio[1];
            continue;
        }
        const matchCmd = linea.match(/^\s*command:\s.*scripts\/([a-z0-9_-]+\.mjs)/);
        if (matchCmd && servicioActual) {
            pares.push({ servicio: servicioActual, script: matchCmd[1] });
        }
    }
    return pares;
}

// Excepciones documentadas: SPEC-290 (002-PI-190) implementó pi-sesiones con
// su propio patrón `touchAliveFile` (worker-sesiones-heartbeat.mjs) en vez de
// `iniciarTickVida`. Su healthcheck docker sí funciona; permanece exento del
// ratchet de imports mientras coexistan los dos patrones.
const EXENTOS = new Set(["pi-sesiones"]);

describe("SPEC-291 · ratchet tick-vida en workers", () => {
    const pares = extraerScriptsPorServicio();

    it("hay al menos 8 servicios con script (sanidad del parseo)", () => {
        expect(pares.length).toBeGreaterThanOrEqual(8);
    });

    it("cada worker con servicio en compose llama iniciarTickVida (excepto pi-sesiones · SPEC-290)", () => {
        const violaciones: string[] = [];
        for (const { servicio, script } of pares) {
            if (EXENTOS.has(servicio)) continue;
            const ruta = path.join(REPO_ROOT, "scripts", script);
            if (!fs.existsSync(ruta)) {
                violaciones.push(`${servicio}: script ${script} no existe`);
                continue;
            }
            const src = fs.readFileSync(ruta, "utf8");
            if (!/\biniciarTickVida\s*\(/.test(src)) {
                violaciones.push(`${servicio} (${script}): falta llamada a iniciarTickVida`);
            }
            if (!/from\s+["'][^"']*monitoreo\/tick-vida/.test(src)) {
                violaciones.push(`${servicio} (${script}): falta import de tick-vida`);
            }
        }
        expect(violaciones, violaciones.join(" · ")).toEqual([]);
    });
});
