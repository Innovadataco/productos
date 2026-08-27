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

let mockRunner: ReturnType<typeof vi.fn>;

beforeEach(() => {
    mockRunner = vi.fn(async () => ({ stdout: "", stderr: "" }));
    setDockerRunner(mockRunner as unknown as DockerRunner);
});

afterEach(() => {
    setDockerRunner(null);
});

describe("docker-adapter · whitelist", () => {
    it("acepta las 3 combinaciones canónicas del brief", async () => {
        await ejecutarAccionDocker("restart", "pi-analisis-score");
        await ejecutarAccionDocker("stop", "pi-monitor");
        await ejecutarAccionDocker("start", "pi-worker");
        expect(mockRunner).toHaveBeenCalledTimes(3);
        expect(mockRunner.mock.calls[0][0]).toBe("docker");
        expect(mockRunner.mock.calls[0][1]).toEqual(["restart", "pi-analisis-score"]);
    });

    it("acepta las 30 combinaciones de whitelist (3 cmds × 10 contenedores)", async () => {
        for (const cmd of COMANDOS_SERVICIO) {
            for (const cont of CONTENEDORES_PERMITIDOS) {
                await ejecutarAccionDocker(cmd, cont);
            }
        }
        expect(mockRunner).toHaveBeenCalledTimes(30);
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

    it("errores son AppError con statusCode 400 y code VALIDATION_ERROR", async () => {
        try {
            await ejecutarAccionDocker("hack", "pi-worker");
            expect.fail("debió lanzar");
        } catch (err) {
            expect(err).toBeInstanceOf(AppError);
            expect((err as AppError).statusCode).toBe(400);
            expect((err as AppError).code).toBe("VALIDATION_ERROR");
        }
    });
});
