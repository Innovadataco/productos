/**
 * SPEC-216 (002-PI-116): lógica de aplicación de bonos promocionales.
 *
 * Valida vigencia, topes, titular, idempotencia y tipo de suscripción; calcula
 * el descuento; persiste la pre-aplicación (pagoId opcional); audita; y emite
 * un evento stub (el motor de notificaciones se implementará en SPEC-217).
 */
import type { BonoPromocional, Suscripcion, TipoTitular } from "@prisma/client";
import { toZonedTime } from "date-fns-tz";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { calcularDescuentoBono } from "./pagos-calculos.service";

const ZONA_BOGOTA = "America/Bogota";

export interface AplicarBonoInput {
    suscripcionId: string;
    bonoId: string;
    montoBaseUSD: number;
    usuarioId: string;
    ipAddress?: string;
    userAgent?: string;
}

export interface AplicarBonoResultado {
    bonoAplicadoId: string;
    descuentoUSD: number;
}

/**
 * Stub del emisor de eventos de dominio. El motor real de notificaciones
 * (SPEC-217) reemplazará este log por una publicación en cola/topic.
 */
export async function emitirEventoBonoAplicado(payload: {
    bonoId: string;
    suscripcionId: string;
    bonoAplicadoId: string;
    descuentoUSD: number;
    aplicadoEn: Date;
}): Promise<void> {
    // TODO(deuda técnica): conectar con motor de eventos cuando exista.
    console.warn(`[BONO-EVENTO-STUB] bono.aplicado: ${JSON.stringify(payload)}`);
}

function ahoraBogota(): Date {
    return toZonedTime(new Date(), ZONA_BOGOTA);
}

function esVigente(bono: BonoPromocional, ahora: Date): boolean {
    return bono.vigenciaInicio <= ahora && bono.vigenciaFin >= ahora;
}

function validarTipoTitular(bono: BonoPromocional, tipoTitular: TipoTitular): void {
    if (bono.aplicaSoloA && bono.aplicaSoloA !== tipoTitular) {
        throw new AppError(
            `El bono no aplica a titulares de tipo ${tipoTitular}`,
            ERROR_CODES.VALIDATION_ERROR,
            400
        );
    }
}

async function validarTopes(
    repo: PagosRepository,
    bono: BonoPromocional,
    suscripcionId: string
): Promise<void> {
    if (bono.usosMaximosTotales !== null) {
        const usosGlobales = await repo.contarBonosAplicadosPorBono(bono.id);
        if (usosGlobales >= bono.usosMaximosTotales) {
            throw new AppError("El bono alcanzó su tope de usos", ERROR_CODES.CONFLICT, 409);
        }
    }

    const usosCliente = await repo.contarBonosAplicadosPorSuscripcion(suscripcionId, bono.id);
    if (usosCliente >= bono.usosMaximosPorCliente) {
        throw new AppError("El bono ya fue aplicado el máximo de veces para este cliente", ERROR_CODES.CONFLICT, 409);
    }
}

function validarNuevoRenovacion(
    bono: BonoPromocional,
    suscripcion: Suscripcion,
    tienePagos: boolean
): void {
    const esNueva = !tienePagos;
    if (!bono.aplicaANuevos && esNueva) {
        throw new AppError("El bono no aplica a suscripciones nuevas", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    if (!bono.aplicaARenovaciones && !esNueva) {
        throw new AppError("El bono no aplica a renovaciones", ERROR_CODES.VALIDATION_ERROR, 400);
    }
}

/**
 * Aplica un bono promocional a una suscripción. La operación es idempotente:
 * si el bono ya fue aplicado a la misma suscripción, se rechaza con 409.
 */
export async function aplicarBonoPromocional(
    input: AplicarBonoInput,
    repo: PagosRepository = new PagosRepository()
): Promise<AplicarBonoResultado> {
    const { suscripcionId, bonoId, montoBaseUSD, usuarioId } = input;

    const [bono, suscripcion, yaAplicado, pagos] = await Promise.all([
        repo.obtenerBonoPromocionalPorId(bonoId),
        repo.obtenerSuscripcionPorId(suscripcionId),
        repo.existeBonoAplicado(bonoId, suscripcionId),
        repo.listarPagosPorSuscripcion(suscripcionId),
    ]);

    if (!bono) {
        throw new AppError("Bono no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }
    if (!suscripcion) {
        throw new AppError("Suscripción no encontrada", ERROR_CODES.NOT_FOUND, 404);
    }

    if (!bono.activo) {
        throw new AppError("El bono no está activo", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const ahora = ahoraBogota();
    if (!esVigente(bono, ahora)) {
        throw new AppError("El bono no está vigente", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    // SPEC-246: cupón con beneficiario y no transferible solo puede usar el beneficiario.
    if (bono.beneficiarioUsuarioId && !bono.transferible && bono.beneficiarioUsuarioId !== usuarioId) {
        throw new AppError("El cupón no es transferible y no pertenece a tu cuenta", ERROR_CODES.FORBIDDEN, 403);
    }

    if (yaAplicado) {
        throw new AppError("El bono ya fue aplicado a esta suscripción", ERROR_CODES.CONFLICT, 409);
    }

    await validarTopes(repo, bono, suscripcionId);
    validarTipoTitular(bono, suscripcion.tipoTitular);
    validarNuevoRenovacion(bono, suscripcion, pagos.length > 0);

    const descuentoUSD = Math.min(montoBaseUSD, calcularDescuentoBono(montoBaseUSD, bono));

    const bonoAplicado = await repo.crearBonoAplicado({
        bonoId: bono.id,
        suscripcionId,
        descuentoUSD,
    });

    await logAudit({
        accion: "BONO_APLICADO",
        tipoRecurso: "BonoAplicado",
        recursoId: bonoAplicado.id,
        usuarioId,
        colegioId: suscripcion.colegioId ?? undefined,
        valorNuevo: JSON.stringify({
            bonoId: bono.id,
            suscripcionId,
            descuentoUSD,
            tipoBono: bono.tipo,
        }),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
    });

    await emitirEventoBonoAplicado({
        bonoId: bono.id,
        suscripcionId,
        bonoAplicadoId: bonoAplicado.id,
        descuentoUSD,
        aplicadoEn: bonoAplicado.aplicadoEn,
    });

    return { bonoAplicadoId: bonoAplicado.id, descuentoUSD };
}
