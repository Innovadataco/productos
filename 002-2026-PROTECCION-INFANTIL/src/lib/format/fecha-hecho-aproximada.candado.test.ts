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

// SPEC-644 RESUELTO — ya NO hay exentos. Los servicios de ANÁLISIS (hechos-caso,
// ejecutar-analisis) que antes se dejaban FUERA («franja falsa al modelo, espera 644»)
// ahora cargan la franja PERSISTIDA (`franjaHoraria`) y el agregado la usa en vez de
// re-derivarla del centro fabricado (cierra 626-p2). El (clase·servicio) los cubre como
// a cualquier otro: la SEÑAL DE FRANJA —horaAproximada O franjaHoraria— viaja con la fecha.

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
 *  (clase·servicio) todo servicio que ENTREGA la fecha del hecho (`fecha: X.fechaIncidente`)
 *                  carga la SEÑAL DE FRANJA —`horaAproximada` o la `franjaHoraria` persistida—
 *                  para que ninguna superficie NI el modelo inventen la hora. Con CONTROL
 *                  POSITIVO: el regex tiene que pegar en ≥1 archivo, o un rename de
 *                  `fechaIncidente` lo cegaría en silencio (forma de SPEC-619).
 *
 * SPEC-644 CERRÓ los dos límites que este candado confesaba: (1) los servicios de ANÁLISIS
 * ya NO están exentos — cargan `franjaHoraria` y el agregado la usa en vez de re-derivarla del
 * centro fabricado (cierra 626-p2); (2) el control positivo reemplaza la ceguera-por-rename del
 * literal. La (clase·display) allowlista lo legítimo, sin esa debilidad.
 *
 * Muere por mutación: `fechaHoraSinMinutos(x.fecha)` de un hecho → rojo (display); quitar la
 * señal de franja de un mapeo → rojo (servicio); mostrar la hora con el flag → rojo (helper);
 * la franja PERSISTIDA perdiendo contra la derivada → rojo (helper·SPEC-644). fs + puro → unit.
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

    it("(clase·servicio) todo `fecha: X.fechaIncidente` carga la señal de franja (horaAproximada o franjaHoraria)", () => {
        const RE = /fecha:\s*[A-Za-z_.?]*\.fechaIncidente/;
        // SPEC-644: la señal es la bandera O la franja persistida — cualquiera deja a la
        // superficie/al modelo honrar la franja sin inventar una hora.
        const SENAL = /horaAproximada|franjaHoraria/;
        const hits: string[] = [];
        let pegados = 0; // control positivo (forma de SPEC-619): el regex TIENE que pegar
        for (const { rel, src } of archivosFuente()) {
            const lineas = src.split("\n");
            lineas.forEach((linea, i) => {
                if (!RE.test(linea)) return;
                pegados++;
                // El literal que entrega la fecha del hecho debe cargar la señal a su lado
                // (ventana del mismo objeto).
                const ventana = lineas.slice(Math.max(0, i - 6), i + 7).join("\n");
                if (!SENAL.test(ventana)) {
                    hits.push(`${rel}:${i + 1}: ${linea.trim().slice(0, 80)}`);
                }
            });
        }
        // CONTROL POSITIVO: si alguien renombra `fechaIncidente`, RE deja de pegar y `hits`
        // queda vacío → VERDE FALSO. Exigir ≥1 match prueba que la sonda todavía ve el árbol.
        expect(
            pegados,
            "el regex `fecha: X.fechaIncidente` no pegó en NINGÚN archivo — ¿renombraron el campo? el candado quedó ciego",
        ).toBeGreaterThan(0);
        expect(
            hits,
            ["SPEC-644 — servicio entrega la fecha del hecho SIN señal de franja (horaAproximada/franjaHoraria):",
                ...hits, "",
                "Agregá `horaAproximada` y/o `franjaHoraria` al mismo objeto (y al select). El defecto I-385",
                "nació porque el servicio no entregaba la señal y la superficie no podía honrar la franja.",
                "SPEC-644: el análisis YA no está exento — carga franjaHoraria como el resto."].join("\n"),
        ).toEqual([]);
    });
});
