import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, esComiteRol } from "@/lib/operadores/permisos";
import { ComiteApelacionesService } from "@/lib/dal/services/comite-apelaciones";

/**
 * SPEC-110 — Resolución humana y motivada de una apelación (núcleo del diseño cerrado).
 *
 * SOLO la decisión del comité cambia la visibilidad (apelar no cambia nada). El caso
 * debe estar EN_REVISION y lo resuelve el miembro asignado (o ADMIN). Motivación escrita
 * obligatoria. Efectos al ACEPTAR (al menos uno obligatorio):
 * - quitarVisibilidad: marca `ocultoPorComiteEn` en el agregado y recalcula el flag con
 *   la dueña única (actualizarVisibilidadPublica). Un reporte nuevo posterior la levanta.
 * - reportesABajar: da de baja reportes concretos por falsos (REPORTE_FALSO), validando
 *   que pertenezcan al identificador + plataforma declarados.
 * RECHAZADA no cambia nada; el apelante puede volver a apelar.
 */

const resolverSchema = z.object({
    decision: z.enum(["ACEPTADA", "RECHAZADA"]),
    motivacion: z.string().min(1).max(4000),
    quitarVisibilidad: z.boolean().optional().default(false),
    reportesABajar: z.array(idSchema).optional().default([]),
});

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "comite_bandeja");
        if (!esAdminRol(user.rol) && !esComiteRol(user.rol)) {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
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

        const { id: rawId } = await params;
        const parsedId = idSchema.safeParse(rawId);
        if (!parsedId.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const id = parsedId.data;

        const body = await request.json();
        const parsed = resolverSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { decision, motivacion, quitarVisibilidad, reportesABajar } = parsed.data;

        if (decision === "ACEPTADA" && !quitarVisibilidad && reportesABajar.length === 0) {
            return NextResponse.json(
                { error: { message: "Al aceptar debes quitar la visibilidad y/o dar de baja reportes", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // SPEC-053: guardas, validación de reportes, tx de resolución (marca de
        // ocultamiento, bajas por REPORTE_FALSO, recálculo de visibilidad) y
        // auditoría viven en el DAL.
        const resultado = await new ComiteApelacionesService().resolver(
            id,
            { decision, motivacion, quitarVisibilidad, reportesABajar },
            { id: user.id, esComite: esComiteRol(user.rol) },
            getClientInfo(request),
            request
        );

        return NextResponse.json(resultado);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg === "REPORTE_NO_ENCONTRADO") {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        if (msg === "REPORTE_YA_ELIMINADO") {
            return NextResponse.json(
                { error: { message: "El reporte ya está dado de baja", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }
        logger.error("[ComiteApelaciones] Error resolviendo:", msg);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
