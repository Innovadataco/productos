import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esComiteRol } from "@/lib/operadores/permisos";
import { corregirInformeBodySchema } from "@/lib/schemas";
import { corregirInforme } from "@/lib/comite/consolidacion";

/**
 * SPEC-237 (002-PI-mega-cola): corrección del resumen consolidado con
 * historial append-only (`correccionesJson`). Solo COMITE_VALIDACION.
 * El estado del informe queda en CORREGIDO (no APROBADO).
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ expedienteId: string }> }
) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "comite_bandeja");
        if (!esComiteRol(user.rol)) {
            return NextResponse.json(
                { error: { message: "Solo el comité de validación puede corregir informes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: { message: "Cuerpo inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const parsed = corregirInformeBodySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: {
                        message: parsed.error.issues[0]?.message ?? "Datos inválidos",
                        code: ERROR_CODES.VALIDATION_ERROR,
                    },
                },
                { status: 400 }
            );
        }

        const { expedienteId } = await params;
        const resultado = await corregirInforme(
            expedienteId,
            { id: user.id, nombre: user.nombre ?? user.email },
            parsed.data
        );

        return NextResponse.json({ informe: resultado });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        console.error("[ComiteConsolidacion] Error corrigiendo informe:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
