/**
 * CANDADO · SPEC-815 — ni el identificador reportado, ni un correo completo, ni el error CRUDO salen a
 * stdout, en NINGÚN nivel de log.
 *
 * El defecto: la protección de hoy era una COINCIDENCIA del nivel de log (el identificador reportado
 * estaba a un `LOG_LEVEL` de salir — el nivel se calcula UNA vez al cargar el módulo). Por eso:
 *
 *  (A) RUNTIME con `LOG_LEVEL=debug` (el nivel MÁS permisivo): un candado que pasara porque el nivel
 *      suprime la línea certificaría la coincidencia, no la seguridad. Afirma que el logger reemplaza un
 *      Error (arg o anidado) por `safeErrorMessage`, así que un correo/identificador EMBEBIDO en el error
 *      NO sale. Control de doble sentido: la PII SÍ está en el error y NO aparece; el `console.error`
 *      crudo SÍ la deja salir — es lo que el logger impide.
 *
 *  (B) ESTÁTICO (independiente del nivel por construcción — lee la FUENTE): ningún sitio de emisión de la
 *      superficie de PRODUCCIÓN (`src/lib`, `src/app/api`, worker) interpola:
 *        · un identificador reportado (`.identificador`), relato/textoOriginal, teléfono;
 *        · un correo sin `maskEmail`;
 *        · el ERROR CRUDO (`err.message` / `String(err)`) — debe ir por `safeErrorMessage` (Rule-2).
 *      El scanner extrae el CUERPO de cada llamada de emisión respetando strings y template literals
 *      (multi-línea y `)` dentro de un template no lo engañan). `${safeErrorMessage(err)}` queda VERDE;
 *      `${err.message}` / `${String(err)}` quedan ROJOS. Los scripts OPERATIVOS no entran: ahí el
 *      operador es el destinatario legítimo.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, relative } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url)); // …/src/lib
const RAIZ = resolve(AQUI, ".."); // …/src
const RAIZ_REPO = resolve(RAIZ, ".."); // …/002-2026-PROTECCION-INFANTIL

// ---------------------------------------------------------------------------
// (A) RUNTIME — el logger sanitiza errores, con LOG_LEVEL=debug (el más permisivo)
// ---------------------------------------------------------------------------
describe("SPEC-815 (A) · el logger sanitiza errores con LOG_LEVEL=debug (no certifica la coincidencia)", () => {
    const CORREO = "juan.perez@gmail.com";
    const IDENT = "3001234567";
    let logger: typeof import("./logger").logger;

    beforeAll(async () => {
        vi.stubEnv("LOG_LEVEL", "debug"); // nivel abierto: todo emite; nada se suprime por el nivel
        vi.resetModules();
        ({ logger } = await import("./logger"));
    });

    afterEach(() => vi.restoreAllMocks());

    function capturar(fn: () => void): string {
        const spies = [
            vi.spyOn(console, "error").mockImplementation(() => {}),
            vi.spyOn(console, "warn").mockImplementation(() => {}),
            vi.spyOn(console, "log").mockImplementation(() => {}),
        ];
        fn();
        const render = (a: unknown): string =>
            a instanceof Error ? (a.stack ?? a.message) : typeof a === "string" ? a : JSON.stringify(a);
        return spies
            .flatMap((s) => s.mock.calls)
            .map((args) => args.map(render).join(" "))
            .join("\n");
    }

    it("un Error con PII embebida pasado como arg → el logger emite el mensaje seguro, NO la PII", () => {
        const err = new Error(`falló el envío a ${CORREO} para el identificador ${IDENT}`);
        expect(err.message).toContain(CORREO); // la PII SÍ está en el error (aserción no vacía)
        expect(err.message).toContain(IDENT);
        const salida = capturar(() => logger.error("[X] fallo de envío", err));
        expect(salida, "el logger no puede emitir el correo embebido en el error").not.toContain(CORREO);
        expect(salida, "el logger no puede emitir el identificador embebido en el error").not.toContain(IDENT);
    });

    it("un Error ANIDADO en un objeto plano también se sanitiza", () => {
        const err = new Error(`destinatario ${CORREO}`);
        const salida = capturar(() => logger.error("[X] fallo", { reporteId: "cl_abc", causa: err }));
        expect(salida).not.toContain(CORREO);
        expect(salida).toContain("cl_abc"); // el id interno (no PII) sí se conserva
    });

    it("control positivo: el `console.error` CRUDO (sin el logger) SÍ dejaría salir la PII", () => {
        const err = new Error(`destinatario ${CORREO}`);
        const salida = capturar(() => console.error("[X] fallo", err));
        expect(salida, "sin la sanitización del logger, la PII del error sale").toContain(CORREO);
    });

    it("un Error con `causa` que lleva texto (p.ej. AnonimizacionTransporteError de #802/807) → el logger NO emite la causa", () => {
        // #802 loguea `logger.error("[CORRECCION] … (best-effort):", err)` con el err crudo, y
        // `AnonimizacionTransporteError` lleva `causa?: unknown` (el error subyacente). Si esa causa
        // embebiera el payload a Ollama, ese payload es el RELATO del menor. El logger debe soltar la causa.
        class TransporteErrorConCausa extends Error {
            constructor(
                message: string,
                readonly causa?: unknown,
            ) {
                super(message);
                this.name = "TransporteErrorConCausa";
            }
        }
        const relato = "RELATO-DEL-MENOR-SENSIBLE-xyz";
        const err = new TransporteErrorConCausa("falló el transporte de anonimización", new Error(`payload=${relato}`));
        expect(String((err.causa as Error).message)).toContain(relato); // la causa SÍ lleva el texto
        const salida = capturar(() => logger.error("[CORRECCION] Derivación de dataset en segundo plano falló (best-effort):", err));
        expect(salida, "la causa cruda del error no puede salir a stdout").not.toContain(relato);
    });
});

// ---------------------------------------------------------------------------
// Lexer: cuerpo (texto de argumentos) de cada llamada de emisión, respetando strings/templates
// ---------------------------------------------------------------------------
function finDeComilla(t: string, i: number, q: string): number {
    i++;
    while (i < t.length) {
        if (t[i] === "\\") { i += 2; continue; }
        if (t[i] === q) return i + 1;
        i++;
    }
    return i;
}
function finDeTemplate(t: string, i: number): number {
    i++; // backtick de apertura
    while (i < t.length) {
        const c = t[i];
        if (c === "\\") { i += 2; continue; }
        if (c === "`") return i + 1;
        if (c === "$" && t[i + 1] === "{") {
            i += 2;
            let llaves = 1;
            while (i < t.length && llaves > 0) {
                const d = t[i];
                if (d === "'" || d === '"') { i = finDeComilla(t, i, d); continue; }
                if (d === "`") { i = finDeTemplate(t, i); continue; }
                if (d === "{") llaves++;
                else if (d === "}") llaves--;
                i++;
            }
            continue;
        }
        i++;
    }
    return i;
}

/** Cuerpos (argumentos, posiblemente multi-línea) de cada `console.*`/`logger.*`. */
function cuerposDeEmision(t: string): string[] {
    const cuerpos: string[] = [];
    const inicio = /\b(?:console\.(?:log|error|warn)|logger\.(?:debug|info|warn|error))\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = inicio.exec(t)) !== null) {
        let i = m.index + m[0].length;
        const desde = i;
        let paren = 1;
        while (i < t.length && paren > 0) {
            const c = t[i];
            if (c === "'" || c === '"') { i = finDeComilla(t, i, c); continue; }
            if (c === "`") { i = finDeTemplate(t, i); continue; }
            if (c === "(") paren++;
            else if (c === ")") paren--;
            i++;
        }
        cuerpos.push(t.slice(desde, i - 1));
        inicio.lastIndex = i;
    }
    return cuerpos;
}

function interpolaciones(cuerpo: string): string[] {
    return [...cuerpo.matchAll(/\$\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g)].map((x) => x[1]);
}

// ---------------------------------------------------------------------------
// (B) ESTÁTICO — superficie de producción
// ---------------------------------------------------------------------------
const EXCLUIR = /\.test\.|\.candado\.|test-utils|test-setup|reporte-test-utils|__mocks__|\.d\.ts$/;

function recolectar(dirAbs: string, exts: RegExp, archivos: string[] = []): string[] {
    let entradas: string[];
    try { entradas = readdirSync(dirAbs); } catch { return archivos; }
    for (const nombre of entradas) {
        const p = join(dirAbs, nombre);
        if (statSync(p).isDirectory()) {
            if (nombre === "node_modules" || nombre.startsWith(".")) continue;
            recolectar(p, exts, archivos);
        } else if (exts.test(nombre) && !EXCLUIR.test(p)) {
            archivos.push(p);
        }
    }
    return archivos;
}

function archivosDeProduccion(): string[] {
    return recolectar(resolve(RAIZ, "lib"), /\.tsx?$/)
        .concat(recolectar(resolve(RAIZ, "app", "api"), /\.tsx?$/))
        .concat([
            resolve(RAIZ_REPO, "scripts", "worker-reportes.mjs"),
            resolve(RAIZ_REPO, "scripts", "worker-supervisor.mjs"),
        ]);
}

function escanear(check: (cuerpo: string) => boolean): string[] {
    const infracciones: string[] = [];
    for (const f of archivosDeProduccion()) {
        let texto: string;
        try { texto = readFileSync(f, "utf8"); } catch { continue; }
        for (const cuerpo of cuerposDeEmision(texto)) {
            if (check(cuerpo)) infracciones.push(`${relative(RAIZ_REPO, f)} → ${cuerpo.replace(/\s+/g, " ").trim().slice(0, 140)}`);
        }
    }
    return infracciones;
}

describe("SPEC-815 (B) · ningún sitio de emisión interpola PII ni el error crudo (producción)", () => {
    it("hay archivos de producción para escanear (el scanner no quedó ciego)", () => {
        expect(archivosDeProduccion().length).toBeGreaterThan(50);
    });

    it("Rule-1a · no interpola el identificador reportado (`.identificador`)", () => {
        const inf = escanear((c) => interpolaciones(c).some((e) => /\.identificador\b/.test(e)));
        expect(inf, `identificador reportado (PII) en un log:\n${inf.join("\n")}`).toEqual([]);
    });

    it("Rule-1b · no interpola un correo sin maskEmail", () => {
        const inf = escanear((c) => interpolaciones(c).some((e) => /\.(email|correo)\b/.test(e) && !/maskEmail\s*\(/.test(e)));
        expect(inf, `correo sin enmascarar en un log:\n${inf.join("\n")}`).toEqual([]);
    });

    it("Rule-1c · no interpola relato/textoOriginal/teléfono", () => {
        const inf = escanear((c) => interpolaciones(c).some((e) => /\.(relato|textoOriginal|telefono)\b/.test(e)));
        expect(inf, `relato/textoOriginal/teléfono en un log:\n${inf.join("\n")}`).toEqual([]);
    });

    it("Rule-2 · no interpola el error CRUDO (`err.message`/`String(err)`); debe ir por safeErrorMessage", () => {
        const inf = escanear((c) =>
            interpolaciones(c).some((e) => /\b(?:err|error|e)\.message\b/.test(e) || /\bString\s*\(\s*(?:err|error|e)\s*\)/.test(e)),
        );
        expect(inf, `error crudo interpolado (usá safeErrorMessage):\n${inf.join("\n")}`).toEqual([]);
    });
});
