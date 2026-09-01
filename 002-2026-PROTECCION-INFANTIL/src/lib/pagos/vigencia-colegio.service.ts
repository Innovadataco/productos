/**
 * SPEC-344 (A-69 · C1 · Puente D2, R6) — servicios que ESCRIBEN
 * `Colegio.finServicio` según el plan que el rector elige en el Paso 2 del
 * camino. Cierra el bug "gratis para siempre" (matiz CEO 03:18): un colegio
 * nuevo deja de quedar sin vencimiento al pasar por el camino.
 *
 * Reusa `calcularFinServicio` de A-64 (`src/lib/colegio/periodo.ts`) para el
 * mapeo por período (MENSUAL/SEMESTRAL/ANUAL).
 *
 * NO se toca la fuente de la vigencia (`sesion-estado-emitter.ts:33-35` sigue
 * leyendo la ventana del Colegio); la unificación profunda (vigencia colegio
 * ← Suscripción) queda para otra spec del brief A-69.
 */
import type { DuracionPlan, PrismaClient } from "@prisma/client";
import { addDays } from "date-fns";
import { calcularFinServicio } from "@/lib/colegio/periodo";
import { obtenerDuracionFreemiumDias } from "./parametros-pagos";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";

/** Mapea la duración del Plan (`DuracionPlan`) a meses concretos. */
const MESES_POR_DURACION: Record<DuracionPlan, number> = {
    MES_1: 1,
    MES_2: 2,
    MES_3: 3,
    MES_6: 6,
    MES_12: 12,
};

/**
 * Calcula la fecha de fin de un plan pagado según su `DuracionPlan`. Prefiere
 * `calcularFinServicio` para MENSUAL/SEMESTRAL/ANUAL (paridad con A-64) y
 * cae a "meses aditivos" para MES_2/MES_3.
 */
export function calcularFinDesdeDuracionPlan(inicio: Date, duracion: DuracionPlan): Date {
    switch (duracion) {
        case "MES_1": {
            const f = calcularFinServicio(inicio, "MENSUAL");
            if (f) return f;
            break;
        }
        case "MES_6": {
            const f = calcularFinServicio(inicio, "SEMESTRAL");
            if (f) return f;
            break;
        }
        case "MES_12": {
            const f = calcularFinServicio(inicio, "ANUAL");
            if (f) return f;
            break;
        }
    }
    const fin = new Date(inicio.getTime());
    fin.setMonth(fin.getMonth() + MESES_POR_DURACION[duracion]);
    return fin;
}

/**
 * Puente D2 · escribe `Colegio.finServicio` según el plan elegido.
 * Para freemium usa la parametrización `pagos.freemium.duracion_dias`.
 * Idempotente: pisa el valor anterior (por diseño; el rector eligió).
 */
export async function actualizarFinServicioDesdePlan(
    colegioId: string,
    input:
        | { tipo: "freemium" }
        | { tipo: "pagado"; duracion: DuracionPlan },
    tx?: PrismaClient,
): Promise<Date> {
    const inicio = new Date();
    const fin =
        input.tipo === "freemium"
            ? addDays(inicio, await obtenerDuracionFreemiumDias())
            : calcularFinDesdeDuracionPlan(inicio, input.duracion);
    await new ColegioRepository(tx as never).actualizar(colegioId, { finServicio: fin });
    return fin;
}
