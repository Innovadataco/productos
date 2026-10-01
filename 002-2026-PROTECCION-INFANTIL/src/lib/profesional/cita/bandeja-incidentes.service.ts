/**
 * SPEC-787 · La bandeja del verificador para los incidentes de «reportes que no coinciden»
 * (SPEC-753). CABLEA `estado-efectivo-incidente.ts` (deja de ser hueco-funcional).
 *
 * Principios (FORMA-SPEC753-INCIDENTE-VERIFICADOR + radicado):
 *  - `esIncumplimiento` es FUENTE ÚNICA: el resumen (conteo) y el detalle (por incidente) la leen
 *    IGUAL — no puede haber un resumen «al día» sobre un detalle «vencido».
 *  - Orden por el VENCIMIENTO real (`venceEn`), no por creación (lo garantiza el repo).
 *  - SIMÉTRICO: los dos lados (padre/profesional) salen con el MISMO shape; ninguna versión es «la
 *    verdadera». El reloj legal/interno dice de dónde sale el PLAZO (quién afirmó la no-prestación),
 *    NO quién tiene razón — no adjudica.
 *  - Cero contenido de sesión: las encuestas son mecánicas (enums/bool); no hay texto libre.
 *  - Superficie 100% interna (verificador). Este DTO no se expone a padre ni profesional.
 */
import { estadoEfectivoIncidente, esIncumplimiento, type EstadoIncidenteContradiccion } from "./estado-efectivo-incidente";
import { claseDeContradiccion, claseTieneTerminoLegal } from "./plazo-incidente";
import { diasHabilesTranscurridosColombia } from "@/lib/fechas/dias-habiles-colombia";
import { IncidenteContradiccionRepository } from "@/lib/dal/repositories/incidente-contradiccion";

export interface LadoRespuestaDto {
    rol: "PADRE" | "PROFESIONAL";
    seRealizo: boolean;
    operador: string;
    inicio: string;
    enlace: string;
    duracion: string | null;
    respondidaEn: string;
}

export interface IncidenteBandejaDto {
    id: string;
    solicitudId: string;
    estado: EstadoIncidenteContradiccion;
    /** Fuente ÚNICA: `esIncumplimiento(estado)`. La leen igual el resumen y el detalle. */
    incumplida: boolean;
    /** El plazo es LEGAL (padre afirmó la no-prestación) o INTERNO. Dice qué está en juego, NO quién tiene razón. */
    relojLegal: boolean;
    venceEn: string;
    /** Hábiles restantes hasta el vencimiento (negativo si ya venció). */
    quedanDiasHabiles: number;
    preguntaDivergente: string;
    padreValor: string;
    profesionalValor: string;
    /** Los dos lados, MISMO shape, simétricos. El render los muestra idénticos. */
    lados: [LadoRespuestaDto, LadoRespuestaDto];
}

export interface BandejaIncidentesDto {
    incidentes: IncidenteBandejaDto[];
    /** Resumen desde la MISMA fuente (`incumplida` por incidente): sin doble verdad. */
    resumen: { total: number; incumplidos: number };
}

type FilaEncuesta = {
    origen: "PADRE" | "PROFESIONAL";
    seRealizo: boolean;
    operador: string;
    inicio: string;
    enlace: string;
    duracion: string | null;
    respondidaEn: Date;
};

function ladoDe(encuestas: FilaEncuesta[], rol: "PADRE" | "PROFESIONAL"): LadoRespuestaDto {
    const e = encuestas.find((x) => x.origen === rol);
    return {
        rol,
        seRealizo: e?.seRealizo ?? false,
        operador: e?.operador ?? "",
        inicio: e?.inicio ?? "",
        enlace: e?.enlace ?? "",
        duracion: e?.duracion ?? null,
        respondidaEn: (e?.respondidaEn ?? new Date(0)).toISOString(),
    };
}

type FilaIncidente = {
    id: string;
    solicitudId: string;
    pregunta: string;
    padreValor: string;
    profesionalValor: string;
    venceEn: Date;
    resueltoEn: Date | null;
    solicitud: { encuestasSesion: FilaEncuesta[] };
};

export function aIncidenteDto(fila: FilaIncidente, now: Date): IncidenteBandejaDto {
    const estado = estadoEfectivoIncidente(fila.resueltoEn, fila.venceEn, now);
    const clase = claseDeContradiccion(fila.pregunta, fila.padreValor, fila.profesionalValor);
    return {
        id: fila.id,
        solicitudId: fila.solicitudId,
        estado,
        incumplida: esIncumplimiento(estado), // FUENTE ÚNICA
        relojLegal: claseTieneTerminoLegal(clase),
        venceEn: fila.venceEn.toISOString(),
        // Hábiles que faltan para vencer (0 si ya venció — ahí el estado, no «quedan», es lo que se muestra).
        quedanDiasHabiles: diasHabilesTranscurridosColombia(now, fila.venceEn),
        preguntaDivergente: fila.pregunta,
        padreValor: fila.padreValor,
        profesionalValor: fila.profesionalValor,
        lados: [ladoDe(fila.solicitud.encuestasSesion, "PADRE"), ladoDe(fila.solicitud.encuestasSesion, "PROFESIONAL")],
    };
}

/** La bandeja: incidentes abiertos (ordenados por vencimiento real) + resumen de la MISMA fuente. */
export async function listarBandejaIncidentes(now: Date = new Date()): Promise<BandejaIncidentesDto> {
    const filas = await new IncidenteContradiccionRepository().listarAbiertos();
    const incidentes = filas.map((f) => aIncidenteDto(f as FilaIncidente, now));
    return {
        incidentes,
        resumen: { total: incidentes.length, incumplidos: incidentes.filter((i) => i.incumplida).length },
    };
}

/** El verificador registra el desenlace. El estado (RESUELTO vs RESUELTO_TARDE) lo DERIVA el reloj. */
export async function resolverIncidenteContradiccion(id: string, verificadorId: string): Promise<void> {
    await new IncidenteContradiccionRepository().resolver(id, verificadorId, new Date());
}
