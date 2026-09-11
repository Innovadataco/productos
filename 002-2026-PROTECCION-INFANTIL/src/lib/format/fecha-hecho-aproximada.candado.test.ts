import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fechaHechoLegible, fechaHoraSinMinutos } from "./fecha";
import { ETIQUETA_FRANJA } from "@/lib/reportes/franja-aproximada";

const SRC = path.resolve(__dirname, "..", "..");
function archivosFuente(): { rel: string; src: string }[] {
    const out: { rel: string; src: string }[] = [];
    const stack = [SRC];
    while (stack.length) {
        const dir = stack.pop()!;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const ruta = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (e.name === "node_modules" || e.name === ".next") continue;
                stack.push(ruta);
            } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
                out.push({ rel: path.relative(SRC, ruta), src: fs.readFileSync(ruta, "utf-8") });
            }
        }
    }
    return out;
}

/** Campos-timestamp REALES: la hora ahí es legítima (cuándo pasó algo del
 *  sistema — último evento, acceso), NO la fecha del hecho. `fechaHoraSinMinutos`
 *  solo se permite sobre éstos; cualquier otro argumento (p. ej. `.fecha` de un
 *  hecho, que fue el defecto I-385) tiene que ir por `fechaHechoLegible`. */
const TIMESTAMPS_REALES = ["ultimoEventoEn", "cuando"];

/** EXENTOS del (clase·servicio), A PROPÓSITO: servicios de ANÁLISIS, NO de
 *  pantalla. Reusar `horaAproximada` en el análisis es UNSOUND (mete la franja
 *  del hecho como dato sin gate — nudo de 626-p2); el true-skip espera su PROPIA
 *  señal en SPEC-644. Se dejan NOMBRADOS con archivo para que Datos tome 644 con
 *  la lista hecha. El candado vigila PANTALLA, no afirma que el análisis esté sano. */
const EXENTOS_ANALISIS_644 = [
    "lib/caso/hechos-caso.ts", // fecha: r.fechaIncidente (hechos del caso → modelo)
    "lib/expediente/analisis/ejecutar-analisis.ts", // fecha del hecho para el jurado
];

/**
 * SPEC-626/653 · CANDADO de CONDUCTA: cuando la hora del hecho es APROXIMADA,
 * ninguna PANTALLA muestra una hora — el padre no la dio y fingirla en un caso
 * sobre un menor es peor que no tenerla (condición no-negociable del CEO).
 *
 * El candado NO es una lista de raíces (por ahí se coló I-385, la 5ª superficie):
 * barre el árbol por CONDUCTA, en dos mitades que confiesan su límite.
 *  (helper)        `fechaHechoLegible` oculta la hora con la bandera, la muestra sin ella.
 *  (clase·display) `fechaHoraSinMinutos` SOLO sobre timestamps reales allowlistados
 *                  (ultimoEventoEn, cuando). Cualquier otro argumento —incluida una
 *                  `.fecha` de hecho, aunque NO diga literalmente `fechaIncidente`,
 *                  que fue justo el hueco de I-385— es rojo.
 *  (clase·servicio) todo servicio que ENTREGA a PANTALLA un `fecha: X.fechaIncidente`
 *                  carga también `horaAproximada`, para que ninguna superficie pueda
 *                  inventarla. El defecto NACIÓ en un servicio sin la bandera.
 *
 * LÍMITE CONFESADO 1: (clase·servicio) vigila PANTALLA. Los servicios de ANÁLISIS
 * (EXENTOS_ANALISIS_644) quedan FUERA a propósito — esa es otra falla (franja
 * falsa al modelo) y necesita su propia señal en SPEC-644. El verde acá NO dice
 * que el análisis esté sano.
 *
 * LÍMITE CONFESADO 2 (hallazgo de Datos, forma de SPEC-619): (clase·servicio) se
 * apoya en el LITERAL `fechaIncidente` y NO tiene control positivo. La CIEGAN un
 * renombre del campo, un alias (`fecha: fi`) o el shorthand (`fecha,`): cero hits
 * se lee como VERDE con las pantallas sin vigilar. Caza el defecto de HOY (I-385,
 * mutación-verificado), no es a prueba de renombres. El control positivo —afirmar
 * que las pantallas del expediente SÍ pasan por el camino con la bandera— lo suma
 * Datos en SPEC-644, donde ya estará por los exentos de análisis. (clase·display)
 * NO comparte esta debilidad: allowlista lo legítimo y marca todo lo demás.
 *
 * Muere por mutación: `fechaHoraSinMinutos(x.fecha)` de un hecho → rojo (display);
 * quitar `horaAproximada` de un mapeo de pantalla → rojo (servicio); mostrar la
 * hora con el flag → rojo (helper). fs + helper puro → unit, sin base.
 */

describe("SPEC-626 (I-379) · la hora aproximada se lee como FRANJA, la exacta como hora", () => {
    // Centro de «mañana» en Bogotá = 9:00 a.m. = UTC 14:00. Con horaAproximada=true,
    // la hora guardada es siempre uno de los centros {3,9,15,21}.
    const ISO_MANANA = "2026-09-08T14:00:00.000Z";

    it("(helper·APROXIMADA) muestra la FRANJA, NUNCA la hora representativa (9)", () => {
        const aproximada = fechaHechoLegible(ISO_MANANA, true);
        // la franja, con su rango (de ETIQUETA_FRANJA) — no la hora de reloj.
        expect(aproximada).toContain(ETIQUETA_FRANJA.manana);
        // la hora representativa (9) JAMÁS como hora de reloj (I-379 aceptación #1).
        expect(aproximada).not.toMatch(/\b9\s*(a\.?\s*m\.?|:00)/i);
        expect(aproximada).toContain("2026");
    });

    it("(helper·SPEC-644) la franja PERSISTIDA gana sobre la derivada — cambiar un centro NO mueve una franja guardada", () => {
        // ISO_MANANA (centro 9) DERIVA a «mañana». Pero el padre DECLARÓ «noche»: la
        // lectura muestra lo GUARDADO, no la aritmética del centro. Éste es el candado del
        // radicado: el día que alguien mueva un centro representativo o agregue una 5ª
        // franja, la derivación empieza a mentir en silencio; la franja persistida no.
        // Muere si `fechaHechoLegible` vuelve a derivar ignorando el 3er argumento.
        const conPersistida = fechaHechoLegible(ISO_MANANA, true, "noche");
        expect(conPersistida).toContain(ETIQUETA_FRANJA.noche);
        expect(conPersistida).not.toContain(ETIQUETA_FRANJA.manana);
        // Fila LEGADA (sin franja guardada) → respaldo derivado del centro (mañana).
        const sinPersistida = fechaHechoLegible(ISO_MANANA, true, null);
        expect(sinPersistida).toContain(ETIQUETA_FRANJA.manana);
    });

    it("(helper·EXACTA) muestra la hora tal cual — con el flag en false Y sin flag", () => {
        // Ejercitar el flag en FALSE, no solo en true: si no, no sabríamos si
        // rompimos el caso donde la hora SÍ es real y debe verse (condición CEO).
        const exacta = fechaHechoLegible(ISO_MANANA, false);
        expect(exacta).toBe(fechaHoraSinMinutos(ISO_MANANA));
        expect(exacta).toMatch(/9\s*a\.?\s*m\.?/i); // la hora real SÍ aparece
        // sin bandera (undefined) = exacta — compatibilidad con llamadas viejas.
        expect(fechaHechoLegible(ISO_MANANA)).toBe(exacta);
    });

    it("(clase·display) `fechaHoraSinMinutos` SOLO sobre timestamps reales allowlistados", () => {
        const hits: string[] = [];
        for (const { rel, src } of archivosFuente()) {
            if (rel.endsWith("format/fecha.ts")) continue; // la definición del helper
            src.split("\n").forEach((linea, i) => {
                const re = /fechaHoraSinMinutos\(\s*([^)]*?)\s*\)/g;
                let m: RegExpExecArray | null;
                while ((m = re.exec(linea))) {
                    const arg = m[1];
                    // último segmento del acceso: `cadena.ultimoEventoEn` → ultimoEventoEn.
                    const campo = (arg.split(".").pop() ?? arg).replace(/[^A-Za-z0-9_].*$/, "");
                    if (!TIMESTAMPS_REALES.includes(campo)) {
                        hits.push(`${rel}:${i + 1}: fechaHoraSinMinutos(${arg})`);
                    }
                }
            });
        }
        expect(
            hits,
            ["SPEC-653 — `fechaHoraSinMinutos` sobre algo que NO es un timestamp real:",
                ...hits, "",
                "El helper crudo muestra la hora EXACTA. Solo vale sobre timestamps reales del",
                `sistema (${TIMESTAMPS_REALES.join(", ")}). La fecha de un HECHO (p. ej. \`.fecha\`)`,
                "va por `fechaHechoLegible(x, x.horaAproximada)`, que honra la franja. Si agregás",
                "un timestamp real nuevo, sumalo a TIMESTAMPS_REALES (parate a pensar por qué).",
                "NOTA: este candado vigila la aparición de hora cruda, no prueba que el árbol esté limpio."].join("\n"),
        ).toEqual([]);
    });

    it("(clase·servicio) todo `fecha: X.fechaIncidente` de PANTALLA carga `horaAproximada`", () => {
        const RE = /fecha:\s*[A-Za-z_.?]*\.fechaIncidente/;
        const hits: string[] = [];
        for (const { rel, src } of archivosFuente()) {
            if (EXENTOS_ANALISIS_644.includes(rel)) continue; // análisis: fuera a propósito (644)
            const lineas = src.split("\n");
            lineas.forEach((linea, i) => {
                if (!RE.test(linea)) return;
                // El literal que entrega la fecha del hecho debe cargar la bandera
                // a su lado (ventana del mismo objeto).
                const ventana = lineas.slice(Math.max(0, i - 6), i + 7).join("\n");
                if (!/horaAproximada/.test(ventana)) {
                    hits.push(`${rel}:${i + 1}: ${linea.trim().slice(0, 80)}`);
                }
            });
        }
        expect(
            hits,
            ["SPEC-653 — servicio de PANTALLA entrega la fecha del hecho SIN `horaAproximada`:",
                ...hits, "",
                "Agregá `horaAproximada: X.horaAproximada` al mismo objeto (y al select): el defecto",
                "I-385 nació porque el servicio no la entregaba y la pantalla no podía honrarla.",
                `FUERA a propósito (análisis, esperan SPEC-644): ${EXENTOS_ANALISIS_644.join(", ")}.`,
                "Este candado vigila PANTALLA; no afirma que el análisis esté sano."].join("\n"),
        ).toEqual([]);
    });
});
