/**
 * SPEC-790 · El ADAPTADOR del REPS — la frontera entre el motor y el registro del Estado.
 *
 * Dos operaciones:
 *  · `consultarReps(identidad)` — una sola consulta (al dar de alta o al re-verificar un profesional puntual).
 *  · `ingestarDatasetReps()` — la ingesta EN BLOQUE del dataset del Estado, que alimenta al recorredor
 *    periódico (T5).
 *
 * La impl REAL (descarga del dataset del Estado, su URL y su formato) es integración externa cuyo
 * formato fija Estrategia; NO vive aquí todavía. Lo que vive aquí es (a) la INTERFAZ estable contra la
 * que construyen el gate (T4) y el worker (T5), y (b) un STUB NO configurado.
 *
 * REGLA DURA DEL STUB (D-2/D-7 · anti degradación silenciosa): el stub NUNCA fabrica un `VIGENTE`. Un
 * stub que devolviera «al día» abriría la compuerta para TODOS sin haber mirado el REPS — justo el falso
 * amigo que esta spec existe para cerrar. `consultarReps` degrada a `SIN_VERIFICAR` (el motor lo rige por
 * el cutover, no como «al día»); `ingestarDatasetReps` LEVANTA «no configurado» (un dataset vacío lo
 * tomaría el worker por «miré a todos y ninguno está vigente» — peor que fallar ruidoso).
 *
 * Declarado `hueco-funcional` (raíz del subárbol REPS sin cablear — incluye `reps-elegibilidad`, que hoy
 * solo lo importan este adaptador y los candados): se quita de la allowlist cuando el gate/worker lo
 * importen (salida autoexigida).
 */
import type { EstadoReps, ModalidadServicio } from "./reps-elegibilidad";

/** Con qué se consulta al REPS un profesional. Documento + registro; lo preciso lo fija el formato del Estado. */
export interface IdentidadProfesionalReps {
    readonly tipoDocumento: string;
    readonly numeroDocumento: string;
}

/**
 * El resultado CRUDO de consultar el REPS por un profesional — lo que el adaptador SABE, antes de derivar
 * elegibilidad. NO incluye `verificadoEn`: ese lo pone el servicio con el reloj de la corrida (el
 * adaptador no fija NUESTRO reloj). Mapea al HECHO que persiste Datos.
 */
export interface ResultadoConsultaReps {
    readonly resultado: EstadoReps;
    readonly vigenteHasta: Date | null;
    readonly modalidades: readonly ModalidadServicio[];
}

/** Una fila del dataset en bloque: a quién corresponde + su resultado crudo. */
export interface FilaDatasetReps {
    readonly identidad: IdentidadProfesionalReps;
    readonly resultado: ResultadoConsultaReps;
}

/** El adaptador del REPS. Interfaz estable; la impl real la define la integración externa + Estrategia (formato). */
export interface AdaptadorReps {
    consultarReps(identidad: IdentidadProfesionalReps): Promise<ResultadoConsultaReps>;
    ingestarDatasetReps(): Promise<readonly FilaDatasetReps[]>;
}

export class RepsNoConfiguradoError extends Error {
    constructor(detalle: string) {
        super(`Adaptador REPS no configurado: ${detalle}`);
        this.name = "RepsNoConfiguradoError";
    }
}

/**
 * STUB — el adaptador por defecto mientras no hay integración. NUNCA VIGENTE (candado
 * `reps-adaptador-nunca-vigente`).
 */
export const adaptadorRepsStub: AdaptadorReps = {
    async consultarReps(): Promise<ResultadoConsultaReps> {
        // Degrada a SIN_VERIFICAR (no VIGENTE): el motor lo trata por el cutover.
        return { resultado: "SIN_VERIFICAR", vigenteHasta: null, modalidades: [] };
    },
    async ingestarDatasetReps(): Promise<readonly FilaDatasetReps[]> {
        // No devolver [] (el worker lo tomaría por «miré a todos, ninguno vigente»). Fallar ruidoso.
        throw new RepsNoConfiguradoError("falta el dataset del Estado (URL + formato pendientes de Estrategia).");
    },
};
