/**
 * CANDADO · SPEC-980 — el deploy TOMA el candado común del VPS ANTES de cualquier build o pull, y no deja
 * que nada se trague el stdin del invocador.
 *
 * Defecto: `deploy-prod.sh` no tomaba `/var/lock/despliegue-vps.lock`, el lock común acordado con
 * Inversiones. Inversiones lo toma en sus deploys y en sus cargas de datos (minutos); un deploy de PI no
 * esperaba y ambos se pisaban sobre el mismo host. Invariantes verificados aquí:
 *  (1) ORDEN (scan estático del script): el `flock -w … 8` sobre el fd abierto por `exec 8>` ocurre ANTES
 *      de la primera línea de build (`$COMPOSE build`) y de la primera de pull (`git fetch`). Una regresión
 *      que mueva el candado debajo del build, o que lo borre, enrojece.
 *  (2) FALLA CERRADO: si no obtiene el lock, ABORTA con exit 3 y mensaje claro (no sigue sin candado).
 *  (3) STDIN NEUTRALIZADO: `exec </dev/null` antes del primer build → correrlo por `bash -s`/heredoc no
 *      pierde pasos (un comando interno no puede tragarse el stdin heredado).
 *  (4) PRUEBA VIVA (solo donde hay flock(1) — CI Linux / contenedor; se salta en macOS): con el lock tomado
 *      por otro proceso, el script ESPERA (-w) y aborta LIMPIO (exit 3) sin tocar docker.
 */
import { describe, it, expect } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT = path.join(process.cwd(), "scripts/deploy-prod.sh");
const SRC = readFileSync(SCRIPT, "utf8");
const LINEAS = SRC.split("\n");

const esComentario = (l: string) => l.trimStart().startsWith("#");
/** Índice de la primera línea NO comentada que casa el patrón, o -1. */
const idx = (re: RegExp) => LINEAS.findIndex((l) => !esComentario(l) && re.test(l));

function tieneFlock(): boolean {
    try {
        execFileSync("bash", ["-c", "command -v flock"], { stdio: "pipe" });
        return true;
    } catch {
        return false;
    }
}
const HAY_FLOCK = tieneFlock();

describe("SPEC-980 · deploy toma el candado común del VPS antes de todo", () => {
    it("el script parsea (bash -n)", () => {
        execFileSync("bash", ["-n", SCRIPT]);
    });

    // ---- 1. El candado se toma ANTES de cualquier build o pull --------------------------------------
    it("flock sobre el fd 8 ocurre ANTES del primer build y del primer pull (nunca después)", () => {
        const idxExec8 = idx(/^\s*exec\s+8>/);
        const idxLock = idx(/^\s*flock\s+-w\b/);
        const idxBuild = idx(/\$COMPOSE\s+build\b/);
        const idxPull = idx(/git\s+fetch\b/);

        expect(idxExec8, "falta `exec 8>` (apertura del fd del lock)").toBeGreaterThanOrEqual(0);
        expect(idxLock, "falta `flock -w` (toma del candado)").toBeGreaterThanOrEqual(0);
        expect(idxBuild, "no encontré `$COMPOSE build`").toBeGreaterThanOrEqual(0);
        expect(idxPull, "no encontré `git fetch` (pull)").toBeGreaterThanOrEqual(0);

        expect(idxLock, "el flock debe ir tras abrir el fd 8").toBeGreaterThan(idxExec8);
        expect(idxLock, "el candado debe tomarse ANTES del build").toBeLessThan(idxBuild);
        expect(idxLock, "el candado debe tomarse ANTES del pull").toBeLessThan(idxPull);
    });

    it("usa `-w` (espera acotada) sobre el fd 8, con la ruta y la espera por variable (defaults anclados)", () => {
        expect(SRC).toMatch(/flock -w "\$DESPLIEGUE_LOCK_WAIT" 8/); // espera N s, no -n (no bloqueante) ni infinito
        expect(SRC).toMatch(/DESPLIEGUE_LOCK:-\/var\/lock\/despliegue-vps\.lock/); // destino común acordado
        expect(SRC).toMatch(/DESPLIEGUE_LOCK_WAIT:-900/); // default 900 s
    });

    // ---- 2. Falla cerrado: sin lock → exit 3 -------------------------------------------------------
    it("si no obtiene el lock, ABORTA con exit 3 (no sigue sin candado)", () => {
        // El `exit 3` vive en la rama de fallo del flock, a pocas líneas del `flock -w`.
        expect(SRC).toMatch(/flock -w[\s\S]{0,240}?exit 3/);
        expect(SRC).toMatch(/candado común del VPS ocupado/);
    });

    // ---- 3. Nada consume el stdin del invocador ----------------------------------------------------
    it("neutraliza el stdin (`exec </dev/null`) ANTES del primer build y pull (bash -s/heredoc no pierde pasos)", () => {
        const idxStdin = idx(/^\s*exec\s+<\s*\/dev\/null\b/);
        const idxBuild = idx(/\$COMPOSE\s+build\b/);
        const idxPull = idx(/git\s+fetch\b/);
        expect(idxStdin, "falta `exec </dev/null` (blindaje de stdin)").toBeGreaterThanOrEqual(0);
        expect(idxStdin).toBeLessThan(idxBuild);
        expect(idxStdin).toBeLessThan(idxPull);
    });

    // ---- 4. Prueba VIVA: lock ocupado → espera y aborta limpio (solo con flock(1)) ------------------
    it.skipIf(!HAY_FLOCK)(
        "lock ocupado por otro proceso → ESPERA (-w) y ABORTA limpio (exit 3), sin tocar docker",
        async () => {
            const dir = mkdtempSync(path.join(tmpdir(), "spec980-"));
            const lock = path.join(dir, "despliegue-vps.lock");
            // Otro proceso toma el lock exclusivo y lo retiene 5 s; avisa "LOCKED" cuando ya lo tiene.
            const holder = spawn("flock", ["-x", lock, "-c", "echo LOCKED; sleep 5"], {
                stdio: ["ignore", "pipe", "ignore"],
            });
            try {
                await new Promise<void>((res, rej) => {
                    const to = setTimeout(() => rej(new Error("el holder no tomó el lock a tiempo")), 3000);
                    holder.stdout!.on("data", (b: Buffer) => {
                        if (String(b).includes("LOCKED")) {
                            clearTimeout(to);
                            res();
                        }
                    });
                });

                const t0 = Date.now();
                let code = 0;
                let err = "";
                try {
                    execFileSync("bash", [SCRIPT], {
                        encoding: "utf8",
                        stdio: "pipe",
                        env: { ...process.env, DESPLIEGUE_LOCK: lock, DESPLIEGUE_LOCK_WAIT: "1" },
                    });
                } catch (e: unknown) {
                    code = (e as { status?: number }).status ?? -1;
                    err = String((e as { stderr?: Buffer }).stderr ?? "");
                }
                const transcurrido = Date.now() - t0;

                expect(code, "debe abortar con exit 3 por candado ocupado").toBe(3);
                expect(err).toContain("candado común del VPS ocupado");
                expect(transcurrido, "debe ESPERAR ~1 s (respeta -w), no abortar de inmediato").toBeGreaterThanOrEqual(900);
            } finally {
                holder.kill("SIGKILL");
                rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
            }
        },
    );
});
