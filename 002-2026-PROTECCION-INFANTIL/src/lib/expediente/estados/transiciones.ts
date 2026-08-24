/**
 * SPEC-236 (002-PI-mega-cola): whitelist de transiciones del expediente padre
 * y guards de negocio asociados.
 *
 * Cada transición permitida se declara en `TRANSICIONES` con:
 * - `destino`: estado destino.
 * - `guard`: función async que valida precondiciones de negocio; devuelve
 *   `{ ok: true }` o `{ ok: false, codigo, mensaje }` (403 hard guard / 409 conflicto).
 * - `nota`: documentación breve del guard (FR-001).
 * - `evento`: clave de Motor Notif a publicar tras la transición.
 *
 * Reglas duras:
 * - `CERRADO → *` se rechaza siempre con 403, salvo `CERRADO → ESCALADO`
 *   (reapertura v1 solicitada por el padre, FR-010/FR-011).
 * - `* → ESCALADO` solo existe desde `CERRADO` en v1; la escalación ROJO
 *   automática queda para SPEC-239.
 */
import { EstadoExpediente } from "@prisma/client";
import type { Expediente } from "@prisma/client";
import { getParametroSistemaValor } from "@/lib/parametros";
import { InformeConsolidadoRepository } from "@/lib/dal/repositories/informe-consolidado-repository";
import { contarAclaracionesPorEstado } from "./aclaracion-consulta";

/** Actor que solicita la transición. */
export interface ActorTransicion {
    id: string;
    tipo: "usuario" | "service-account" | "worker";
    /** Rol del usuario cuando tipo = "usuario" (ej. "ADMIN", "PARENT"). */
    rol?: string;
}

export interface ContextoTransicion {
    expediente: Expediente;
    actor: ActorTransicion;
    motivo?: string | undefined;
}

export type GuardResult = { ok: true } | { ok: false; codigo: 403 | 409; mensaje: string };
export type GuardFn = (ctx: ContextoTransicion) => Promise<GuardResult>;

/** Claves de evento de Motor Notif del ciclo de vida del expediente (FR-018). */
export const EVENTOS_EXPEDIENTE = {
    CREADO: "expediente.creado",
    EVENTO_AGREGADO: "expediente.evento.agregado",
    GRAVEDAD_SUBIO_A_ROJO: "expediente.gravedad.subio_a_rojo",
    CONSOLIDACION_SOLICITADA: "expediente.consolidacion.solicitada",
    COMITE_APROBO: "expediente.comite.aprobo",
    ACLARACION_SOLICITADA: "expediente.aclaracion.solicitada",
    ACLARACION_RESPONDIDA: "expediente.aclaracion.respondida",
    CERRADO: "expediente.cerrado",
    ESCALADO: "expediente.escalado",
    AUTO_CERRADO_INACTIVIDAD: "expediente.auto_cerrado_inactividad",
    COMITE_SLA_VENCIDO: "expediente.comite.sla_vencido",
} as const;

export type ClaveEventoExpediente = (typeof EVENTOS_EXPEDIENTE)[keyof typeof EVENTOS_EXPEDIENTE];

export interface TransicionDef {
    destino: EstadoExpediente;
    guard: GuardFn;
    nota: string;
    evento: ClaveEventoExpediente;
}

const DEFAULT_CONSOLIDACION_MIN = 2;
const DEFAULT_AUTO_CIERRE_MESES = 6;

function conflicto(mensaje: string): GuardResult {
    return { ok: false, codigo: 409, mensaje };
}

async function numParam(clave: string, defecto: number): Promise<number> {
    const raw = await getParametroSistemaValor(clave);
    const parsed = Number.parseInt(raw ?? String(defecto), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : defecto;
}

/** FR-003: ACTIVO → CONSOLIDANDO exige un mínimo de eventos acumulados. */
const guardMinEventosConsolidacion: GuardFn = async ({ expediente }) => {
    const min = await numParam("padre.expediente.consolidacion_min_reportes", DEFAULT_CONSOLIDACION_MIN);
    if (expediente.numEventos < min) {
        return conflicto(
            `El expediente tiene ${expediente.numEventos} eventos; se requieren al menos ${min} para consolidar`
        );
    }
    return { ok: true };
};

/** FR-004: CONSOLIDANDO → PENDIENTE_COMITE exige informe consolidado reciente. */
const guardExisteInformeConsolidado: GuardFn = async ({ expediente }) => {
    const informe = await new InformeConsolidadoRepository().obtenerUltimaVersion(expediente.id);
    if (!informe) {
        return conflicto("No existe un informe consolidado para este expediente");
    }
    return { ok: true };
};

/** FR-005: PENDIENTE_COMITE → EN_APROBACION_PADRE exige informe APROBADO. */
const guardInformeAprobado: GuardFn = async ({ expediente }) => {
    const informe = await new InformeConsolidadoRepository().obtenerUltimaVersion(expediente.id);
    if (!informe || informe.estadoAprobacion !== "APROBADO") {
        return conflicto("El informe consolidado más reciente no está aprobado por el comité");
    }
    return { ok: true };
};

/** FR-006: EN_APROBACION_PADRE → EN_ACLARACION exige una aclaración PENDIENTE. */
const guardExisteAclaracionPendiente: GuardFn = async ({ expediente }) => {
    const pendientes = await contarAclaracionesPorEstado(expediente.id, "PENDIENTE");
    if (pendientes === 0) {
        return conflicto("No existe una aclaración pendiente para este expediente");
    }
    return { ok: true };
};

/** FR-007: EN_ACLARACION → EN_APROBACION_PADRE exige aclaración RESPONDIDA. */
const guardExisteAclaracionRespondida: GuardFn = async ({ expediente }) => {
    const respondidas = await contarAclaracionesPorEstado(expediente.id, "RESPONDIDA");
    if (respondidas === 0) {
        return conflicto("No existe una aclaración respondida para este expediente");
    }
    return { ok: true };
};

/**
 * SPEC-238 (FR-006, US4): EN_ACLARACION → CERRADO solo lo ejecuta el worker
 * cuando la aclaración PENDIENTE superó el SLA del comité
 * (`padre.comite.sla_horas_normal`). El vencimiento se re-verifica en la
 * tarea del worker antes de llamar a la transición.
 */
const guardCierreForzosoSlaAclaracion: GuardFn = async ({ expediente, actor }) => {
    if (actor.tipo !== "worker" && actor.tipo !== "service-account") {
        return conflicto("El cierre desde EN_ACLARACION solo lo ejecuta el worker por SLA de aclaración vencido");
    }
    const pendientes = await contarAclaracionesPorEstado(expediente.id, "PENDIENTE");
    if (pendientes === 0) {
        return conflicto("No existe una aclaración pendiente para cerrar por SLA");
    }
    return { ok: true };
};

/**
 * FR-008: EN_APROBACION_PADRE → CERRADO permite (a) aceptación del padre
 * titular o (b) cierre forzado tras exactamente 1 aclaración respondida.
 */
const guardCierreDesdeAprobacionPadre: GuardFn = async ({ expediente, actor }) => {
    if (actor.tipo === "usuario" && actor.id === expediente.padreUsuarioId) {
        return { ok: true };
    }
    const respondidas = await contarAclaracionesPorEstado(expediente.id, "RESPONDIDA");
    if (respondidas === 1) {
        return { ok: true };
    }
    return conflicto(
        "El cierre requiere la aceptación del padre o exactamente 1 aclaración respondida (cierre forzado v1)"
    );
};

/**
 * FR-009: ACTIVO → CERRADO automático por inactividad. Solo el worker puede
 * ejecutarla y la inactividad se re-verifica contra el parámetro vigente.
 */
const guardAutoCierreInactividad: GuardFn = async ({ expediente, actor }) => {
    if (actor.tipo !== "worker") {
        return conflicto("El cierre directo desde ACTIVO solo lo ejecuta el worker por inactividad");
    }
    const meses = await numParam("padre.expediente.auto_cierre_meses", DEFAULT_AUTO_CIERRE_MESES);
    const referencia = expediente.ultimoEventoEn ?? expediente.fechaApertura;
    const limite = new Date(referencia);
    limite.setUTCMonth(limite.getUTCMonth() + meses);
    if (Date.now() < limite.getTime()) {
        return conflicto("El expediente aún no cumple el plazo de inactividad para auto-cierre");
    }
    return { ok: true };
};

/** FR-010/FR-011: CERRADO → ESCALADO solo a petición del padre titular (v1). */
const guardReaperturaPorPadre: GuardFn = async ({ expediente, actor }) => {
    if (actor.tipo === "usuario" && actor.id === expediente.padreUsuarioId) {
        return { ok: true };
    }
    return {
        ok: false,
        codigo: 403,
        mensaje: "Solo el padre titular puede solicitar la reapertura de un expediente cerrado",
    };
};

/** Whitelist inmutable de transiciones (FR-001). */
export const TRANSICIONES: ReadonlyMap<EstadoExpediente, readonly TransicionDef[]> = new Map([
    [
        EstadoExpediente.ACTIVO,
        [
            {
                destino: EstadoExpediente.CONSOLIDANDO,
                guard: guardMinEventosConsolidacion,
                nota: "Exige numEventos >= padre.expediente.consolidacion_min_reportes.",
                evento: EVENTOS_EXPEDIENTE.CONSOLIDACION_SOLICITADA,
            },
            {
                destino: EstadoExpediente.CERRADO,
                guard: guardAutoCierreInactividad,
                nota: "Solo worker; re-verifica inactividad > padre.expediente.auto_cierre_meses.",
                evento: EVENTOS_EXPEDIENTE.AUTO_CERRADO_INACTIVIDAD,
            },
        ],
    ],
    [
        EstadoExpediente.CONSOLIDANDO,
        [
            {
                destino: EstadoExpediente.PENDIENTE_COMITE,
                guard: guardExisteInformeConsolidado,
                nota: "Exige el InformeConsolidado más reciente del expediente.",
                evento: EVENTOS_EXPEDIENTE.CONSOLIDACION_SOLICITADA,
            },
        ],
    ],
    [
        EstadoExpediente.PENDIENTE_COMITE,
        [
            {
                destino: EstadoExpediente.EN_APROBACION_PADRE,
                guard: guardInformeAprobado,
                nota: "Exige InformeConsolidado.estadoAprobacion = APROBADO.",
                evento: EVENTOS_EXPEDIENTE.COMITE_APROBO,
            },
        ],
    ],
    [
        EstadoExpediente.EN_APROBACION_PADRE,
        [
            {
                destino: EstadoExpediente.EN_ACLARACION,
                guard: guardExisteAclaracionPendiente,
                nota: "Exige una Aclaracion en estado PENDIENTE (tabla real en SPEC-238).",
                evento: EVENTOS_EXPEDIENTE.ACLARACION_SOLICITADA,
            },
            {
                destino: EstadoExpediente.CERRADO,
                guard: guardCierreDesdeAprobacionPadre,
                nota: "Aceptación del padre o cierre forzado tras exactamente 1 aclaración respondida.",
                evento: EVENTOS_EXPEDIENTE.CERRADO,
            },
        ],
    ],
    [
        EstadoExpediente.EN_ACLARACION,
        [
            {
                destino: EstadoExpediente.EN_APROBACION_PADRE,
                guard: guardExisteAclaracionRespondida,
                nota: "Exige Aclaracion.estado = RESPONDIDA (tabla real en SPEC-238).",
                evento: EVENTOS_EXPEDIENTE.ACLARACION_RESPONDIDA,
            },
            {
                destino: EstadoExpediente.CERRADO,
                guard: guardCierreForzosoSlaAclaracion,
                nota: "SPEC-238: solo worker; exige aclaración PENDIENTE con SLA vencido.",
                evento: EVENTOS_EXPEDIENTE.CERRADO,
            },
        ],
    ],
    [
        EstadoExpediente.CERRADO,
        [
            {
                destino: EstadoExpediente.ESCALADO,
                guard: guardReaperturaPorPadre,
                nota: "Reapertura v1: solo el padre titular. Escalación ROJO automática: SPEC-239.",
                evento: EVENTOS_EXPEDIENTE.ESCALADO,
            },
        ],
    ],
]);

/**
 * Busca la definición de transición en la whitelist.
 * Devuelve undefined si el par (actual → destino) no está permitido.
 */
export function buscarTransicion(
    estadoActual: EstadoExpediente,
    estadoDestino: EstadoExpediente
): TransicionDef | undefined {
    return TRANSICIONES.get(estadoActual)?.find((t) => t.destino === estadoDestino);
}
