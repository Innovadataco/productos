/**
 * CANDADO · SPEC-670 / I-396 — el latido del motor mide el MOTOR, no el worker.
 *
 * Muere con el defecto en las dos formas en que puede reaparecer:
 *  (conducta) si `motorVivo` deja de caer cuando hay un incidente del motor
 *    abierto (Ollama/tailscale) — lo que hoy la franja del rector ignoraba —, o
 *    si un rojo del WORKER (que no es el motor) lo tumbara por error.
 *  (estructura) si alguien vuelve a leer el latido del worker como fuente de
 *    vida del motor: el módulo NO puede importar `worker-heartbeat` ni llamar a
 *    `leerHeartbeatWorker`. Esa fuente es exactamente el defecto de I-396, y una
 *    prueba conductual con repo falso no la caza (leerHeartbeatWorker lee un
 *    archivo, no el repo) — por eso el candado estructural es imprescindible.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { leerLatidoMotor, SENALES_MOTOR, SENAL_ULTIMA_VERIFICACION } from "./latido-motor";
import type { MonitoreoRepository } from "../dal/repositories/monitoreo";

// Sin fila de parámetro → frescura por defecto (1h). Aísla la lógica del helper.
vi.mock("../parametros.ts", () => ({
    getParametroSistema: vi.fn().mockResolvedValue(null),
}));

const AHORA = new Date("2026-09-11T17:00:00Z").getTime();
const hace = (min: number) => new Date(AHORA - min * 60_000);

function repoFake(opts: { incidentes?: string[]; ultimoExito?: { creadoEn: Date } | null }): MonitoreoRepository {
    return {
        senalesConIncidentesAbiertos: async () => opts.incidentes ?? [],
        ultimoProbeExitosoDe: async (senal: string) =>
            senal === SENAL_ULTIMA_VERIFICACION ? (opts.ultimoExito ?? null) : null,
    } as unknown as MonitoreoRepository;
}

describe("leerLatidoMotor (SPEC-670 / I-396)", () => {
    it("VIVO solo si no hay incidente del motor Y hay un éxito reciente", async () => {
        const r = await leerLatidoMotor(repoFake({ incidentes: [], ultimoExito: { creadoEn: hace(5) } }), AHORA);
        expect(r.motorVivo).toBe(true);
        expect(r.ultimaVerificacionEn).toEqual(hace(5));
    });

    // El corazón del candado: el 11-09 el motor estaba caído (incidente abierto) y
    // había señales frescas; la franja igual decía «revisado hace un momento».
    it("CAÍDO si hay un incidente ABIERTO del motor, aunque el último éxito sea fresco", async () => {
        for (const senal of SENALES_MOTOR) {
            const r = await leerLatidoMotor(repoFake({ incidentes: [senal], ultimoExito: { creadoEn: hace(1) } }), AHORA);
            expect(r.motorVivo, `incidente ${senal} debe tumbar el motor`).toBe(false);
            // pero sigue exponiendo el último éxito real: el reloj delata cuánto lleva detenido.
            expect(r.ultimaVerificacionEn).toEqual(hace(1));
        }
    });

    it("CAÍDO si el último éxito es viejo (monitor detenido: no abre incidentes ni registra probes)", async () => {
        const r = await leerLatidoMotor(repoFake({ incidentes: [], ultimoExito: { creadoEn: hace(120) } }), AHORA);
        expect(r.motorVivo).toBe(false);
        expect(r.ultimaVerificacionEn).toEqual(hace(120)); // muestra el dato real, no lo inventa
    });

    it("CAÍDO y SIN reloj si nunca hubo un éxito (no hay dato que mostrar)", async () => {
        const r = await leerLatidoMotor(repoFake({ incidentes: [], ultimoExito: null }), AHORA);
        expect(r.motorVivo).toBe(false);
        expect(r.ultimaVerificacionEn).toBeNull();
    });

    // Fuente honesta: el worker respira ≠ el motor clasifica. Un rojo del WORKER
    // (tick-vida, notificaciones) NO es un rojo del motor y no debe tumbarlo.
    it("un incidente que NO es del motor (worker/tick-vida) no tumba el motor", async () => {
        const r = await leerLatidoMotor(
            repoFake({ incidentes: ["notificaciones", "worker"], ultimoExito: { creadoEn: hace(5) } }),
            AHORA,
        );
        expect(r.motorVivo).toBe(true);
    });

    it("ESTRUCTURAL: el módulo no lee el latido del worker (esa es la fuente equivocada de I-396)", () => {
        const fuente = readFileSync(resolve(process.cwd(), "src/lib/monitoreo/latido-motor.ts"), "utf-8");
        // Ni importa el módulo del heartbeat del worker…
        expect(fuente).not.toMatch(/import[^\n]*worker-heartbeat/);
        // …ni llama a su lector.
        expect(fuente).not.toMatch(/leerHeartbeatWorker\s*\(/);
        // Y sí se apoya en la verificación ACTIVA del motor.
        expect(fuente).toMatch(/ollama_smoke/);
    });
});
