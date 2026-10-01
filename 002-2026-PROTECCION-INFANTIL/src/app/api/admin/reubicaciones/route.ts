import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { citasPorReubicar } from "@/lib/profesional/cita/reubicacion-cola";

/**
 * SPEC-814 · GET /api/admin/reubicaciones — la COLA «Citas en espera de reubicación»: las citas
 * CONFIRMADA de un profesional que dejó de poder atenderlas, listas para reubicar (art. 19/8.5).
 * El servicio proyecta lo MÍNIMO (FORMA §3): sin el relato ni la PII de la familia.
 *
 * El «a QUIÉN va» (candidatos ofrecibles que calzan) y el WRITE de reubicación se cablan con
 * SPEC-832 (el matcher, detrás de SPEC-825). Esta ruta entrega la cola, que es la cara PRINCIPAL
 * de la pantalla (la mediana de candidatos medida en prod es 0). Gateada bajo el módulo de
 * logística de citas del admin («operadores»), como `citas-sin-operador`.
 */
export async function GET() {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "operadores");
        const data = await citasPorReubicar();
        return NextResponse.json({ data });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/REUBICACIONES]");
    }
}
