import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { registrarTransicion, responsableTipoFromRol } from "@/lib/reporte-transiciones";
import { esAdminRol, esComiteRol } from "@/lib/operadores/permisos";
import { actualizarVisibilidadPublica } from "@/lib/visibility";
import { recalcularYGuardarScore } from "@/lib/scoring";
import type { CategoriaConducta } from "@prisma/client";

const resolverSchema = z.object({
    accion: z.enum(["CLASIFICAR", "CORREGIR"]),
    categoria: z.enum([
        "CONTACTO_INSISTENTE",
        "SOLICITUD_MATERIAL",
        "OFRECIMIENTO_REGALOS",
        "SUPLANTACION_IDENTIDAD",
        "SOLICITUD_ENCUENTRO",
        "COMPARTIMIENTO_SEXUAL",
        "EXTORSION",
        "CONTENIDO_GENERADO_IA",
        "DIFUSION_NO_CONSENTIDA",
        "DOXING",
        "OTRO",
    ]),
    resolucion: z.string().max(4000).optional(),
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
        const { accion, categoria, resolucion } = parsed.data;

        const solicitud = await prisma.solicitudComite.findUnique({
            where: { id },
            include: { reporte: { include: { clasificacion: true } } },
        });
        if (!solicitud) {
            return NextResponse.json(
                { error: { message: "Solicitud no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (solicitud.estado !== "ASIGNADA") {
            return NextResponse.json(
                { error: { message: "La solicitud debe estar asignada para resolverse", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        if (esComiteRol(user.rol) && solicitud.comiteId !== user.id) {
            return NextResponse.json(
                { error: { message: "Solo el miembro del comité asignado puede resolver", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        if (user.rol === "SCHOOL_ADMIN" && solicitud.reporte.tenantId && solicitud.reporte.tenantId !== user.tenantId) {
            return NextResponse.json(
                { error: { message: "No tienes permiso para resolver esta solicitud", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const reporte = solicitud.reporte;
        if (!reporte.clasificacion) {
            return NextResponse.json(
                { error: { message: "El reporte no tiene clasificación", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const estadoAnterior = reporte.estado;
        const estadoNuevo = accion === "CLASIFICAR" ? "CLASIFICADO" : "CORREGIDO";
        const responsableTipo = responsableTipoFromRol(user.rol) ?? "ADMIN";

        await prisma.$transaction(async (tx) => {
            if (accion === "CORREGIR") {
                const correccionExistente = await tx.correccionAdmin.findUnique({
                    where: { clasificacionId: reporte.clasificacion!.id },
                });
                if (correccionExistente) {
                    throw new AppError("Este reporte ya fue corregido", ERROR_CODES.CONFLICT, 409);
                }
                await tx.correccionAdmin.create({
                    data: {
                        clasificacionId: reporte.clasificacion!.id,
                        categoriaOriginal: reporte.clasificacion!.categoria,
                        categoriaCorregida: categoria as CategoriaConducta,
                        adminId: user.id,
                        motivo: resolucion || null,
                        confirmada: true,
                    },
                });
                await tx.clasificacionIA.update({
                    where: { reporteId: reporte.id },
                    data: { categoria: categoria as CategoriaConducta, confianza: 1.0 },
                });
            } else if (categoria !== reporte.clasificacion!.categoria) {
                await tx.clasificacionIA.update({
                    where: { reporteId: reporte.id },
                    data: { categoria: categoria as CategoriaConducta, confianza: 1.0 },
                });
            }

            await registrarTransicion({
                reporteId: reporte.id,
                estadoAnterior,
                estadoNuevo,
                responsableTipo,
                responsableId: user.id,
                motivo: resolucion || `Caso resuelto por comité: ${accion}`,
                metadatos: { accion: "CASO_RESUELTO_POR_COMITE", solicitudId: id, numero: solicitud.numero },
                tx,
            });
            await tx.reporte.update({
                where: { id: reporte.id },
                data: { estado: estadoNuevo },
            });
            await tx.solicitudComite.update({
                where: { id },
                data: { estado: "RESUELTA", resolucion: resolucion || null, resueltoEn: new Date() },
            });
        });

        await actualizarVisibilidadPublica(reporte.identificador, reporte.plataformaId);
        const scoreResult = await recalcularYGuardarScore(reporte.identificador, reporte.plataformaId);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "CASO_RESUELTO_POR_COMITE",
            tipoRecurso: "SolicitudComite",
            recursoId: id,
            usuarioId: user.id,
            valorNuevo: JSON.stringify({ accion, categoria, resolucion: resolucion || null, estadoNuevo }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({
            solicitudId: id,
            numero: solicitud.numero,
            estado: "RESUELTA",
            reporte: {
                id: reporte.id,
                estado: estadoNuevo,
                categoria,
            },
            score: scoreResult.score,
            nivelRiesgo: scoreResult.nivelRiesgo,
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
