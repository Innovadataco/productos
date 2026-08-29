import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { idSchema } from "@/lib/validators";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { listarContactos } from "@/lib/dal/services/circulo-confianza";
import { logAuditNuevaAccion, ACCION_CIRCULO_CONFIANZA_ACCESO_ADMIN } from "@/lib/audit-nuevas-acciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

/**
 * GET /api/admin/padres/[id]/circulo-confianza (SPEC-141, N-1, FR-001/FR-004).
 * Visibilidad de SOPORTE, estrictamente solo lectura: el círculo de confianza
 * de un padre exactamente como lo ve el dueño (mismo servicio `listarContactos`,
 * mismo predicado de estados). CERO escritura: las mutaciones siguen siendo
 * exclusivas del padre en `api/circulo-confianza/*`.
 * Cada respuesta 200 deja una fila AuditLog (CIRCULO_CONFIANZA_ACCESO_ADMIN)
 * con metadatos SIN valores de identificadores; los 403/404 no auditan.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "soporte_lectura");

        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id: rawId } = await params;
        const parsedId = idSchema.safeParse(rawId);
        if (!parsedId.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // 404 genérico si no existe o no es PARENT (no oráculo de roles).
        const padre = await new UsuarioRepository().findPadreById(parsedId.data);
        if (!padre) {
            return NextResponse.json(
                { error: { message: "Padre no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const resultado = await listarContactos(padre.id);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAuditNuevaAccion({
            accion: ACCION_CIRCULO_CONFIANZA_ACCESO_ADMIN,
            tipoRecurso: "Usuario",
            recursoId: padre.id,
            usuarioId: admin.id,
            ipAddress,
            userAgent,
            // Solo conteo — nunca valores de identificadores ni etiquetas.
            metadatos: { contactos: resultado.contactos.length },
        });

        return NextResponse.json(resultado);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[SoporteLectura] Error consultando círculo de confianza", {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
