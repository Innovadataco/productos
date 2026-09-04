/**
 * SPEC-291 (002-PI-191) — docker-adapter guard tests.
 * Inyecta runner mock para evitar tocar el docker real.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    ejecutarAccionDocker,
    esComandoPermitido,
    esContenedorPermitido,
    setDockerRunner,
    CONTENEDORES_PERMITIDOS,
    COMANDOS_SERVICIO,
    type DockerRunner,
} from "./docker-adapter";
import { AppError } from "../errors";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let mockRunner: ReturnType<typeof vi.fn>;

beforeEach(() => {
    // Docker API responde 204 No Content en start/stop/restart exitosos.
    mockRunner = vi.fn(async () => ({ status: 204, body: "" }));
    setDockerRunner(mockRunner as unknown as DockerRunner);
});

afterEach(() => {
    setDockerRunner(null);
});

describe("docker-adapter · whitelist", () => {
    it("acepta las 3 combinaciones canónicas del brief (usando la Docker Engine API por HTTP)", async () => {
        await ejecutarAccionDocker("restart", "pi-analisis-score");
        await ejecutarAccionDocker("stop", "pi-monitor");
        await ejecutarAccionDocker("start", "pi-worker");
        expect(mockRunner).toHaveBeenCalledTimes(3);
        expect(mockRunner.mock.calls[0][0]).toBe("POST");
        expect(mockRunner.mock.calls[0][1]).toBe("/containers/pi-analisis-score/restart");
    });

    it("acepta las 39 combinaciones de whitelist (3 cmds × 13 contenedores)", async () => {
        for (const cmd of COMANDOS_SERVICIO) {
            for (const cont of CONTENEDORES_PERMITIDOS) {
                await ejecutarAccionDocker(cmd, cont);
            }
        }
        expect(mockRunner).toHaveBeenCalledTimes(39);
    });

    it("rechaza comandos peligrosos (kill, rm, exec, up, down, cadenas vacías, interpolación)", async () => {
        const cmdsMalos = ["kill", "rm", "exec", "up", "down", "restart; rm -rf /", "", "RESTART", "restart\n"];
        for (const cmd of cmdsMalos) {
            await expect(ejecutarAccionDocker(cmd, "pi-worker")).rejects.toBeInstanceOf(AppError);
        }
        expect(mockRunner).not.toHaveBeenCalled();
    });

    it("rechaza contenedores fuera de whitelist (db, pi-app, unknown, shell injection)", async () => {
        const contsMalos = ["pi-db", "db", "pi-app", "app", "hackerman", "pi-worker; rm -rf /", "", "PI-WORKER", "../etc/passwd"];
        for (const cont of contsMalos) {
            await expect(ejecutarAccionDocker("restart", cont)).rejects.toBeInstanceOf(AppError);
        }
        expect(mockRunner).not.toHaveBeenCalled();
    });

    it("db y pi-app NO están en CONTENEDORES_PERMITIDOS (guardia contra catástrofe y auto-referencia)", () => {
        expect(esContenedorPermitido("pi-db")).toBe(false);
        expect(esContenedorPermitido("pi-app")).toBe(false);
        expect(esContenedorPermitido("db")).toBe(false);
        expect(esContenedorPermitido("app")).toBe(false);
    });

    it("comandos como `up`, `down`, `build`, `exec`, `logs` NO están en COMANDOS_SERVICIO", () => {
        expect(esComandoPermitido("up")).toBe(false);
        expect(esComandoPermitido("down")).toBe(false);
        expect(esComandoPermitido("build")).toBe(false);
        expect(esComandoPermitido("exec")).toBe(false);
        expect(esComandoPermitido("logs")).toBe(false);
        expect(esComandoPermitido("kill")).toBe(false);
    });

    it("errores de whitelist son AppError con statusCode 400 y code VALIDATION_ERROR", async () => {
        try {
            await ejecutarAccionDocker("hack", "pi-worker");
            expect.fail("debió lanzar");
        } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            expect((err as AppError).statusCode).toBe(400);
            expect((err as AppError).code).toBe("VALIDATION_ERROR");
        }
    });

    it("aceptable Docker 304 (contenedor ya en el estado deseado)", async () => {
        setDockerRunner((async () => ({ status: 304, body: "" })) as unknown as DockerRunner);
        await expect(ejecutarAccionDocker("start", "pi-worker")).resolves.toEqual({ ok: true });
    });

    it("Docker 5xx lanza AppError 502 con detalle acotado", async () => {
        setDockerRunner((async () => ({ status: 500, body: "no such container".repeat(50) })) as unknown as DockerRunner);
        try {
            await ejecutarAccionDocker("restart", "pi-worker");
            expect.fail("debió lanzar");
        } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            expect((err as AppError).statusCode).toBe(502);
        }
    });
});


describe("SPEC-427 (radicado v3) · la whitelist coincide con los servicios del compose", () => {
    it("todo container_name del compose (menos db y pi-app) está en la whitelist, y nada sobra", () => {
        // El único guard hasta ahora era un `toHaveBeenCalledTimes` quemado. Este
        // cruza la FUENTE: si alguien agrega un servicio al compose y no a la
        // whitelist, el admin no puede reiniciarlo y el panel miente por omisión.
        const compose = readFileSync(join(process.cwd(), "docker-compose.prod.yml"), "utf-8");
        const enCompose = new Set(
            [...compose.matchAll(/container_name:\s*(pi-[a-z-]+)/g)].map((m) => m[1]),
        );
        enCompose.delete("pi-db");
        enCompose.delete("pi-app");
        const whitelist = new Set(CONTENEDORES_PERMITIDOS);
        const faltan = [...enCompose].filter((c) => !whitelist.has(c as never)).sort();
        const sobran = [...whitelist].filter((c) => !enCompose.has(c)).sort();
        expect(faltan, "servicios en el compose que la whitelist no cubre").toEqual([]);
        expect(sobran, "servicios en la whitelist que no existen en el compose").toEqual([]);
    });
});
