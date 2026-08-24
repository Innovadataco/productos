import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esComiteRol } from "@/lib/operadores/permisos";
import { aprobarInformeBodySchema } from "@/lib/schemas";
import { aprobarInforme } from "@/lib/comite/consolidacion";

/**
 * SPEC-237 (002-PI-mega-cola): aprobación de un informe consolidado por un
 * miembro del comité. Solo COMITE_VALIDACION (ADMIN/PARENT → 403). Al
 * alcanzar `padre.comite.miembros_minimos_aprobacion` aprobaciones distintas
 * el expediente transiciona a EN_APROBACION_PADRE y se publica
 * `expediente.comite.aprobo` (SPEC-236).
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
                { error: { message: "Solo el comité de validación puede aprobar informes", code: ERROR_CODES.FORBIDDEN } },
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

        // El body es opcional (la identidad viene de la sesión); si llega, debe ser `{}`.
        let body: unknown = {};
        try {
            const text = await request.text();
            if (text.trim()) body = JSON.parse(text);
        } catch {
            return NextResponse.json(
                { error: { message: "Cuerpo inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const parsed = aprobarInformeBodySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Cuerpo inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const { expedienteId } = await params;
        const resultado = await aprobarInforme(expedienteId, {
            id: user.id,
            nombre: user.nombre ?? user.email,
        });

        return NextResponse.json(resultado);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        console.error("[ComiteConsolidacion] Error aprobando informe:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
