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
