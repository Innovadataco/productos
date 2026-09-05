/**
 * SPEC-432b · los artefactos de arquitectura dejan de ser terreno de conflicto.
 *
 * Misma clase que SPEC-432, un día después y con el choque ya en camino:
 * `02-roles-capacidades.md` y `03-pantallas.md` son tablas a las que **cada
 * ruta nueva** le agrega una fila, y SPEC-447 y SPEC-437 los tocan **las dos**.
 *
 * Acá `merge=union` no alcanzaba solo: `arch:check (a)` comparaba **byte a
 * byte**, así que una fusión correcta con las filas invertidas se habría puesto
 * roja. Se aflojó **solo el orden**.
 *
 * **Aflojar una verificación obliga a demostrar que sigue cazando.** Las tres
 * condiciones del CEO se prueban abajo, en este orden:
 *  1. Se tolera el ORDEN, nunca el contenido.
 *  2. La matriz completa: fila faltante · fila duplicada · texto fuera de la
 *     tabla · orden intercambiado.
 *  3. Un merge de git **de verdad**, con contraprueba sin `.gitattributes`.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { diferenciasTolerandoOrden } from "./lib/comparar-tolerando-orden";
import { ARTEFACTOS } from "./artefactos";

const RAIZ = path.resolve(__dirname, "..", "..");
const PANTALLAS = "docs/architecture/03-pantallas.md";
const ROLES = "docs/architecture/02-roles-capacidades.md";
const ATTRS = ".gitattributes";

const original = () => fs.readFileSync(path.join(RAIZ, PANTALLAS), "utf-8");

/**
 * Una fila de DATOS: dentro de un bloque y con otra fila justo encima, así que
 * nunca es el encabezado. El encabezado vive en su propio bloque —el separador
 * `| --- |` lo corta— y borrarlo cambia la ESTRUCTURA, no el contenido de una
 * tabla; eso se reporta distinto y a propósito.
 */
function filaDeDatos(texto: string): { i: number; linea: string } {
    const f = filas(texto);
    const encontrada = f.find((x, k) => k > 0 && f[k - 1]!.i === x.i - 1 && f[k + 1]?.i === x.i + 1);
    if (!encontrada) throw new Error("no se encontró una fila de datos en el artefacto");
    return encontrada;
}

/** Las líneas que son filas de tabla, con su índice, sobre el archivo real. */
function filas(texto: string): Array<{ i: number; linea: string }> {
    return texto
        .split("\n")
        .map((linea, i) => ({ i, linea }))
        .filter(({ linea }) => linea.trim().startsWith("|") && !/^\|[\s:-]+\|?[\s:|-]*$/.test(linea.trim()));
}

function conLineas(texto: string, cambio: (lineas: string[]) => string[]): string {
    return cambio(texto.split("\n")).join("\n");
}

// ── Condición 1 y 2: la matriz, sobre el artefacto REAL ────────────────────
describe("SPEC-432b · qué tolera y qué NO la comparación aflojada", () => {
    it("el archivo intacto no tiene diferencias", () => {
        expect(diferenciasTolerandoOrden(original(), original())).toEqual([]);
    });

    it("orden intercambiado dentro de la MISMA tabla → tolerado, a propósito", () => {
        const f = filas(original());
        // Dos filas contiguas: están garantizadamente en la misma tabla.
        const par = f.find((_, k) => k + 1 < f.length && f[k + 1]!.i === f[k]!.i + 1)!;
        const siguiente = f[f.indexOf(par) + 1]!;
        const alterado = conLineas(original(), (l) => {
            const copia = [...l];
            [copia[par.i], copia[siguiente.i]] = [copia[siguiente.i]!, copia[par.i]!];
            return copia;
        });

        expect(alterado).not.toBe(original());
        expect(
            diferenciasTolerandoOrden(alterado, original()),
            "Union puede dejar dos filas nuevas invertidas; eso NO es un defecto.",
        ).toEqual([]);
    });

    it("una fila que FALTA → rojo, nombrándola", () => {
        const objetivo = filaDeDatos(original());
        const alterado = conLineas(original(), (l) => l.filter((_, i) => i !== objetivo.i));

        const d = diferenciasTolerandoOrden(alterado, original());
        expect(d.length).toBeGreaterThan(0);
        expect(d.join("\n")).toContain(objetivo.linea.trim());
    });

    it("una fila DUPLICADA → rojo (es el único daño que union puede hacer)", () => {
        const objetivo = filaDeDatos(original());
        const alterado = conLineas(original(), (l) => {
            const copia = [...l];
            copia.splice(objetivo.i, 0, objetivo.linea);
            return copia;
        });

        const d = diferenciasTolerandoOrden(alterado, original());
        expect(d.some((x) => x.includes("DUPLICADA"))).toBe(true);
    });

    it("una fila INVENTADA que sobra → rojo", () => {
        const objetivo = filaDeDatos(original());
        const alterado = conLineas(original(), (l) => {
            const copia = [...l];
            copia.splice(objetivo.i, 0, "| `/ruta/que-nadie-creo` | PARENT | — |");
            return copia;
        });

        expect(diferenciasTolerandoOrden(alterado, original()).some((x) => x.includes("sobra"))).toBe(true);
    });

    it("texto FUERA de la tabla alterado → rojo", () => {
        const alterado = original().replace("# 03 · Pantallas por rol y transiciones", "# 03 · Otro título");

        expect(diferenciasTolerandoOrden(alterado, original())).toEqual([
            expect.stringContaining("fuera de las tablas"),
        ]);
    });

    it("una fila que SALTA de tabla → rojo (no es un reordenamiento, es contenido movido)", () => {
        const texto = original();
        const f = filas(texto);
        // Primera fila de un bloque y última de otro: separadas por texto que no es fila.
        const saltoDeBloque = f.findIndex((x, k) => k > 0 && x.i !== f[k - 1]!.i + 1);
        expect(saltoDeBloque, "el artefacto debe tener más de una tabla").toBeGreaterThan(0);
        const desde = f[0]!;
        const hasta = f[saltoDeBloque]!;
        const alterado = conLineas(texto, (l) => {
            const copia = [...l];
            [copia[desde.i], copia[hasta.i]] = [copia[hasta.i]!, copia[desde.i]!];
            return copia;
        });

        expect(
            diferenciasTolerandoOrden(alterado, texto).length,
            "Mover una fila a OTRA tabla es un cambio de contenido: no se tolera.",
        ).toBeGreaterThan(0);
    });

    it("borrar el ENCABEZADO de una tabla también es rojo — cambia la estructura", () => {
        const encabezado = filas(original())[0]!;
        const alterado = conLineas(original(), (l) => l.filter((_, i) => i !== encabezado.i));

        expect(diferenciasTolerandoOrden(alterado, original()).length).toBeGreaterThan(0);
    });

    it("solo los dos artefactos de tabla toleran orden; los demás siguen byte a byte", () => {
        const toleran = ARTEFACTOS.filter((a) => a.toleraOrdenDeFilas).map((a) => a.archivo).sort();
        expect(toleran).toEqual(["02-roles-capacidades.md", "03-pantallas.md"]);
    });
});

// ── Condición 3: merge de git de verdad ────────────────────────────────────
let sandbox: string;

function git(cwd: string, ...args: string[]): { ok: boolean; salida: string } {
    try {
        const salida = execFileSync("git", ["-c", "user.email=c@local", "-c", "user.name=C", ...args], {
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

/** Agrega la fila de una ruta nueva a la primera tabla, como hace el generador. */
function agregarRuta(texto: string, ruta: string): string {
    const f = filas(texto);
    const ultimaDelPrimerBloque = f.find((x, k) => k + 1 === f.length || f[k + 1]!.i !== x.i + 1)!;
    return conLineas(texto, (l) => {
        const copia = [...l];
        copia.splice(ultimaDelPrimerBloque.i + 1, 0, `| \`${ruta}\` | PARENT, PROFESIONAL | — |`);
        return copia;
    });
}

function escenario(conAtributos: boolean) {
    const repo = fs.mkdtempSync(path.join(sandbox, "arte-"));
    git(repo, "init", "-q", "--initial-branch=main", ".");

    const baseP = fs.readFileSync(path.join(RAIZ, PANTALLAS), "utf-8");
    const baseR = fs.readFileSync(path.join(RAIZ, ROLES), "utf-8");
    escribir(repo, PANTALLAS, baseP);
    escribir(repo, ROLES, baseR);
    if (conAtributos) escribir(repo, ATTRS, fs.readFileSync(path.join(RAIZ, ATTRS), "utf-8"));
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "base");

    for (const [rama, ruta] of [
        ["rama-a", "/dashboard/profesional/calendario"],
        ["rama-b", "/dashboard/profesional/citaciones"],
    ] as const) {
        git(repo, "checkout", "-q", "main");
        git(repo, "checkout", "-q", "-b", rama);
        escribir(repo, PANTALLAS, agregarRuta(baseP, ruta));
        escribir(repo, ROLES, agregarRuta(baseR, ruta));
        git(repo, "add", "-A");
        git(repo, "commit", "-q", "-m", ruta);
    }

    git(repo, "checkout", "-q", "rama-b");
    const merge = git(repo, "merge", "--no-edit", "rama-a");
    return {
        merge,
        pantallas: merge.ok ? fs.readFileSync(path.join(repo, PANTALLAS), "utf-8") : "",
        conflictos: git(repo, "diff", "--name-only", "--diff-filter=U").salida.trim(),
    };
}

describe("SPEC-432b · dos ramas que agregan una ruta cada una mergean solas", () => {
    beforeAll(() => {
        sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "spec432b-"));
    });

    afterAll(() => {
        fs.rmSync(sandbox, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    });

    it("el merge no se detiene y sobreviven LAS DOS rutas", () => {
        const r = escenario(true);

        expect(r.merge.ok, `El merge se detuvo:\n${r.merge.salida}`).toBe(true);
        expect(r.conflictos).toBe("");
        expect(r.pantallas).not.toContain("<<<<<<<");
        expect(r.pantallas).toContain("/dashboard/profesional/calendario");
        expect(r.pantallas).toContain("/dashboard/profesional/citaciones");
    });

    it("CONTRAPRUEBA · sin `.gitattributes` el mismo escenario SÍ choca", () => {
        const r = escenario(false);

        expect(
            r.merge.ok,
            "Si esto pasa sin `.gitattributes`, union no es lo que resuelve el choque " +
                "y el arreglo de SPEC-432b sería decorativo.",
        ).toBe(false);
        expect(r.conflictos).not.toBe("");
    });

    it("`.gitattributes` cubre los dos artefactos de tabla y NINGÚN otro", () => {
        const attrs = fs.readFileSync(path.join(RAIZ, ATTRS), "utf-8");
        expect(attrs).toMatch(/^docs\/architecture\/02-roles-capacidades\.md merge=union$/m);
        expect(attrs).toMatch(/^docs\/architecture\/03-pantallas\.md merge=union$/m);
        for (const otro of ["00-INDICE.md", "01-modelo-datos.md", "06-stack.md"]) {
            expect(
                attrs.includes(`docs/architecture/${otro} merge=union`),
                `${otro} no es una tabla de append por spec: su comparación sigue byte a byte.`,
            ).toBe(false);
        }
    });
});
