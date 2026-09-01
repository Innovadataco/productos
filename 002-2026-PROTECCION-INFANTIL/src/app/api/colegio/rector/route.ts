/**
 * SPEC-344 (A-69 · C1) — PATCH /api/colegio/rector.
 *
 * Endpoint del Paso 1 del camino guiado del colegio. El rector completa 5
 * campos de identidad; el servicio DAL persiste en `Usuario` (fuente de verdad
 * patrón A-67) y refleja en `Colegio` para compatibilidad. Al terminar sella
 * la cookie `sesion_estado` para que el Paso 1 avance al instante.
 *
 * Exento del guardián del camino (guardias.ts:camino.exentasColegio).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import {
    obtenerColegioIdDelRector,
    actualizarRectorYReflejarEnColegio,
} from "@/lib/dal/services/rector";
import { ERROR_CODES, AppError } from "@/lib/errors";
import { sellarCookieSesionEstado } from "@/lib/routing/sellar-sesion-estado";
import { logger } from "@/lib/logger";

const rectorPatchSchema = z.object({
    documentoTipo: z.string().trim().min(1, "Falta el tipo de documento"),
    documentoNumero: z.string().trim().min(1, "Falta el número de documento").max(50),
    nombre: z.string().trim().min(1, "Falta el nombre").max(150),
    apellidos: z.string().trim().min(1, "Faltan los apellidos").max(150),
    telefono: z.string().trim().min(1, "Falta el teléfono").max(30),
});

export async function PATCH(request: Request) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");

        const bodyRaw = await request.json().catch(() => undefined);
        const parsed = rectorPatchSchema.safeParse(bodyRaw);
        if (!parsed.success) {
            const primer = parsed.error.issues[0];
            return NextResponse.json(
                {
                    error: {
                        message: primer?.message ?? "Datos inválidos",
                        code: ERROR_CODES.VALIDATION_ERROR,
                        campo: primer?.path?.join(".") ?? undefined,
                    },
                },
                { status: 400 },
            );
        }

        const colegioId = await obtenerColegioIdDelRector(user.id);
        if (!colegioId) {
            return NextResponse.json(
                { error: { message: "Este rector no tiene colegio asociado.", code: ERROR_CODES.CONFLICT } },
                { status: 409 },
            );
        }

        await actualizarRectorYReflejarEnColegio(user.id, colegioId, parsed.data);

        const res = NextResponse.json({ ok: true }, { status: 200 });
        const sellado = await sellarCookieSesionEstado(res, user.id).catch(() => false);
        if (!sellado) {
            // Fallo silencioso — el próximo rebote sella. Informamos al cliente.
            return NextResponse.json({ ok: true, aviso: "recargue la página para continuar" }, { status: 200 });
        }
        return res;
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[/api/colegio/rector] Error:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 },
        );
    }
}
