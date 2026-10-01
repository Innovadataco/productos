/**
 * SPEC-825 · FUENTE ÚNICA de la elegibilidad REPS por lote — «¿este profesional puede ofrecer esta modalidad?».
 *
 * Extraído de `PerfilProfesionalRepository.idsRepsElegibles` (SPEC-790) para que lo compartan SIN CICLO el
 * directorio (`perfil-profesional.ts`) y las franjas (`franja-disponible.ts`): `perfil-profesional` importa
 * `FranjaDisponibleRepository` (el chip de 818), así que `franja-disponible` NO puede importar `perfil`. Este
 * módulo no importa ninguno de los dos → sin ciclo.
 *
 * 🔒 ÚNICO lugar donde se computa elegibilidad REPS (candado SPEC-825): la ÚLTIMA `VerificacionReps` por
 * profesional + `repsElegible(hecho, modalidad, config, ahora)`. Nadie más reimplementa esto —
 * `perfil-profesional.idsRepsElegibles` DELEGA aquí. Mover el código sin este candado crearía DOS fuentes.
 */
import type { DbClient } from "@/lib/dal/unit-of-work";
import { getParametroSistemaValor } from "@/lib/parametros";
import { repsElegible, type ConfigReps, type HechoReps, type ModalidadReps } from "./reps-elegibilidad";

const PARAM_REPS_VENTANA = "reps.ventana_verificacion_dias";
const PARAM_REPS_EXIGIR = "reps.exigir_reps_verificado";

/** Config viva del REPS (ventana + cutover). Fuente única — `perfil-profesional.configReps` delega aquí. */
export async function configRepsVivo(): Promise<ConfigReps> {
    const ventana = parseInt((await getParametroSistemaValor(PARAM_REPS_VENTANA)) ?? "", 10);
    const exigir = (await getParametroSistemaValor(PARAM_REPS_EXIGIR))?.trim().toLowerCase();
    return {
        ventanaVerificacionDias: Number.isFinite(ventana) && ventana > 0 ? ventana : 365,
        // Ships `false` (cutover ABIERTO): hoy SIN_VERIFICAR es el universo; exigir vaciaría el directorio.
        exigirRepsVerificado: exigir === "true" || exigir === "1",
    };
}

/**
 * ¿Cuáles de `perfilIds` son REPS-elegibles para `modalidad`?
 *
 * `modalidad = null` significa «elegible para ALGUNA modalidad» — es el uso del DIRECTORIO (un profesional
 * entra si su REPS cubre AL MENOS una). ⚠️ Para decidir sobre una FRANJA se pasa SIEMPRE la modalidad
 * CONCRETA: `null` a nivel de franja es exactamente el bug de SPEC-825 (un REPS-solo-PRESENCIAL se colaría con
 * su franja VIRTUAL). Una sola consulta para todo el lote (no N+1).
 */
export async function idsRepsElegiblesLote(
    db: DbClient,
    perfilIds: string[],
    modalidad: ModalidadReps | null,
    ahora: Date,
    config?: ConfigReps,
): Promise<Set<string>> {
    if (perfilIds.length === 0) return new Set();
    const cfg = config ?? (await configRepsVivo());
    const filas = await db.verificacionReps.findMany({
        where: { profesionalId: { in: perfilIds } },
        orderBy: { verificadoEn: "desc" },
        select: { profesionalId: true, resultado: true, verificadoEn: true, vigenteHasta: true, modalidades: true },
    });
    const ultima = new Map<string, HechoReps>();
    for (const f of filas) {
        // La primera que aparece por profesional = la más reciente (orden desc).
        if (!ultima.has(f.profesionalId)) {
            ultima.set(f.profesionalId, {
                resultado: f.resultado,
                verificadoEn: f.verificadoEn,
                vigenteHasta: f.vigenteHasta,
                modalidades: f.modalidades,
            });
        }
    }
    const elegibles = new Set<string>();
    for (const id of perfilIds) {
        if (repsElegible(ultima.get(id) ?? null, modalidad, cfg, ahora).elegible) elegibles.add(id);
    }
    return elegibles;
}
