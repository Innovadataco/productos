/**
 * SPEC-753 · El service del CRUCE de las encuestas de servicio.
 *
 * Cuando existen las DOS encuestas de una cita (PADRE + PROFESIONAL), compara las 5
 * preguntas que cruzan y, por cada contradicción, registra un IncidenteContradiccionEncuesta
 * con su reloj legal (el término y el ancla salen del mapa POR CLASE de `plazo-incidente.ts`).
 *
 * Reglas de detección (mismas que siembra el poblador — la referencia del equipo):
 *  - Si difieren en SE_REALIZO → UNA sola contradicción sobre SE_REALIZO; las demás
 *    preguntas quedan mudas (un lado describe un servicio que el otro dice que no ocurrió;
 *    esas diferencias son consecuencia, no contradicciones independientes).
 *  - Si ambos coinciden en que NO se realizó → NINGUNA contradicción (no hubo servicio del
 *    cual contradecir un detalle).
 *  - Si ambos coinciden en que SÍ se realizó → se cruzan los 4 detalles (operador, inicio,
 *    enlace, duración); una contradicción por pregunta divergente. `duracion` es no-nula acá
 *    (el CHECK duracion-IFF la garantiza cuando seRealizo=true), así que la comparación
 *    ignora nulos por si acaso.
 *
 * Idempotente: `@@unique([solicitudId, pregunta])` + upsert con update vacío → re-cruzar NO
 * duplica ni resetea el reloj de un incidente ya registrado. El ESTADO del incidente se
 * DERIVA con `estadoEfectivoIncidente`; este service no lo persiste.
 *
 * Sin cablear AÚN: lo llamará el endpoint de ENVÍO de encuesta (pieza posterior); hasta
 * entonces es hueco-funcional declarado.
 */
import { Prisma, type PrismaClient, type EncuestaCita, type PreguntaEncuesta } from "@prisma/client";
import { type ClaseContradiccion, claseDeContradiccion, reclamadoEnDeClase, venceEnIncidente } from "./plazo-incidente";

/**
 * Cliente inyectado (Prisma o de transacción). El service NO importa el singleton
 * (Q-3: acceso a Prisma solo por el cliente que pasa el llamador); el endpoint de envío
 * lo llama con su propia tx.
 */
type ClienteDB = PrismaClient | Prisma.TransactionClient;

/** Una de las 4 preguntas de detalle de servicio (Q2–Q5). */
type PreguntaServicio = "OPERADOR" | "INICIO" | "ENLACE" | "DURACION";

export interface Contradiccion {
    readonly pregunta: PreguntaEncuesta;
    readonly padreValor: string;
    readonly profesionalValor: string;
    readonly clase: ClaseContradiccion;
}

export interface ResultadoCruce {
    readonly contradicciones: readonly Contradiccion[];
}

export interface OpcionesCruce {
    /** Instante de DETECCIÓN inyectable (sin reloj de pared adentro). Default: ahora. */
    ahora?: Date;
}

/** Valor de una pregunta de servicio como string, o null si no aplica (duración sin sesión). */
function valorServicio(e: EncuestaCita, pregunta: PreguntaServicio): string | null {
    switch (pregunta) {
        case "OPERADOR":
            return e.operador;
        case "INICIO":
            return e.inicio;
        case "ENLACE":
            return e.enlace;
        case "DURACION":
            return e.duracion;
    }
}

/**
 * Compara las dos encuestas y devuelve las contradicciones (con su clase). Puro.
 * Por OBJETO, no dos `EncuestaCita` posicionales: invertir padre↔profesional COMPILARÍA e
 * invertiría la CLASE (RECLAMO_PADRE↔DICHA_PROFESIONAL) — el término legal caería sobre el
 * lado equivocado, en silencio. El objeto lo vuelve imposible.
 */
export function detectarContradicciones({ padre, profesional }: { padre: EncuestaCita; profesional: EncuestaCita }): Contradiccion[] {
    if (padre.seRealizo !== profesional.seRealizo) {
        // La no-prestación la afirma quien dijo que NO. La clase (y con ella el plazo legal/interno)
        // sale de la fuente única `claseDeContradiccion` — la misma que lee la bandeja del verificador.
        const padreValor = String(padre.seRealizo);
        const profesionalValor = String(profesional.seRealizo);
        return [{
            pregunta: "SE_REALIZO",
            padreValor,
            profesionalValor,
            clase: claseDeContradiccion("SE_REALIZO", padreValor, profesionalValor),
        }];
    }
    // Ambos coinciden en que NO se realizó → nada que contradecir en el detalle.
    if (padre.seRealizo === false) return [];
    // Ambos coinciden en que SÍ se realizó → cruzar los 4 detalles de servicio.
    const contradicciones: Contradiccion[] = [];
    for (const pregunta of ["OPERADOR", "INICIO", "ENLACE", "DURACION"] as const) {
        const padreValor = valorServicio(padre, pregunta);
        const profesionalValor = valorServicio(profesional, pregunta);
        if (padreValor !== null && profesionalValor !== null && padreValor !== profesionalValor) {
            contradicciones.push({ pregunta, padreValor, profesionalValor, clase: claseDeContradiccion(pregunta, padreValor, profesionalValor) });
        }
    }
    return contradicciones;
}

/**
 * Cruza las encuestas de una cita y registra los incidentes de contradicción. No-op si
 * falta alguno de los dos lados. Idempotente.
 */
export async function cruzarEncuestasCita(
    solicitudId: string,
    db: ClienteDB,
    opts: OpcionesCruce = {},
): Promise<ResultadoCruce> {
    const deteccion = opts.ahora ?? new Date();

    const encuestas = await db.encuestaCita.findMany({ where: { solicitudId } });
    const padre = encuestas.find((e) => e.origen === "PADRE");
    const profesional = encuestas.find((e) => e.origen === "PROFESIONAL");
    if (!padre || !profesional) return { contradicciones: [] };

    const contradicciones = detectarContradicciones({ padre, profesional });

    for (const c of contradicciones) {
        const reclamadoEn = reclamadoEnDeClase(c.clase, { padreRespondioEn: padre.respondidaEn, deteccion });
        const venceEn = venceEnIncidente(c.clase, reclamadoEn);
        await db.incidenteContradiccionEncuesta.upsert({
            where: { solicitudId_pregunta: { solicitudId, pregunta: c.pregunta } },
            create: {
                solicitudId,
                pregunta: c.pregunta,
                padreValor: c.padreValor,
                profesionalValor: c.profesionalValor,
                reclamadoEn,
                venceEn,
            },
            // Idempotente: un incidente ya registrado NO se reabre ni se le resetea el
            // reloj (no tocamos reclamadoEn/venceEn/resueltoEn en un re-cruce).
            update: {},
        });
    }

    return { contradicciones };
}
