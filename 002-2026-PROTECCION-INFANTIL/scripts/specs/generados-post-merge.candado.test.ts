/**
 * SPEC-487 (D-109) · el candado que DEMUESTRA que los generados salieron de la
 * cadena de conflictos.
 *
 * La idea de D-109: los PR **no tocan** los generados append-por-spec
 * (specs/README.md, docs/architecture/02-roles-capacidades.md, 03-pantallas.md);
 * el barrido post-merge los regenera. Si el PR no toca el archivo, no hay
 * superficie de conflicto — más fuerte que `merge=union`, que GitHub ni aplica
 * server-side.
 *
 * Estilo SPEC-432: no mira texto de config; monta git REAL y mergea de verdad.
 *  A. Dos ramas que agregan una spec cada una SIN tocar el índice → merge limpio.
 *     Contraprueba: el modelo VIEJO (cada rama edita el índice) SÍ choca sin union.
 *  B. Representabilidad: la fuente sana es representable; una carpeta a medio crear
 *     (sin spec.md) NO lo es → el gate del PR la caza sin comparar con lo commiteado.
 *  C. Determinismo: el generador es idempotente → el barrido auto-termina.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { verificarRepresentable, generarReadme } from "./generar-readme";

const RAIZ = path.resolve(__dirname, "..", "..");
const README = "specs/README.md";

let sandbox: string;

function git(cwd: string, ...args: string[]): { ok: boolean; salida: string } {
    try {
        const salida = execFileSync("git", ["-c", "user.email=candado@local", "-c", "user.name=Candado", ...args], {
            cwd,
            encoding: "utf-8",
            stdio: ["ignore", "pipe", "pipe"],
        });
        return { ok: true, salida };
    } catch (err) {
        const e = err as { stdout?: string; stderr?: string };
        return { ok: false, salida: `${e.stdout ?? ""}${e.stderr ?? ""}` };
    }
}

function escribir(base: string, rel: string, contenido: string) {
    const destino = path.join(base, rel);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, contenido);
}

/** Crea una spec REAL (carpeta + spec.md/plan/tasks), como haría un PR. */
function agregarSpec(base: string, numero: number) {
    const dir = `specs/${numero}-inventada`;
    escribir(base, `${dir}/spec.md`, `# SPEC-${numero} · Inventada\n\n**Status**: IMPLEMENTADO\n\n## Impacto en arquitectura:\n- ninguno.\n`);
    escribir(base, `${dir}/plan.md`, `# SPEC-${numero} · Plan\n`);
    escribir(base, `${dir}/tasks.md`, `# SPEC-${numero} · Tasks\n`);
}

/** Escenario D-109: las ramas agregan specs pero NO tocan el índice. */
function escenarioSinTocarIndice() {
    const repo = fs.mkdtempSync(path.join(sandbox, "d109-"));
    git(repo, "init", "-q", "--initial-branch=main", ".");
    escribir(repo, README, fs.readFileSync(path.join(RAIZ, README), "utf-8"));
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "base");

    for (const [rama, numero] of [["rama-a", 900], ["rama-b", 901]] as const) {
        git(repo, "checkout", "-q", "main");
        git(repo, "checkout", "-q", "-b", rama);
        agregarSpec(repo, numero); // NO toca specs/README.md
        git(repo, "add", "-A");
        git(repo, "commit", "-q", "-m", `spec ${numero}`);
    }
    git(repo, "checkout", "-q", "rama-b");
    const merge = git(repo, "merge", "--no-edit", "rama-a");
    return {
        merge,
        conflictos: git(repo, "diff", "--name-only", "--diff-filter=U").salida.trim(),
        ambasSpecs: fs.existsSync(path.join(repo, "specs/900-inventada/spec.md")) && fs.existsSync(path.join(repo, "specs/901-inventada/spec.md")),
    };
}

/** Contraprueba: modelo VIEJO — cada rama edita el índice; sin union, choca. */
function escenarioViejoEditandoIndice() {
    const repo = fs.mkdtempSync(path.join(sandbox, "viejo-"));
    git(repo, "init", "-q", "--initial-branch=main", ".");
    const base = fs.readFileSync(path.join(RAIZ, README), "utf-8");
    escribir(repo, README, base); // sin .gitattributes → sin union
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "base");

    const fin = "<!-- SPEC-413:END tabla -->";
    for (const [rama, numero] of [["rama-a", 900], ["rama-b", 901]] as const) {
        git(repo, "checkout", "-q", "main");
        git(repo, "checkout", "-q", "-b", rama);
        const fila = `| [${numero}](${numero}-inventada/spec.md) | SPEC-${numero} | 🟢 IMPLEMENTADO |\n`;
        escribir(repo, README, base.replace(fin, fila + fin));
        git(repo, "add", "-A");
        git(repo, "commit", "-q", "-m", `spec ${numero} (edita índice)`);
    }
    git(repo, "checkout", "-q", "rama-b");
    const merge = git(repo, "merge", "--no-edit", "rama-a");
    return { merge, conflictos: git(repo, "diff", "--name-only", "--diff-filter=U").salida.trim() };
}

describe("SPEC-487 · los PR no tocan los generados → sin superficie de conflicto", () => {
    beforeAll(() => {
        sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "spec487-"));
    });
    afterAll(() => {
        fs.rmSync(sandbox, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    });

    it("A · dos ramas agregan una spec cada una SIN tocar el índice → merge limpio", () => {
        const r = escenarioSinTocarIndice();
        expect(r.merge.ok, `El merge se detuvo:\n${r.merge.salida}`).toBe(true);
        expect(r.conflictos, "quedaron archivos en conflicto").toBe("");
        expect(r.ambasSpecs, "sobrevivieron las dos specs").toBe(true);
    });

    it("A-contraprueba · el modelo VIEJO (cada rama edita el índice) SÍ choca sin union", () => {
        const r = escenarioViejoEditandoIndice();
        expect(
            r.merge.ok,
            "Editar el índice por-PR debería chocar sin union. Si no choca, este candado no prueba " +
                "que NO-tocar el índice sea lo que elimina el conflicto.",
        ).toBe(false);
        expect(r.conflictos).toContain("specs/README.md");
    });
});

describe("SPEC-487 · el invariante del PR es representabilidad, no committed==regen", () => {
    it("B · la fuente real es representable (el índice lo regenera el barrido, no el PR)", () => {
        expect(verificarRepresentable(), verificarRepresentable().join("; ")).toEqual([]);
    });

    it("B · una carpeta de spec a medio crear (sin spec.md) NO es representable → la caza el gate", () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specs487b-"));
        try {
            fs.mkdirSync(path.join(tmp, "999-a-medio-crear"));
            escribir(tmp, "998-sana/spec.md", "# ok\n");
            const problemas = verificarRepresentable(tmp);
            expect(problemas.some((p) => p.includes("999-a-medio-crear"))).toBe(true);
            expect(problemas.some((p) => p.includes("998-sana"))).toBe(false);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        }
    });

    it("C · el generador es idempotente (determinista) → el barrido post-merge auto-termina", () => {
        expect(generarReadme()).toBe(generarReadme());
    });
});
