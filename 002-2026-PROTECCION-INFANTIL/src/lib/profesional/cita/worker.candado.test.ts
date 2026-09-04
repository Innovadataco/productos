/**
 * SPEC-427 (I-301) · candado: un barredor sin quien lo llame es código muerto.
 *
 * De dónde sale: SPEC-395 escribió `barrerAvisoVencimiento48h` y
 * `barrerPlazoPagoDelPadre`, los probó, los mergeó… y **nadie los llamaba**. Ni
 * un `boss.schedule`, ni un servicio en el compose. El reloj de 48 h del brief
 * §3 no corrió nunca en producción, y como los tests pasaban, no había forma de
 * enterarse. Es el patrón de degradación silenciosa: funciona lo suficiente para
 * no avisar.
 *
 * Este candado hace que la próxima vez avise. Si alguien agrega un quinto
 * barredor y no lo agenda, el build rompe acá y dice exactamente cuál falta.
 *
 * **Contraprueba incluida**: el candado detecta un barredor inventado que no
 * está en ningún worker. Sin eso, un candado que siempre pasa no prueba nada.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const RAIZ = process.cwd();

function leer(rel: string): string {
    return readFileSync(join(RAIZ, rel), "utf8");
}

/**
 * Quita comentarios (línea y bloque) del código. Sin esto, una llamada que en
 * realidad está COMENTADA —`// barrerAutocierre()`— contaría como llamador, y
 * el candado pasaría verde con el barredor de hecho muerto. Es justo la clase
 * de agujero que este candado existe para tapar.
 */
function sinComentarios(codigo: string): string {
    return codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/**
 * Descubre POR DISCO todo archivo de `src/lib/profesional/cita/` que exporte un
 * barredor, en vez de una lista fija de dos rutas. Un barredor nuevo en un
 * archivo nuevo entra al candado solo — no depende de que alguien se acuerde de
 * sumarlo acá.
 */
function modulosConBarredores(): string[] {
    const dir = "src/lib/profesional/cita";
    return readdirSync(join(RAIZ, dir))
        .filter((f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f))
        .map((f) => `${dir}/${f}`)
        .filter((rel) => /export\s+async\s+function\s+barrer/.test(leer(rel)));
}

/** Los `export async function barrer…` de un módulo. */
function barredoresDe(rel: string): string[] {
    const re = /export\s+async\s+function\s+(barrer[A-Za-z0-9_]*)\s*\(/g;
    return [...leer(rel).matchAll(re)].map((m) => m[1]);
}

/** El código de todos los workers .mjs, SIN comentarios. */
function codigoDeLosWorkers(): string {
    const dir = join(RAIZ, "scripts");
    return readdirSync(dir)
        .filter((f) => f.startsWith("worker-") && f.endsWith(".mjs"))
        .map((f) => sinComentarios(readFileSync(join(dir, f), "utf8")))
        .join("\n");
}

/** ¿Alguien LLAMA a esta función en los workers? Llamada real, no comentario. */
function tieneLlamador(nombre: string, codigo: string): boolean {
    return new RegExp(`\\b${nombre}\\s*\\(`).test(codigo);
}

describe("SPEC-427 · ningún barredor de la cita queda sin quien lo llame", () => {
    const workers = codigoDeLosWorkers();

    it("los cuatro barredores existen y están declarados donde se espera", () => {
        const todos = modulosConBarredores().flatMap(barredoresDe);
        expect(todos).toEqual(
            expect.arrayContaining([
                "barrerAvisoVencimiento48h",
                "barrerPlazoPagoDelPadre",
                "barrerRecordatoriosDeCita",
                "barrerAutocierre",
            ])
        );
        expect(todos.length).toBeGreaterThanOrEqual(4);
    });

    it("CADA barredor exportado tiene un llamador en algún scripts/worker-*.mjs", () => {
        const huerfanos = modulosConBarredores().flatMap(barredoresDe).filter(
            (n) => !tieneLlamador(n, workers)
        );
        expect(huerfanos).toEqual([]);
    });

    it("CONTRAPRUEBA · el candado detecta un barredor que nadie llama", () => {
        expect(tieneLlamador("barrerLoQueNadieAgendo", workers)).toBe(false);
    });

    it("CONTRAPRUEBA · una llamada COMENTADA no cuenta como llamador", () => {
        // Este es el agujero que se cerró en el fix (i): antes, un `//` con el
        // nombre y paréntesis engañaba al candado y lo dejaba verde con el
        // barredor de hecho muerto.
        const comentado = "// barrerAutocierre() — desactivado temporalmente\nconsole.log('nada');";
        expect(tieneLlamador("barrerAutocierre", sinComentarios(comentado))).toBe(false);
        // Y la llamada de verdad sí cuenta.
        const real = "await barrerAutocierre();";
        expect(tieneLlamador("barrerAutocierre", sinComentarios(real))).toBe(true);
    });

    it("el worker de citas agenda las dos colas y las trabaja", () => {
        const w = leer("scripts/worker-citas.mjs");
        // Agendar sin trabajar deja los jobs encolados para siempre; trabajar
        // sin agendar no dispara nunca. Hacen falta los dos.
        expect(w).toContain("boss.schedule");
        expect(w).toContain("boss.work");
        expect((w.match(/boss\.schedule\(/g) ?? []).length).toBe(2);
        expect((w.match(/boss\.work\(/g) ?? []).length).toBe(2);
    });

    it("el worker de citas llama a los CUATRO barredores, no solo los importa", () => {
        const w = leer("scripts/worker-citas.mjs");
        for (const n of [
            "barrerAvisoVencimiento48h",
            "barrerPlazoPagoDelPadre",
            "barrerRecordatoriosDeCita",
            "barrerAutocierre",
        ]) {
            expect(new RegExp(`\\b${n}\\(\\)`).test(w), `${n} importado pero no llamado`).toBe(true);
        }
    });

    it("el worker de citas está en el compose de producción y en el monitor", () => {
        expect(leer("docker-compose.prod.yml")).toContain("scripts/worker-citas.mjs");
        // La lista del monitor está quemada: un worker que no se agregue queda
        // sin vigilancia y su muerte no se nota.
        expect(leer("src/lib/monitoreo/probes.ts")).toContain('citas: "pi-citas"');
    });
});
