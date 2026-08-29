/**
 * SPEC-302 (002-PI-208 · R-022 §1.3 punto b) · Ratchet — `no-unref-timer-nuevo`.
 *
 * Protege I-147 (worker de notificaciones atascado) SIN el error del grep
 * naif original ("todo setInterval/setTimeout debe tener .unref() en la
 * misma línea"): ese grep da 7 falsos positivos hoy — incluyendo
 * `worker-notificaciones.mjs:207`, que a propósito NO lleva `.unref()`
 * (es el fix real de I-147; ver el comentario en `timers-worker-manifest.json`).
 *
 * En vez de eso: manifiesto de todas las ocurrencias actuales de
 * `setInterval(`/`setTimeout(` en `scripts/worker-*.mjs`, cada una con su
 * justificación. El ratchet compara (archivo, texto de la línea) contra el
 * manifiesto — falla SOLO si aparece una ocurrencia NUEVA no declarada.
 * Editar el manifiesto es la forma correcta de aprobar un timer nuevo.
 *
 * Exit codes: 0 = verde, 1 = ocurrencias sin manifestar, 2 = error I/O.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface OcurrenciaTimer {
    archivo: string; // ruta relativa a la raíz del proyecto, con forward slashes
    linea: number;
    texto: string; // línea trimmeada
}

export interface ManifiestoEntrada {
    archivo: string;
    texto: string;
    motivo: string;
    justificacion: string;
}

export interface Manifiesto {
    ocurrencias: ManifiestoEntrada[];
}

const PATRON_TIMER = /\bset(?:Interval|Timeout)\(/;

export function buscarTimersEnWorkers(scriptsDir: string): OcurrenciaTimer[] {
    const ocurrencias: OcurrenciaTimer[] = [];
    let entradas: string[];
    try {
        entradas = readdirSync(scriptsDir);
    } catch {
        return ocurrencias;
    }
    for (const entry of entradas) {
        if (!/^worker-.*\.mjs$/.test(entry)) continue;
        const full = join(scriptsDir, entry);
        const texto = readFileSync(full, "utf8");
        const lineas = texto.split("\n");
        for (let i = 0; i < lineas.length; i++) {
            if (PATRON_TIMER.test(lineas[i])) {
                ocurrencias.push({
                    archivo: relative(process.cwd(), full).split(sep).join("/"),
                    linea: i + 1,
                    texto: lineas[i].trim(),
                });
            }
        }
    }
    return ocurrencias;
}

/** Devuelve las ocurrencias detectadas que NO están cubiertas por el manifiesto. */
export function buscarInfractores(ocurrencias: OcurrenciaTimer[], manifiesto: Manifiesto): OcurrenciaTimer[] {
    // Multiset (archivo|texto) → cuenta permitida, para tolerar líneas idénticas repetidas.
    const permitidos = new Map<string, number>();
    for (const entrada of manifiesto.ocurrencias) {
        const clave = `${entrada.archivo}|${entrada.texto}`;
        permitidos.set(clave, (permitidos.get(clave) ?? 0) + 1);
    }

    const infractores: OcurrenciaTimer[] = [];
    for (const oc of ocurrencias) {
        const clave = `${oc.archivo}|${oc.texto}`;
        const restante = permitidos.get(clave) ?? 0;
        if (restante > 0) {
            permitidos.set(clave, restante - 1);
        } else {
            infractores.push(oc);
        }
    }
    return infractores;
}

const esEntry =
    process.argv[1] !== undefined &&
    (process.argv[1].endsWith("no-unref-timer-nuevo.ts") || process.argv[1].endsWith("no-unref-timer-nuevo.js"));

if (esEntry) {
    try {
        const raizProyecto = join(import.meta.dirname, "..", "..");
        const manifiestoPath = join(import.meta.dirname, "timers-worker-manifest.json");
        const manifiesto = JSON.parse(readFileSync(manifiestoPath, "utf8")) as Manifiesto;
        const ocurrencias = buscarTimersEnWorkers(join(raizProyecto, "scripts"));
        const infractores = buscarInfractores(ocurrencias, manifiesto);

        if (infractores.length > 0) {
            for (const inf of infractores) {
                console.error(`[LINT no-unref-timer-nuevo] ${inf.archivo}:${inf.linea}  ${inf.texto}`);
            }
            console.error(
                `[LINT no-unref-timer-nuevo] FALLO — ${infractores.length} timer(s) nuevos sin manifestar en ` +
                    "scripts/lint/timers-worker-manifest.json. Si es legítimo, agregalo con su justificación " +
                    "(protege I-147: NO todo timer debe llevar .unref(), ver el comentario del manifiesto)."
            );
            process.exit(1);
        }
        console.log(`[LINT no-unref-timer-nuevo] OK — ${ocurrencias.length} timers, todos manifestados.`);
    } catch (error) {
        console.error(
            `[LINT no-unref-timer-nuevo] Error de infraestructura: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(2);
    }
}
