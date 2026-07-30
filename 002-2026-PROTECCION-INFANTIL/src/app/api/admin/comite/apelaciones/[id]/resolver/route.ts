import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, esComiteRol } from "@/lib/operadores/permisos";
import { logAudit } from "@/lib/audit";
import { darDeBajaReporte } from "@/lib/dal/services/reporte-lifecycle";
import { whereReporteVigente } from "@/lib/reportes-acceso";
import { actualizarVisibilidadPublica } from "@/lib/visibility";

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

        const apelacion = await prisma.apelacion.findUnique({
            where: { id },
            select: { id: true, numero: true, identificador: true, plataformaId: true, estado: true, comiteId: true },
        });
        if (!apelacion) {
            return NextResponse.json(
                { error: { message: "Apelación no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        if (apelacion.estado !== "EN_REVISION") {
            return NextResponse.json(
                { error: { message: "El caso debe estar en revisión para resolverse", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }
        if (esComiteRol(user.rol) && apelacion.comiteId !== user.id) {
            return NextResponse.json(
                { error: { message: "Solo el miembro del comité asignado puede resolver", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        // Validar que cada reporte a bajar pertenece al identificador + plataforma declarados.
        let reportesValidos: { id: string }[] = [];
        if (decision === "ACEPTADA" && reportesABajar.length > 0) {
            reportesValidos = await prisma.reporte.findMany({
                where: whereReporteVigente({
                    id: { in: reportesABajar },
                    identificador: apelacion.identificador,
                    plataformaId: apelacion.plataformaId,
                }),
                select: { id: true },
            });
            if (reportesValidos.length !== reportesABajar.length) {
                return NextResponse.json(
                    { error: { message: "Algún reporte no pertenece al identificador declarado o ya está dado de baja", code: ERROR_CODES.VALIDATION_ERROR } },
                    { status: 400 }
                );
            }
        }

        const ahora = new Date();
        const { ipAddress, userAgent } = getClientInfo(request);

        const reportesBajados = await prisma.$transaction(async (tx) => {
            const bajados: string[] = [];

            if (decision === "ACEPTADA") {
                if (quitarVisibilidad) {
                    // Marca del comité; si no hay agregado no hay nada que ocultar (no-op).
                    await tx.identificadorReportado.updateMany({
                        where: { identificador: apelacion.identificador, plataformaId: apelacion.plataformaId },
                        data: { ocultoPorComiteEn: ahora },
                    });
                }
                for (const rep of reportesValidos) {
                    await darDeBajaReporte({
                        reporteId: rep.id,
                        motivo: "REPORTE_FALSO",
                        nota: `Apelación ${apelacion.numero}: reporte declarado falso por el comité`,
                        adminId: user.id,
                        request,
                        tx,
                        accionAudit: "REPORT_DEACTIVATE",
                    });
                    bajados.push(rep.id);
                }
                // Recálculo final con la dueña única (efecto inmediato de la marca).
                await actualizarVisibilidadPublica(apelacion.identificador, apelacion.plataformaId, tx);
            }

            await tx.apelacion.update({
                where: { id },
                data: {
                    estado: decision,
                    decision,
                    motivacionResolucion: motivacion,
                    quitoVisibilidad: decision === "ACEPTADA" && quitarVisibilidad,
                    resueltoPorId: user.id,
                    resueltoEn: ahora,
                },
            });

            await logAudit({
                accion: "APELACION_RESUELTA",
                tipoRecurso: "Apelacion",
                recursoId: id,
                usuarioId: user.id,
                valorNuevo: JSON.stringify({
                    numero: apelacion.numero,
                    decision,
                    motivacion,
                    quitarVisibilidad: decision === "ACEPTADA" && quitarVisibilidad,
                    reportesBajados: bajados,
                }),
                ipAddress,
                userAgent,
                tx,
            });

            return bajados;
        });

        return NextResponse.json({
            apelacion: {
                id,
                numero: apelacion.numero,
                estado: decision,
                decision,
                quitoVisibilidad: decision === "ACEPTADA" && quitarVisibilidad,
                reportesBajados,
                resueltoEn: ahora,
            },
        });
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
