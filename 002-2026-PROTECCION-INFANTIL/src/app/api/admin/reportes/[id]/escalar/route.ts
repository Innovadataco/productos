import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { registrarTransicion } from "@/lib/reporte-transiciones";
import { esAdminRol } from "@/lib/operadores/permisos";
import { randomBytes } from "crypto";

const escalarSchema = z.object({
    motivo: z.string().min(5).max(4000),
});

function numeroSolicitud() {
    return `SOL-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        if (!esAdminRol(user.rol) && user.rol !== "OPERADOR") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Esperá un momento.", code: ERROR_CODES.RATE_LIMITED } },
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
        const parsed = escalarSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Motivo inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { motivo } = parsed.data;

        const reporte = await prisma.reporte.findUnique({
            where: { id },
            select: { id: true, estado: true, operadorId: true, tenantId: true },
        });
        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (user.rol === "OPERADOR" && reporte.operadorId !== user.id) {
            return NextResponse.json(
                { error: { message: "Solo el operador asignado puede escalar este caso", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        if (user.rol === "SCHOOL_ADMIN" && reporte.tenantId && reporte.tenantId !== user.tenantId) {
            return NextResponse.json(
                { error: { message: "No tenés permiso para escalar este caso", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        if (reporte.estado !== "REVISION_MANUAL") {
            return NextResponse.json(
                { error: { message: "Solo se pueden escalar casos en revisión manual", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 409 }
            );
        }

        const solicitudExistente = await prisma.solicitudComite.findUnique({
            where: { reporteId: id },
        });
        if (solicitudExistente) {
            return NextResponse.json(
                { error: { message: "Este caso ya fue escalado al comité", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        let numero = numeroSolicitud();
        while (await prisma.solicitudComite.findUnique({ where: { numero } })) {
            numero = numeroSolicitud();
        }

        const estadoAnterior = reporte.estado;
        const [solicitud] = await prisma.$transaction(async (tx) => {
            const solicitud = await tx.solicitudComite.create({
                data: {
                    reporteId: id,
                    numero,
                    estado: "PENDIENTE",
                    operadorId: user.id,
                    motivo,
                },
            });
            await tx.reporte.update({
                where: { id },
                data: { operadorId: null, comiteId: null },
            });
            await registrarTransicion({
                reporteId: id,
                estadoAnterior,
                estadoNuevo: "REVISION_MANUAL",
                responsableTipo: "OPERADOR",
                responsableId: user.id,
                motivo: `Caso escalado al comité: ${motivo}`,
                metadatos: { accion: "CASO_ESCALADO", numeroSolicitud: numero },
                tx,
            });
            return [solicitud];
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "CASO_ESCALADO",
            tipoRecurso: "Reporte",
            recursoId: id,
            usuarioId: user.id,
            valorNuevo: JSON.stringify({ solicitudId: solicitud.id, numero, motivo }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({
            solicitudId: solicitud.id,
            numero: solicitud.numero,
            reporteId: id,
            estado: "PENDIENTE",
        }, { status: 201 });
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
