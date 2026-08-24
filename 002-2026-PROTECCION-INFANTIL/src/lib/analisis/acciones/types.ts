/**
 * SPEC-226 (002-PI-mega-cola): contratos del ejecutor de acciones automáticas.
 *
 * Un handler por tipo de acción (registro en `registry.ts`). El ejecutor abre
 * la TX, invoca `ejecutar`, persiste `EjecucionAccion` + `AuditLog` y DESPUÉS
 * de la TX corre `notificar()` (Motor Notif, fail-open): las llamadas al motor
 * nunca quedan dentro de la transacción (FR-015).
 *
 * Los errores de negocio de los handlers se lanzan como `AppError` con un
 * motivo seguro (ej. "sujeto_no_valido"): el ejecutor los registra como
 * `EjecucionAccion(FALLIDA)` con ese motivo, sin exponer detalles internos.
 */
import type { EjecucionAccion, Prisma, Recomendacion, ReglaRecomendacion, TipoAccionEjecutable } from "@prisma/client";
import type { EjecucionAccionRepository } from "@/lib/dal/repositories/ejecucion-accion";

export type ResultadoPatch = Record<string, unknown>;

export interface AccionHandlerContext {
    recomendacion: Recomendacion;
    regla: ReglaRecomendacion;
    /** `accionParametros` crudo (snapshot recomendación ?? regla); el handler lo valida con Zod. */
    parametros: unknown;
    tx: Prisma.TransactionClient;
    repo: EjecucionAccionRepository;
}

export interface HandlerResult {
    /** Ids creados / metadatos de la acción (van a `EjecucionAccion.resultado`). */
    resultado: ResultadoPatch;
    /**
     * Llamadas al Motor Notif post-TX (fail-open). Si devuelve un patch, el
     * ejecutor lo fusiona en `EjecucionAccion.resultado`.
     */
    notificar?: (() => Promise<ResultadoPatch | void>) | undefined;
}

export interface RevertirContext {
    ejecucion: EjecucionAccion;
    recomendacion: Recomendacion;
    regla: ReglaRecomendacion;
    tx: Prisma.TransactionClient;
    repo: EjecucionAccionRepository;
}

/** Resultado del `notificar` de una reversión (post-TX). */
export interface NotificarReversionResult {
    detalle?: string | undefined;
    resultadoPatch?: ResultadoPatch | undefined;
}

export interface RevertirResult {
    /** Efecto del rollback en lenguaje de negocio (va en `efectoReversion.detalle`). */
    detalle: string;
    resultadoPatch?: ResultadoPatch | undefined;
    notificar?: (() => Promise<NotificarReversionResult | void>) | undefined;
}

export interface AccionHandler {
    /** Clave criolla de `ReglaRecomendacion.accionEjecutable` (brief §9). */
    clave: string;
    /** Representación persistida en `EjecucionAccion.tipoAccion`. */
    tipo: TipoAccionEjecutable;
    ejecutar(ctx: AccionHandlerContext): Promise<HandlerResult>;
    revertir(ctx: RevertirContext): Promise<RevertirResult>;
}
