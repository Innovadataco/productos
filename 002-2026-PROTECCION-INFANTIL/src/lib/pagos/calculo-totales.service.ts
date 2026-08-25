/**
 * SPEC-244 (002-PI-147): cálculo del desglose de pago en COP para checkout de
 * suscripciones (padre/colegio). Sin dependencias de UI.
 */
import type { Plan, TipoTitular } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getParametroSistemaValor } from "@/lib/parametros";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { validarBonoParaCheckout } from "./validar-bono.service";

export interface DesglosePago {
    subtotal: number;
    descuentoBono: number;
    baseGravable: number;
    iva: number;
    total: number;
}

interface ParametrosIva {
    porcentaje: number;
    aplicaA: "todos" | "solo_colegios" | "solo_padres" | "ninguno";
}

function redondearCents(valor: number): number {
    return Math.round(valor * 100) / 100;
}

async function obtenerParametrosIva(): Promise<ParametrosIva> {
    const [porcentajeRaw, aplicaARaw] = await Promise.all([
        getParametroSistemaValor("pagos.iva.porcentaje"),
        getParametroSistemaValor("pagos.iva.aplica_a"),
    ]);

    const porcentaje = porcentajeRaw ? parseFloat(porcentajeRaw) : 19;
    const aplicaA = (aplicaARaw ?? "todos") as ParametrosIva["aplicaA"];

    return {
        porcentaje: Number.isFinite(porcentaje) && porcentaje >= 0 ? porcentaje : 19,
        aplicaA,
    };
}

function ivaAplicaATitular(aplicaA: ParametrosIva["aplicaA"], tipoTitular: TipoTitular): boolean {
    switch (aplicaA) {
        case "todos":
            return true;
        case "solo_colegios":
            return tipoTitular === "COLEGIO";
        case "solo_padres":
            return tipoTitular === "PADRE";
        case "ninguno":
            return false;
        default:
            return true;
    }
}

/**
 * Obtiene la tasa USD→COP más reciente. Si no existe, fallback 1:1.
 */
async function obtenerTasaUSDCOP(): Promise<number> {
    const repo = new PagosRepository();
    const tasa = await repo.obtenerTasaCambioMasReciente("COP");
    if (!tasa || !Number.isFinite(tasa.tasa) || tasa.tasa <= 0) {
        return 1;
    }
    return tasa.tasa;
}

/**
 * Calcula el desglose de pago en COP para un plan y un código de bono opcional.
 *
 * - `subtotal` es el precio base COP del plan.
 * - `descuentoBono` se calcula en USD sobre el precio base USD del plan y se
 *   convierte a COP con la tasa actual (fallback 1:1).
 * - `baseGravable` = subtotal - descuentoBono (nunca negativa).
 * - `iva` depende de `pagos.iva.aplica_a` y del tipo de titular.
 */
export async function calcularTotales(
    plan: Pick<Plan, "id" | "nombre" | "precioBaseUSD" | "precioBaseCOP">,
    tipoTitular: TipoTitular,
    codigoBono?: string | undefined,
    usuarioId?: string | undefined
): Promise<DesglosePago> {
    const parametrosIva = await obtenerParametrosIva();
    const tasa = await obtenerTasaUSDCOP();

    const subtotal = plan.precioBaseCOP ?? 0;
    if (subtotal < 0) {
        throw new AppError("El plan tiene un precio base inválido", ERROR_CODES.INTERNAL_ERROR, 500);
    }

    let descuentoBono = 0;
    if (codigoBono && codigoBono.trim().length > 0) {
        if (!usuarioId) {
            throw new AppError("Se requiere usuarioId para validar el cupón", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        const bono = await validarBonoParaCheckout(codigoBono.trim(), tipoTitular, usuarioId, plan.precioBaseUSD);
        if (bono) {
            descuentoBono = redondearCents(bono.descuentoUSD * tasa);
        }
    }

    const baseGravable = Math.max(0, redondearCents(subtotal - descuentoBono));
    const iva = ivaAplicaATitular(parametrosIva.aplicaA, tipoTitular)
        ? redondearCents(baseGravable * (parametrosIva.porcentaje / 100))
        : 0;
    const total = redondearCents(baseGravable + iva);

    return {
        subtotal,
        descuentoBono,
        baseGravable,
        iva,
        total,
    };
}

