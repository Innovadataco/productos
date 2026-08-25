/**
 * SPEC-211 (002-PI-111): validación de un código de bono promocional por su
 * nombre público (el cliente conoce el código, no el id interno). No persiste
 * nada: devuelve el `bonoId` y el descuento estimado para que la UI confirme y
 * aplique vía POST /api/pagos/aplicar-bono (SPEC-216).
 */
import { toZonedTime } from "date-fns-tz";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { calcularDescuentoBono } from "./pagos-calculos.service";
import { verificarTitularidad, type UsuarioTitular } from "./suscripcion-vista.service";
import type { TipoTitular } from "@prisma/client";

const ZONA_BOGOTA = "America/Bogota";

export interface ValidarBonoResultado {
    bonoId: string;
    nombre: string;
    tipo: string;
    valor: number;
    descuentoEstimadoUSD: number;
}

export async function validarCodigoBono(
    suscripcionId: string,
    codigo: string,
    usuario: UsuarioTitular
): Promise<ValidarBonoResultado> {
    const suscripcion = await verificarTitularidad(suscripcionId, usuario);
    if (!suscripcion) {
        throw new AppError("Suscripción no encontrada o no pertenece al usuario", ERROR_CODES.NOT_FOUND, 404);
    }

    const repo = new PagosRepository();
    const bono = await repo.obtenerBonoPromocionalPorNombre(codigo.trim());
    if (!bono) {
        throw new AppError("Bono no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }
    if (!bono.activo) {
        throw new AppError("El bono no está activo", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const ahora = toZonedTime(new Date(), ZONA_BOGOTA);
    if (bono.vigenciaInicio > ahora || bono.vigenciaFin < ahora) {
        throw new AppError("El bono no está vigente", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    if (bono.aplicaSoloA && bono.aplicaSoloA !== suscripcion.tipoTitular) {
        throw new AppError("El bono no aplica a tu tipo de suscripción", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    if (await repo.existeBonoAplicado(bono.id, suscripcion.id)) {
        throw new AppError("El bono ya fue aplicado a esta suscripción", ERROR_CODES.CONFLICT, 409);
    }

    const montoBaseUSD = suscripcion.planActual.precioBaseUSD;
    return {
        bonoId: bono.id,
        nombre: bono.nombre,
        tipo: bono.tipo,
        valor: bono.valor,
        descuentoEstimadoUSD: Math.min(montoBaseUSD, calcularDescuentoBono(montoBaseUSD, bono)),
    };
}

export interface ValidarBonoCheckoutResultado {
    bonoId: string;
    nombre: string;
    tipo: string;
    valor: number;
    descuentoUSD: number;
}

/**
 * SPEC-244 (002-PI-147): valida un código de bono para el checkout de un plan
 * SIN requerir una suscripción previa. Verifica existencia, vigencia, activo,
 * ámbito de titular y restricciones de transferibilidad/beneficiario.
 *
 * @param codigo - nombre público del bono (el cupón que teclea el cliente).
 * @param tipoTitular - tipo de titular que va a comprar (PADRE/COLEGIO).
 * @param usuarioId - id del usuario autenticado (para validar beneficiario).
 * @param montoBaseUSD - precio base del plan en USD sobre el que calcular descuento.
 */
export async function validarBonoParaCheckout(
    codigo: string | undefined,
    tipoTitular: TipoTitular,
    usuarioId: string,
    montoBaseUSD: number
): Promise<ValidarBonoCheckoutResultado | null> {
    if (!codigo || codigo.trim().length === 0) return null;

    const repo = new PagosRepository();
    const bono = await repo.obtenerBonoPromocionalPorNombre(codigo.trim());
    if (!bono) {
        throw new AppError("Cupón no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }
    if (!bono.activo) {
        throw new AppError("El cupón no está activo", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const ahora = toZonedTime(new Date(), ZONA_BOGOTA);
    if (bono.vigenciaInicio > ahora || bono.vigenciaFin < ahora) {
        throw new AppError("El cupón no está vigente", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    if (bono.aplicaSoloA && bono.aplicaSoloA !== tipoTitular) {
        throw new AppError("El cupón no aplica a tu tipo de suscripción", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    // SPEC-246: si el bono tiene beneficiario y no es transferible, solo ese usuario puede usarlo.
    if (bono.beneficiarioUsuarioId && !bono.transferible && bono.beneficiarioUsuarioId !== usuarioId) {
        throw new AppError("El cupón no es transferible y no pertenece a tu cuenta", ERROR_CODES.FORBIDDEN, 403);
    }

    const descuentoUSD = Math.min(montoBaseUSD, calcularDescuentoBono(montoBaseUSD, bono));
    return {
        bonoId: bono.id,
        nombre: bono.nombre,
        tipo: bono.tipo,
        valor: bono.valor,
        descuentoUSD,
    };
}
