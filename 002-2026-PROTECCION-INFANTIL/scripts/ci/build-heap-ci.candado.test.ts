/**
 * CANDADO · SPEC-921 + SPEC-933 — todo job de CI que corre Node pesado tiene heap suficiente.
 *
 * El defecto: el runner de CI (Node 22.23.4) tiene un tope de heap por defecto de ~2079 MB.
 * SPEC-921 lo cazó en `next build` y fijó `NODE_OPTIONS=--max-old-space-size=4096` SOLO en ese
 * step; la misma deriva volvió a pegar en `verificaciones` → `npx tsc --noEmit` (FATAL heap OOM,
 * exit 134, PR #924): el type-check usa ~2.4 GB de heap sin tope. SPEC-933 lo sube al `env:` del
 * WORKFLOW para que todo job y step lo herede.
 *
 * Lo que este candado exige (y por qué son tres, no uno):
 *  (a) el `env:` del workflow fija `--max-old-space-size=N` con N ≥ 4096 — el valor por defecto;
 *  (b) NINGÚN `NODE_OPTIONS` en job o step lo debilita: en Actions un `NODE_OPTIONS` más interno
 *      REEMPLAZA al del workflow (no se suma), igual que una asignación de shell `NODE_OPTIONS=…`
 *      dentro de un `run:`. Toda asignación debe llevar el heap ≥ 4096;
 *  (c) cada step pesado CONOCIDO existe y su heap EFECTIVO (step > job > workflow) es ≥ 4096 —
 *      el ancla que impide que (a)+(b) pasen en verde si el archivo se reorganiza, y que nombra
 *      el step que quedaría expuesto. Conserva el invariante de SPEC-921 sobre `npm run build`.
 * Muere con el defecto por MUTACIÓN (controles positivos abajo, sobre el ci.yml REAL): quitar la
 * línea del workflow, bajarla a 2048, o pisarla en un step (sin heap o con 2048) → rojo.
 *
 * Unit puro (lee texto, sin BD) — en `vitest.unit.includes.ts`, carril `test:unit` que `pi-gate`
 * exige. No parsea YAML (mismo estilo de línea que `node-version-paridad`): el barrido es sobre el
 * texto, con la indentación del archivo (job a 2 espacios, step `- ` a 6, env de step a 8).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url)); // 002-…/scripts/ci
const REPO_ROOT = resolve(AQUI, "../../.."); // raíz del monorepo
const CI_YML = resolve(REPO_ROOT, ".github/workflows/ci.yml");

const HEAP_MINIMO_MB = 4096;

/** Steps pesados que el candado ancla, por CONTENIDO (algunos son `run: |` de varias líneas). */
export const STEPS_PESADOS: ReadonlyArray<{ job: string; patron: RegExp }> = [
    { job: "verificaciones · tsc", patron: /npx tsc --noEmit/ },
    { job: "test-unit", patron: /npm run test:unit/ },
    { job: "test-integration (shards)", patron: /vitest\.mjs run --shard/ },
    { job: "test-integration-coverage", patron: /npx vitest run --config vitest\.config\.ts --mergeReports/ },
    { job: "journeys", patron: /npm run test:journeys/ },
    { job: "build", patron: /npm run build\b/ },
    { job: "test-e2e", patron: /npm run test:e2e/ },
];

const indentDe = (l: string) => (l.match(/^(\s*)/)?.[1] ?? "").length;
const esComentario = (l: string) => l.trim().startsWith("#");

/** Líneas anidadas bajo `lineas[idx]` (indent mayor), incluida esa línea, hasta el dedent. */
function bloqueBajo(lineas: string[], idx: number): string[] {
    const base = indentDe(lineas[idx]!);
    const bloque = [lineas[idx]!];
    for (let i = idx + 1; i < lineas.length; i++) {
        const l = lineas[i]!;
        if (l.trim() === "") {
            bloque.push(l);
            continue;
        }
        if (indentDe(l) <= base) break;
        bloque.push(l);
    }
    return bloque;
}

/** El N de `--max-old-space-size=N` en una línea, o null si no lo fija. */
export function heapDeLinea(linea: string): number | null {
    const m = linea.match(/--max-old-space-size=(\d+)/);
    return m ? Number(m[1]) : null;
}

/** ¿La línea ASIGNA NODE_OPTIONS (clave YAML o asignación de shell)? Los comentarios no cuentan. */
function asignaNodeOptions(linea: string): boolean {
    if (esComentario(linea)) return false;
    return /^\s*NODE_OPTIONS:/.test(linea) || /(^|[\s;&|])(export\s+)?NODE_OPTIONS=/.test(linea);
}

/** (a) El heap del `env:` del WORKFLOW (columna 0), o null si no está o no fija el flag. */
export function heapDelWorkflow(texto: string): number | null {
    const lineas = texto.split("\n");
    const idx = lineas.findIndex((l) => /^env:\s*$/.test(l));
    if (idx === -1) return null;
    const asignacion = bloqueBajo(lineas, idx).find((l) => /^\s+NODE_OPTIONS:/.test(l));
    return asignacion ? heapDeLinea(asignacion) : null;
}

/** (b) Toda asignación de NODE_OPTIONS del archivo, con su línea (1-based) y su heap. */
export function asignacionesNodeOptions(texto: string): Array<{ linea: number; heap: number | null; texto: string }> {
    return texto
        .split("\n")
        .map((t, i) => ({ linea: i + 1, texto: t.trim(), heap: heapDeLinea(t), asigna: asignaNodeOptions(t) }))
        .filter((x) => x.asigna)
        .map(({ linea, heap, texto: t }) => ({ linea, heap, texto: t }));
}

/** Asignaciones que DEBILITAN el heap (sin el flag, o con menos del mínimo). */
export function overridesDebiles(texto: string): string[] {
    return asignacionesNodeOptions(texto)
        .filter((a) => a.heap === null || a.heap < HEAP_MINIMO_MB)
        .map((a) => `L${a.linea}: ${a.texto}`);
}

/**
 * (c) Heap EFECTIVO del primer step cuyo bloque contiene `patron`: el del step si lo asigna, si no
 * el `env:` del job (4 espacios), si no el del workflow. `undefined` si el step no existe.
 */
export function heapEfectivoDelStep(texto: string, patron: RegExp): { heap: number | null; desde: string } | undefined {
    const lineas = texto.split("\n");
    for (let i = 0; i < lineas.length; i++) {
        if (!/^ {6}-\s/.test(lineas[i]!)) continue; // item de `steps:`
        const step = bloqueBajo(lineas, i);
        if (!step.some((l) => !esComentario(l) && patron.test(l))) continue;

        const enStep = step.find(asignaNodeOptions);
        if (enStep) return { heap: heapDeLinea(enStep), desde: "step" };

        // el job que contiene al step: la última clave a 2 espacios antes del step.
        let j = i;
        while (j >= 0 && !/^ {2}[A-Za-z0-9_-]+:\s*$/.test(lineas[j]!)) j--;
        if (j >= 0) {
            const job = bloqueBajo(lineas, j);
            const iEnv = job.findIndex((l) => /^ {4}env:\s*$/.test(l));
            if (iEnv !== -1) {
                const enJob = bloqueBajo(job, iEnv).find(asignaNodeOptions);
                if (enJob) return { heap: heapDeLinea(enJob), desde: "job" };
            }
        }
        return { heap: heapDelWorkflow(texto), desde: "workflow" };
    }
    return undefined;
}

/** Violaciones de (a)+(b)+(c) sobre un texto de ci.yml. Vacío = el heap está cubierto. */
export function violacionesHeap(texto: string): string[] {
    const v: string[] = [];
    const wf = heapDelWorkflow(texto);
    if (wf === null || wf < HEAP_MINIMO_MB) v.push(`(a) env del workflow: heap=${wf ?? "ausente"} (< ${HEAP_MINIMO_MB})`);
    for (const o of overridesDebiles(texto)) v.push(`(b) override que debilita el heap · ${o}`);
    for (const s of STEPS_PESADOS) {
        const ef = heapEfectivoDelStep(texto, s.patron);
        if (ef === undefined) v.push(`(c) step pesado NO encontrado: ${s.job} (${s.patron})`);
        else if (ef.heap === null || ef.heap < HEAP_MINIMO_MB) v.push(`(c) ${s.job}: heap efectivo=${ef.heap ?? "ausente"} (desde ${ef.desde})`);
    }
    return v;
}

describe("SPEC-921 + SPEC-933 · todo job pesado de CI tiene heap ≥ 4096 (anti-OOM)", () => {
    const ci = readFileSync(CI_YML, "utf8");

    it(`(a) el env del workflow fija NODE_OPTIONS=--max-old-space-size ≥ ${HEAP_MINIMO_MB}`, () => {
        const heap = heapDelWorkflow(ci);
        expect(heap, "ci.yml no fija NODE_OPTIONS con --max-old-space-size en el `env:` del workflow").not.toBeNull();
        expect(heap!).toBeGreaterThanOrEqual(HEAP_MINIMO_MB);
    });

    it("(b) ningún NODE_OPTIONS de job/step lo debilita (en Actions el más interno REEMPLAZA)", () => {
        expect(overridesDebiles(ci), "un NODE_OPTIONS sin el flag o con menos de 4096 pisa el del workflow").toEqual([]);
    });

    it(`(c) cada step pesado existe y su heap EFECTIVO es ≥ ${HEAP_MINIMO_MB} (incluye el build de SPEC-921)`, () => {
        for (const s of STEPS_PESADOS) {
            const ef = heapEfectivoDelStep(ci, s.patron);
            expect(ef, `no encontré el step pesado ${s.job} en ci.yml`).toBeDefined();
            expect(ef!.heap, `${s.job}: sin heap efectivo (desde ${ef!.desde})`).not.toBeNull();
            expect(ef!.heap!, `${s.job}: heap efectivo bajo (desde ${ef!.desde})`).toBeGreaterThanOrEqual(HEAP_MINIMO_MB);
        }
        expect(violacionesHeap(ci)).toEqual([]);
    });

    // ── Controles positivos: mutaciones del ci.yml REAL → el candado TIENE que dar rojo ──
    const LINEA_WF = "  NODE_OPTIONS: --max-old-space-size=4096";

    it("control positivo · QUITAR la línea del workflow → rojo (a) y los steps pesados sin heap (c)", () => {
        expect(ci.includes(`\n${LINEA_WF}\n`), "la línea del workflow no está como se espera").toBe(true);
        const mutado = ci.replace(`\n${LINEA_WF}\n`, "\n");
        expect(heapDelWorkflow(mutado)).toBeNull();
        const v = violacionesHeap(mutado);
        expect(v.some((x) => x.startsWith("(a)"))).toBe(true);
        expect(v.some((x) => x.startsWith("(c) verificaciones · tsc"))).toBe(true);
    });

    it("control positivo · BAJAR el workflow a 2048 → rojo (a) y (b)", () => {
        const mutado = ci.replace(`\n${LINEA_WF}\n`, "\n  NODE_OPTIONS: --max-old-space-size=2048\n");
        expect(heapDelWorkflow(mutado)).toBe(2048);
        const v = violacionesHeap(mutado);
        expect(v.some((x) => x.startsWith("(a)"))).toBe(true);
        expect(v.some((x) => x.startsWith("(b)"))).toBe(true);
    });

    it("control positivo · un STEP lo pisa SIN heap (otro flag) → rojo (b) y (c) para ese step", () => {
        const mutado = ci.replace(/^( {6}- run: npx tsc --noEmit)$/m, "$1\n        env:\n          NODE_OPTIONS: --enable-source-maps");
        expect(mutado).not.toBe(ci);
        expect(heapEfectivoDelStep(mutado, /npx tsc --noEmit/)).toEqual({ heap: null, desde: "step" });
        const v = violacionesHeap(mutado);
        expect(v.some((x) => x.startsWith("(b)"))).toBe(true);
        expect(v.some((x) => x.startsWith("(c) verificaciones · tsc"))).toBe(true);
    });

    it("control positivo · una asignación de SHELL en el run lo baja a 2048 → rojo (b) y (c)", () => {
        const mutado = ci.replace(/^( {6}- run: )(npx tsc --noEmit)$/m, "$1NODE_OPTIONS=--max-old-space-size=2048 $2");
        expect(mutado).not.toBe(ci);
        expect(heapEfectivoDelStep(mutado, /npx tsc --noEmit/)).toEqual({ heap: 2048, desde: "step" });
        const v = violacionesHeap(mutado);
        expect(v.some((x) => x.startsWith("(b)"))).toBe(true);
        expect(v.some((x) => x.startsWith("(c) verificaciones · tsc"))).toBe(true);
    });

    it("los comentarios que NOMBRAN NODE_OPTIONS no cuentan como asignación", () => {
        expect(asignacionesNodeOptions("# un NODE_OPTIONS en un step REEMPLAZA\n  # NODE_OPTIONS=--x\n")).toEqual([]);
    });
});
