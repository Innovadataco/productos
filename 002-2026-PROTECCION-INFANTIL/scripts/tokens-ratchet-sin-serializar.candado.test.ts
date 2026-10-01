/**
 * SPEC-466 · El candado que DEMUESTRA que el piso de `tokens:check` dejó de
 * serializar los merges.
 *
 * El problema (medido la noche del 04-09): 4 muebles del rediseño listos a la
 * vez, todos bajaban el mismo PISO y chocaban en esa línea de
 * `scripts/tokens-check.ts` — merge en serie + rebase + re-medición cada uno.
 * Es la clase de conflicto de SPEC-432, pero sobre un NÚMERO (union no sirve).
 *
 * El arreglo: el guard es `<=` (falla solo si SUBE), así un PR que baja crudos
 * NO toca la constante PISO — la aprieta el barrido `--tension`, no el PR. Sin
 * tocar la línea, dos muebles paralelos no colisionan.
 *
 * Dos capas, ambas por CONDUCTA:
 *  (1) merge git REAL en repo temporal (estilo SPEC-432): dos ramas que bajan
 *      crudos en archivos distintos, sin tocar tokens-check.ts, mergean limpio.
 *      Contraprueba: si CADA rama reescribe el PISO (modelo `==` viejo), chocan.
 *  (2) el guard real: verde en el estado actual; rojo si un crudo NUEVO sube el
 *      conteo (contraprueba de regresión).
 */
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const RAIZ = path.resolve(__dirname, "..");

function git(cwd: string, ...args: string[]): { ok: boolean; salida: string } {
    try {
        const salida = execFileSync(
            "git",
            ["-c", "user.email=candado@local", "-c", "user.name=Candado", ...args],
            { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
        );
        return { ok: true, salida };
    } catch (err) {
        const e = err as { stdout?: string; stderr?: string };
        return { ok: false, salida: `${e.stdout ?? ""}${e.stderr ?? ""}` };
    }
}

/**
 * Monta un repo con un `tokens-check.ts` minúsculo (solo la línea del PISO, que
 * es la que colisionaba) y dos componentes con color crudo. Devuelve la ruta.
 */
function montarRepo(): string {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "spec466-"));
    fs.mkdirSync(path.join(base, "scripts"));
    fs.mkdirSync(path.join(base, "src"));
    // La línea del PISO es lo único relevante para el conflicto.
    fs.writeFileSync(path.join(base, "scripts", "tokens-check.ts"), "const PISO = 100;\n");
    fs.writeFileSync(path.join(base, "src", "MuebleA.tsx"), 'export const A = "text-sky-500";\n');
    fs.writeFileSync(path.join(base, "src", "MuebleB.tsx"), 'export const B = "bg-emerald-600";\n');
    git(base, "init", "-q");
    git(base, "add", "-A");
    git(base, "commit", "-qm", "base");
    return base;
}

function enRama(base: string, rama: string, cambios: () => void) {
    git(base, "checkout", "-q", "-b", rama, "main");
    cambios();
    git(base, "add", "-A");
    git(base, "commit", "-qm", rama);
}

describe("SPEC-466 · el piso ya no serializa (merge real, estilo 432)", () => {
    let repo: string | null = null;
    afterEach(() => {
        if (repo) fs.rmSync(repo, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        repo = null;
    });

    it("dos muebles que bajan crudos SIN tocar el PISO mergean sin conflicto", () => {
        repo = montarRepo();
        git(repo, "branch", "-m", "main");
        // Rama A migra MuebleA a token (baja un crudo). NO toca tokens-check.ts.
        enRama(repo, "mueble-a", () => {
            fs.writeFileSync(path.join(repo!, "src", "MuebleA.tsx"), 'export const A = "text-cielo";\n');
        });
        // Rama B migra MuebleB. NO toca tokens-check.ts.
        enRama(repo, "mueble-b", () => {
            fs.writeFileSync(path.join(repo!, "src", "MuebleB.tsx"), 'export const B = "bg-pino";\n');
        });
        git(repo, "checkout", "-q", "mueble-a");
        const merge = git(repo, "merge", "--no-edit", "mueble-b");
        expect(merge.ok, `el merge debió ser limpio:\n${merge.salida}`).toBe(true);
        // La línea del PISO quedó intacta (nadie la tocó).
        expect(fs.readFileSync(path.join(repo, "scripts", "tokens-check.ts"), "utf-8")).toContain("const PISO = 100;");
    });

    it("CONTRAPRUEBA: si cada rama reescribe el PISO (modelo `==` viejo), chocan", () => {
        repo = montarRepo();
        git(repo, "branch", "-m", "main");
        enRama(repo, "aprieta-99", () => {
            fs.writeFileSync(path.join(repo!, "src", "MuebleA.tsx"), 'export const A = "text-cielo";\n');
            fs.writeFileSync(path.join(repo!, "scripts", "tokens-check.ts"), "const PISO = 99;\n");
        });
        enRama(repo, "aprieta-98", () => {
            fs.writeFileSync(path.join(repo!, "src", "MuebleB.tsx"), 'export const B = "bg-pino";\n');
            fs.writeFileSync(path.join(repo!, "scripts", "tokens-check.ts"), "const PISO = 98;\n");
        });
        git(repo, "checkout", "-q", "aprieta-99");
        const merge = git(repo, "merge", "--no-edit", "aprieta-98");
        expect(merge.ok, "tocar el PISO en ambas ramas DEBE chocar (por eso el guard es <=)").toBe(false);
        expect(merge.salida).toMatch(/CONFLICT|conflict/i);
    });
});

describe("SPEC-466 · el guard real (conducta)", () => {
    // SPEC-804: el fixture del caso rojo vive FUERA de `src/` (tmpdir del sistema). Antes plantaba
    // `src/__spec466_tmp__` y chocaba (TOCTOU) con los walkers que caminan `src/` en paralelo —
    // `ENOENT: scandir`, con la víctima rotando entre corridas. El guard lo escanea por
    // `TOKENS_CHECK_SRC` y mide contra un piso chico por `TOKENS_CHECK_PISO`; sin env, corre real.
    let tmp: string | null = null;
    afterEach(() => {
        if (tmp) fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        tmp = null;
    });

    function correrGuard(env?: Record<string, string>): { code: number; salida: string } {
        try {
            const salida = execFileSync("npx", ["tsx", "scripts/tokens-check.ts"], {
                cwd: RAIZ,
                encoding: "utf-8",
                stdio: ["ignore", "pipe", "pipe"],
                env: { ...process.env, ...env },
            });
            return { code: 0, salida };
        } catch (err) {
            const e = err as { status?: number; stdout?: string; stderr?: string };
            return { code: e.status ?? 1, salida: `${e.stdout ?? ""}${e.stderr ?? ""}` };
        }
    }

    function sembrarArbolTemporal(): string {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spec804-"));
        const srcTmp = path.join(tmp, "src");
        fs.mkdirSync(srcTmp, { recursive: true });
        // 3 ocurrencias de color crudo (text/bg/border) — FUERA de `src/` del repo.
        fs.writeFileSync(path.join(srcTmp, "Regresion.tsx"), 'export const X = "text-red-100 bg-red-200 border-red-300";\n');
        return srcTmp;
    }

    it("verde en el estado actual (el conteo real no sube del piso real)", () => {
        expect(correrGuard().code).toBe(0);
    });

    it("rojo si el conteo SUPERA el piso — contra un árbol TEMPORAL, sin tocar `src/` (SPEC-804)", () => {
        const srcTmp = sembrarArbolTemporal();
        const r = correrGuard({ TOKENS_CHECK_SRC: srcTmp, TOKENS_CHECK_PISO: "2" });
        expect(r.code, "3 crudos sobre un piso de 2 DEBE poner el guard en rojo").toBe(1);
        expect(r.salida).toMatch(/SUBIÓ/);
    });

    it("control positivo del override: el MISMO árbol con piso holgado pasa VERDE (el rojo no es falso)", () => {
        const srcTmp = sembrarArbolTemporal();
        expect(correrGuard({ TOKENS_CHECK_SRC: srcTmp, TOKENS_CHECK_PISO: "50" }).code).toBe(0);
    });
});
