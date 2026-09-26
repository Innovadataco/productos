/**
 * Mensaje al padre/madre/cuidador (spec 096-US7) y acompañamiento al reportante
 * anónimo (SPEC-736).
 * BORRADOR/textos por PLANTILLAS DETERMINISTAS ensambladas según las conductas
 * detectadas — PROHIBIDO generarlo con un LLM. Reglas duras:
 * (a) SIN score ni nivel de riesgo (constitución §1.3/§1.5);
 * (b) canales de ayuda desde el parámetro `mensaje.padre.canales`
 *     (editable sin desplegar, revisable por legal);
 * (c) se marca como borrador; no existe botón de enviar/publicar.
 *
 * SPEC-735 · Los textos de las plantillas ya NO están quemados: los builders son
 * PUROS (reciben las plantillas) y el CALLER las carga del parámetro
 * (`cargarPlantillasConducta` / `cargarReencuadreAnonimo`), con los defaults de
 * `plantillas-conducta-semilla.ts` como respaldo. Mismo patrón que
 * `cargarCanalesPadre`. Dos variantes por audiencia (Diseño, FORMA-SPEC736 §3):
 * padre-personalizada («tu hijo») y anónimo-genérica («la persona afectada»).
 */

import { getParametroSistema } from "@/lib/parametros";
import {
    CLAVE_GENERICA,
    PLANTILLAS_DEFECTO,
    REENCUADRE_ANONIMO_DEFECTO,
    type PlantillaConducta,
    type PlantillasConducta,
} from "./plantillas-conducta-semilla";

export type { PlantillaConducta, PlantillasConducta } from "./plantillas-conducta-semilla";
export { PLANTILLAS_DEFECTO, REENCUADRE_ANONIMO_DEFECTO } from "./plantillas-conducta-semilla";

/** Clave del parámetro con la variante PADRE (personalizada). */
export const CLAVE_PARAM_PLANTILLAS = "mensaje.padre.plantillas";
/** Clave del parámetro con la variante ANÓNIMO (solo las recomendaciones que cambian). */
export const CLAVE_PARAM_REENCUADRE_ANONIMO = "mensaje.anonimo.recomendaciones";

export interface CanalAyuda {
    nombre: string;
    contacto: string;
    descripcion: string;
}

export interface MensajePadreInput {
    /** Conductas detectadas (categorías presentes). Vacío si ninguna. */
    conductas: string[];
    canales: CanalAyuda[];
    /** Plantillas (variante PADRE). El caller las carga con `cargarPlantillasConducta`. */
    plantillas: PlantillasConducta;
}

/** Acompañamiento al reportante anónimo (SPEC-736): datos para pintar en /seguimiento. */
export interface AcompanamientoAnonimo {
    /** Hallazgos (hedgeados) para la línea puente; vacío si no hay conductas. */
    hallazgos: string[];
    /** Recomendaciones reencuadradas genéricas, deduplicadas por hallazgo. */
    acciones: string[];
}

/** Plantillas de las conductas dadas, deduplicadas por texto de hallazgo. */
function plantillasUnicas(conductas: string[], plantillas: PlantillasConducta): PlantillaConducta[] {
    const items = conductas.map((c) => plantillas.porConducta[c] ?? plantillas.generica);
    // Dedup por texto de hallazgo (varias conductas pueden mapear a la genérica).
    return items.filter((p, i) => items.findIndex((q) => q.hallazgo === p.hallazgo) === i);
}

/** Une los hallazgos en una lista en español: "a", "a y b", "a, b y c". */
function listarHallazgos(unicas: PlantillaConducta[]): string {
    const hallazgos = unicas.map((p) => p.hallazgo);
    return hallazgos.length === 1
        ? hallazgos[0]
        : `${hallazgos.slice(0, -1).join(", ")} y ${hallazgos[hallazgos.length - 1]}`;
}

export function construirMensajePadre(input: MensajePadreInput): string {
    const unicas = plantillasUnicas(input.conductas, input.plantillas);

    const lineas: string[] = [];
    lineas.push("[BORRADOR — mensaje de referencia para el acompañamiento a la familia. No se envía automáticamente.]");
    lineas.push("");
    lineas.push("Gracias por reportar esta situación. Tu reporte ayuda a proteger a niños, niñas y adolescentes.");

    if (unicas.length === 0) {
        lineas.push("Revisamos el caso y no encontramos conductas concretas que describir en este momento.");
    } else {
        lineas.push(`Revisamos el caso y encontramos ${listarHallazgos(unicas)}.`);
        lineas.push("");
        lineas.push("Te recomendamos:");
        for (const p of unicas) {
            lineas.push(`- ${p.recomendacion}`);
        }
    }

    if (input.canales.length > 0) {
        lineas.push("");
        lineas.push("Si necesitas ayuda adicional, estos canales oficiales están disponibles:");
        for (const canal of input.canales) {
            lineas.push(`- ${canal.nombre} (${canal.contacto}): ${canal.descripcion}`);
        }
    }

    lineas.push("");
    lineas.push("Este mensaje es un borrador orientativo: la revisión final del caso corresponde al equipo de validación.");

    return lineas.join("\n");
}

/**
 * Explicación para la VISTA del padre (spec 116): reutiliza las MISMAS
 * plantillas deterministas (D-23, nunca salida cruda del modelo), pero sin el
 * marco de "borrador" (eso es del expediente del admin) y sin canales dentro del
 * texto (en la vista los muestra <CanalesOficiales />). Recibe SOLO las conductas
 * confirmadas (las que superaron el umbral en el motor).
 * SPEC-736: la audiencia del padre se CONOCE → conserva la variante «tu hijo».
 */
export function construirExplicacionPadre(conductas: string[], plantillas: PlantillasConducta): string {
    const unicas = plantillasUnicas(conductas, plantillas);

    if (unicas.length === 0) {
        return "Revisamos el caso y no encontramos conductas concretas que describir en este momento.";
    }

    const lineas: string[] = [];
    lineas.push(`Revisamos el caso y encontramos ${listarHallazgos(unicas)}.`);
    lineas.push("");
    lineas.push("Te recomendamos:");
    for (const p of unicas) {
        lineas.push(`- ${p.recomendacion}`);
    }
    return lineas.join("\n");
}

/**
 * SPEC-736 · Acompañamiento al reportante ANÓNIMO. Mismo motor, pero la
 * `recomendacion` de las conductas reencuadradas se reemplaza por su variante
 * genérica («la persona afectada» en vez de «tu hijo»). El `hallazgo` es común.
 * Devuelve datos (hallazgos + acciones) para que la pantalla arme el texto; el
 * mensaje de calma y los canales son forma de la pantalla (Diseño §2/§4).
 */
export function construirAcompanamientoAnonimo(
    conductas: string[],
    plantillas: PlantillasConducta,
    reencuadre: Record<string, string>
): AcompanamientoAnonimo {
    const items = conductas.map((c) => {
        const especifica = plantillas.porConducta[c];
        const base = especifica ?? plantillas.generica;
        // La conducta específica se reencuadra por su clave; la que cae en la
        // genérica, por CLAVE_GENERICA. Sin override → queda la de la padre (ya neutral).
        const claveOverride = especifica ? c : CLAVE_GENERICA;
        const override = reencuadre[claveOverride];
        return override ? { ...base, recomendacion: override } : base;
    });
    const unicas = items.filter((p, i) => items.findIndex((q) => q.hallazgo === p.hallazgo) === i);
    return {
        hallazgos: unicas.map((p) => p.hallazgo),
        acciones: unicas.map((p) => p.recomendacion),
    };
}

/** Une los hallazgos para la línea puente del acompañamiento (misma prosa que listarHallazgos). */
export function listarHallazgosTexto(hallazgos: string[]): string {
    if (hallazgos.length === 0) return "";
    return hallazgos.length === 1
        ? hallazgos[0]
        : `${hallazgos.slice(0, -1).join(", ")} y ${hallazgos[hallazgos.length - 1]}`;
}

/**
 * Lee los canales del parámetro `mensaje.padre.canales` (editable sin desplegar).
 * Devuelve [] si el parámetro falta o es inválido (el mensaje sale sin canales).
 */
export async function cargarCanalesPadre(): Promise<CanalAyuda[]> {
    const param = await getParametroSistema("mensaje.padre.canales");
    if (!param) return [];
    try {
        const parsed: unknown = JSON.parse(param.valor);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (c): c is CanalAyuda =>
                typeof c === "object" && c !== null &&
                typeof (c as CanalAyuda).nombre === "string" &&
                typeof (c as CanalAyuda).contacto === "string" &&
                typeof (c as CanalAyuda).descripcion === "string"
        );
    } catch {
        return [];
    }
}

function esPlantilla(v: unknown): v is PlantillaConducta {
    return (
        typeof v === "object" && v !== null &&
        typeof (v as PlantillaConducta).hallazgo === "string" &&
        typeof (v as PlantillaConducta).recomendacion === "string"
    );
}

/**
 * SPEC-735 · Carga la variante PADRE de las plantillas del parámetro
 * `mensaje.padre.plantillas`. Ante ausencia o forma inválida devuelve
 * `PLANTILLAS_DEFECTO` (fail-safe: el texto nunca queda vacío).
 */
export async function cargarPlantillasConducta(): Promise<PlantillasConducta> {
    const param = await getParametroSistema(CLAVE_PARAM_PLANTILLAS);
    if (!param) return PLANTILLAS_DEFECTO;
    try {
        const parsed: unknown = JSON.parse(param.valor);
        if (typeof parsed !== "object" || parsed === null) return PLANTILLAS_DEFECTO;
        const obj = parsed as { generica?: unknown; porConducta?: unknown };
        if (!esPlantilla(obj.generica)) return PLANTILLAS_DEFECTO;
        if (typeof obj.porConducta !== "object" || obj.porConducta === null) return PLANTILLAS_DEFECTO;
        const porConducta: Record<string, PlantillaConducta> = {};
        for (const [clave, valor] of Object.entries(obj.porConducta as Record<string, unknown>)) {
            if (esPlantilla(valor)) porConducta[clave] = valor;
        }
        return { generica: obj.generica, porConducta };
    } catch {
        return PLANTILLAS_DEFECTO;
    }
}

/**
 * SPEC-735 · Carga la variante ANÓNIMO (solo las `recomendacion` que cambian) del
 * parámetro `mensaje.anonimo.recomendaciones`. Ante ausencia o forma inválida
 * devuelve `REENCUADRE_ANONIMO_DEFECTO`.
 */
export async function cargarReencuadreAnonimo(): Promise<Record<string, string>> {
    const param = await getParametroSistema(CLAVE_PARAM_REENCUADRE_ANONIMO);
    if (!param) return REENCUADRE_ANONIMO_DEFECTO;
    try {
        const parsed: unknown = JSON.parse(param.valor);
        if (typeof parsed !== "object" || parsed === null) return REENCUADRE_ANONIMO_DEFECTO;
        const out: Record<string, string> = {};
        for (const [clave, valor] of Object.entries(parsed as Record<string, unknown>)) {
            if (typeof valor === "string") out[clave] = valor;
        }
        return Object.keys(out).length > 0 ? out : REENCUADRE_ANONIMO_DEFECTO;
    } catch {
        return REENCUADRE_ANONIMO_DEFECTO;
    }
}
