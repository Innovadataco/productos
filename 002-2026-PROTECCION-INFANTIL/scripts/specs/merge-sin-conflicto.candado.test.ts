/**
 * SPEC-432 · el candado que DEMUESTRA que dos ramas ya no chocan.
 *
 * Orden del CEO, textual: *«el candado tiene que demostrar que dos ramas que
 * agregan una spec cada una mergean sin tocarse a mano. Probalo con dos ramas
 * de verdad, no con un test que afirme el formato»*.
 *
 * Así que esto no mira el texto del `.gitattributes`: monta un repositorio git
 * **real** en un directorio temporal, con los archivos **reales** del proyecto,
 * abre dos ramas que agregan una spec cada una y **mergea de verdad**.
 *
 * Y trae contraprueba: el MISMO escenario **sin** `.gitattributes` tiene que
 * **chocar**. Sin eso, el test verde no probaría que union está haciendo algo
 * — probaría que tuvimos suerte con el diff.
 *
 * El 04-09-2026 estos dos archivos hicieron chocar cinco PRs en un día. Cada
 * choque costó un rebase más un CI completo de 20-35 minutos.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const RAIZ = path.resolve(__dirname, "..", "..");

const README = "specs/README.md";
const INCLUDES = "vitest.unit.includes.ts";
const ATTRS = ".gitattributes";

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

/** Escribe el archivo creando los directorios que falten. */
function escribir(base: string, rel: string, contenido: string) {
    const destino = path.join(base, rel);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, contenido);
}

/** Agrega la fila de una spec a la tabla del README, como hace el generador. */
function agregarFilaSpec(contenido: string, numero: number): string {
    const fin = "<!-- SPEC-413:END tabla -->";
    const fila = `| [${numero}](${numero}-inventada/spec.md) | SPEC-${numero} · Inventada para el candado | 🟢 IMPLEMENTADO |\n`;
    return contenido.replace(fin, fila + fin);
}

/** Agrega una entrada a la lista de unit, como hace cualquier spec con candado. */
function agregarEntradaUnit(contenido: string, numero: number): string {
    return contenido.replace(/\n\];\s*$/, `\n    "src/lib/inventada-${numero}.test.ts",\n];\n`);
}

/**
 * Monta el escenario completo y devuelve el resultado del merge.
 * `conAtributos` decide si el repo lleva `.gitattributes` — es la contraprueba.
 */
function escenarioDeDosRamas(conAtributos: boolean) {
    const repo = fs.mkdtempSync(path.join(sandbox, "repo-"));
    git(repo, "init", "-q", "--initial-branch=main", ".");

    // Los archivos REALES del proyecto, no maquetas.
    const readmeBase = fs.readFileSync(path.join(RAIZ, README), "utf-8");
    const includesBase = fs.readFileSync(path.join(RAIZ, INCLUDES), "utf-8");
    escribir(repo, README, readmeBase);
    escribir(repo, INCLUDES, includesBase);
    if (conAtributos) escribir(repo, ATTRS, fs.readFileSync(path.join(RAIZ, ATTRS), "utf-8"));
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "base");

    for (const [rama, numero] of [
        ["rama-a", 900],
        ["rama-b", 901],
    ] as const) {
        git(repo, "checkout", "-q", "main");
        git(repo, "checkout", "-q", "-b", rama);
        escribir(repo, README, agregarFilaSpec(readmeBase, numero));
        escribir(repo, INCLUDES, agregarEntradaUnit(includesBase, numero));
        git(repo, "add", "-A");
        git(repo, "commit", "-q", "-m", `spec ${numero}`);
    }

    git(repo, "checkout", "-q", "rama-b");
    const merge = git(repo, "merge", "--no-edit", "rama-a");
    const leer = (rel: string) => fs.readFileSync(path.join(repo, rel), "utf-8");
    return {
        merge,
        readme: merge.ok ? leer(README) : "",
        includes: merge.ok ? leer(INCLUDES) : "",
        conflictos: git(repo, "diff", "--name-only", "--diff-filter=U").salida.trim(),
    };
}

describe("SPEC-432 · dos ramas que agregan una spec cada una mergean solas", () => {
    beforeAll(() => {
        sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "spec432-"));
    });

    afterAll(() => {
        fs.rmSync(sandbox, { recursive: true, force: true });
    });

    it("el merge NO se detiene y no deja marcadores de conflicto", () => {
        const r = escenarioDeDosRamas(true);

        expect(
            r.merge.ok,
            `El merge se detuvo. Esto es exactamente lo que SPEC-432 vino a eliminar:\n${r.merge.salida}`,
        ).toBe(true);
        expect(r.conflictos, "quedaron archivos en conflicto").toBe("");
        for (const contenido of [r.readme, r.includes]) {
            expect(contenido).not.toContain("<<<<<<<");
            expect(contenido).not.toContain(">>>>>>>");
        }
    });

    it("y sobreviven LAS DOS specs — union no puede quedarse con una sola", () => {
        const r = escenarioDeDosRamas(true);

        expect(r.readme).toContain("SPEC-900");
        expect(r.readme).toContain("SPEC-901");
        expect(r.includes).toContain("inventada-900.test.ts");
        expect(r.includes).toContain("inventada-901.test.ts");
    });

    it("la lista de unit sigue siendo TypeScript válido: un solo cierre `];`", () => {
        const r = escenarioDeDosRamas(true);

        const cierres = (r.includes.match(/^\];$/gm) ?? []).length;
        expect(cierres, "union rompió la sintaxis del arreglo").toBe(1);
    });

    it("CONTRAPRUEBA · sin `.gitattributes` el mismo escenario SÍ choca", () => {
        const r = escenarioDeDosRamas(false);

        expect(
            r.merge.ok,
            "Sin `.gitattributes` el merge debería fallar. Si pasa igual, este candado " +
                "no está probando nada: significaría que union no es lo que resuelve el " +
                "choque y el arreglo de SPEC-432 sería decorativo.",
        ).toBe(false);
        expect(r.conflictos).not.toBe("");
    });
});

describe("SPEC-432 · los dos límites de union, vigilados", () => {
    it("`.gitattributes` cubre exactamente los dos archivos que chocan", () => {
        const attrs = fs.readFileSync(path.join(RAIZ, ATTRS), "utf-8");
        expect(attrs).toMatch(/^specs\/README\.md merge=union$/m);
        expect(attrs).toMatch(/^vitest\.unit\.includes\.ts merge=union$/m);
    });

    it("la lista de unit no tiene entradas duplicadas — el único daño que union puede hacer", () => {
        const contenido = fs.readFileSync(path.join(RAIZ, INCLUDES), "utf-8");
        const entradas = [...contenido.matchAll(/^\s*"([^"]+)",$/gm)].map((m) => m[1]);
        const duplicadas = entradas.filter((e, i) => entradas.indexOf(e) !== i);

        expect(
            [...new Set(duplicadas)],
            "Dos ramas agregaron la misma entrada y union se quedó con las dos. " +
                "No rompe la corrida, pero es basura que crece sola: borrá la repetida.",
        ).toEqual([]);
    });

    it("el resumen de contadores YA NO se commitea — es el bloque que no se puede mergear", () => {
        const readme = fs.readFileSync(path.join(RAIZ, README), "utf-8");
        expect(
            readme.includes("SPEC-413:BEGIN resumen"),
            "Los contadores volvieron al archivo. Dos ramas escriben el mismo total " +
                "sobre la misma base, git las funde sin conflicto y la cuenta queda " +
                "callada y falsa. Se piden con `--resumen`, no se commitean.",
        ).toBe(false);
        expect(readme).toContain("--resumen");
    });
});
