/**
 * SPEC-225 (002-PI-126): puntualidad histórica de pagos (regla de mora
 * anómala, FR-005). Definición operacional (H-6 de tasks.md, documentada en
 * research §Assumptions): un pago AUTORIZADO es "puntual" si su
 * `fechaReporte` cae en o antes de su fecha límite teórica, calculada como
 * `fechaInicio` de la suscripción + los meses cubiertos por los pagos
 * autorizados anteriores, más una tolerancia fija para absorber el registro
 * del primer pago el mismo día del alta y rezagos de fin de semana.
 *
 * El modelo `Pago` no guarda el período cubierto; esta es la aproximación
 * determinista acordada (sin IA, sin heurísticas ocultas).
 */
import type { DuracionPlan } from "@prisma/client";

/** Tolerancia calendario sobre la fecha límite teórica de cada pago. */
export const TOLERANCIA_PUNTUALIDAD_DIAS = 3;

const MESES_POR_DURACION: Record<DuracionPlan, number> = {
    MES_1: 1,
    MES_2: 2,
    MES_3: 3,
    MES_6: 6,
    MES_12: 12,
};

export function mesesPorDuracion(duracion: DuracionPlan): number {
    return MESES_POR_DURACION[duracion];
}

export interface PagoParaPuntualidad {
    duracionCubierta: DuracionPlan;
    fechaReporte: Date;
}

function addMeses(fecha: Date, meses: number): Date {
    const copia = new Date(fecha.getTime());
    copia.setUTCMonth(copia.getUTCMonth() + meses);
    return copia;
}

/**
 * Cuenta los pagos puntuales de una suscripción. `pagos` puede venir en
 * cualquier orden; se ordenan por `fechaReporte` antes de acumular cobertura.
 */
export function contarPagosPuntuales(fechaInicio: Date, pagos: PagoParaPuntualidad[]): number {
    const ordenados = [...pagos].sort(
        (a, b) => a.fechaReporte.getTime() - b.fechaReporte.getTime()
    );
    let mesesAcumulados = 0;
    let puntuales = 0;
    for (const pago of ordenados) {
        const limite =
            addMeses(fechaInicio, mesesAcumulados).getTime() +
            TOLERANCIA_PUNTUALIDAD_DIAS * 24 * 60 * 60 * 1000;
        if (pago.fechaReporte.getTime() <= limite) puntuales++;
        mesesAcumulados += mesesPorDuracion(pago.duracionCubierta);
    }
    return puntuales;
}
