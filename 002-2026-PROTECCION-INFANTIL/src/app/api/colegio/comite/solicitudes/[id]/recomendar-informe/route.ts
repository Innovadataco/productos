/**
 * SPEC-380 (PR A · C4) — POST /api/colegio/comite/solicitudes/[id]/recomendar-informe.
 *
 * El comité le SEÑALA al rector que, a su juicio, conviene emitir el informe
 * del caso. Marca una fecha en `SolicitudComite.recomendacionInformeEn` y le
 * notifica al rector por el motor de notificaciones (SPEC-201): in-app siempre
 * y correo si sus preferencias lo permiten. El fallo del correo (p. ej. Resend
 * en cuota) NO rompe la acción — la marca queda y el aviso in-app también.
 *
 * Voz: usted formal Colombia. El texto es una RECOMENDACIÓN — el que firma
 * el informe sigue siendo el rector.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { cuidIdSchema } from "@/lib/schemas";
import { ComiteConvivenciaSolicitudesRepository } from "@/lib/dal/repositories/comite-convivencia-solicitudes";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { enviarRecomendacionInformeAlRector } from "@/lib/email-colegio";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("COMITE_CONVIVENCIA");
        await assertModulo(user, "colegios_comite_bandeja");
        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }
        if (!user.comiteColegioId) {
            return NextResponse.json(
                { error: { message: "Cuenta del comité no vinculada a un colegio.", code: ERROR_CODES.FORBIDDEN } },
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

        const { id } = withValidation.params(z.object({ id: cuidIdSchema }))(await params);

        const repo = new ComiteConvivenciaSolicitudesRepository();
        const solicitud = await repo.obtenerParaRecomendacion(id, user.comiteColegioId);
        if (!solicitud) {
            return NextResponse.json(
                { error: { message: "Caso no encontrado.", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        if (solicitud.estado !== "PENDIENTE") {
            return NextResponse.json(
                { error: { message: "Este caso ya está resuelto — no hace falta recomendar.", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }
        if (!solicitud.analisis || solicitud.analisis.trim() === "") {
            return NextResponse.json(
                { error: { message: "Guarde primero el análisis del comité antes de recomendar.", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const ahora = new Date();
        const actualizada = await repo.marcarRecomendacion(id, ahora, user.id);

        const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
        const userAgent = request.headers.get("user-agent") || "unknown";
        await logAudit({
            accion: "COMITE_RECOMENDACION_INFORME",
            tipoRecurso: "SolicitudComite",
            recursoId: id,
            usuarioId: user.id,
            colegioId: user.comiteColegioId,
            valorNuevo: JSON.stringify({ numero: solicitud.numero, recomendadoEn: ahora.toISOString() }),
            ipAddress,
            userAgent,
        });

        // Aviso al rector del colegio. Reusa SPEC-201 (motor de notificaciones):
        // el propio motor respeta `notificacion_preferencias` y quiet hours de
        // cada canal. Si Resend está en cuota (o el correo falla por cualquier
        // razón), la acción NO se rompe — la recomendación quedó en la BD y
        // el aviso in-app se registra igual.
        try {
            const rectores = await new UsuarioRepository().listarAdminsColegioActivos(user.comiteColegioId);
            if (rectores.length > 0) {
                await enviarRecomendacionInformeAlRector(rectores, {
                    nombreColegio: solicitud.colegio?.nombre ?? "su colegio",
                    numeroCaso: solicitud.numero,
                    solicitudId: solicitud.id,
                });
            }
        } catch (err) {
            // Log en warn — el fallo del aviso no debe reventar la recomendación
            // (regla dura del CEO: "que el fallo de correo no rompa la acción").
            logger.warn("[COMITE/RECOMENDAR-INFORME] Aviso al rector falló", {
                solicitudId: id,
                error: err instanceof Error ? err.message : String(err),
            });
        }

        return NextResponse.json(actualizada);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return errorToResponse(error, "[COLEGIO/COMITE/RECOMENDAR-INFORME]");
    }
}
