import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { esAdminRol, esComiteRol } from "@/lib/operadores/permisos";

const asignarSchema = z.object({
    comiteId: z.string().optional(),
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
        const parsed = asignarSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        let comiteId = parsed.data.comiteId;
        if (esComiteRol(user.rol)) {
            comiteId = user.id;
        }
        if (!comiteId) {
            return NextResponse.json(
                { error: { message: "comiteId requerido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const solicitud = await prisma.solicitudComite.findUnique({
            where: { id },
            include: { reporte: true },
        });
        if (!solicitud) {
            return NextResponse.json(
                { error: { message: "Solicitud no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (solicitud.estado !== "PENDIENTE") {
            return NextResponse.json(
                { error: { message: "La solicitud ya fue asignada o resuelta", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const comite = await prisma.usuario.findFirst({
            where: { id: comiteId, rol: "COMITE_VALIDACION", estado: "activo" },
            include: { perfilOperador: { select: { esComite: true } } },
        });
        if (!comite || !comite.perfilOperador?.esComite) {
            return NextResponse.json(
                { error: { message: "Miembro del comité no encontrado o inactivo", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (user.rol === "SCHOOL_ADMIN" && solicitud.reporte.tenantId && solicitud.reporte.tenantId !== user.tenantId) {
            return NextResponse.json(
                { error: { message: "No tenés permiso para asignar esta solicitud", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        await prisma.$transaction([
            prisma.solicitudComite.update({
                where: { id },
                data: { estado: "ASIGNADA", comiteId },
            }),
            prisma.reporte.update({
                where: { id: solicitud.reporteId },
                data: { comiteId },
            }),
        ]);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "OPERADOR_ASIGNADO",
            tipoRecurso: "SolicitudComite",
            recursoId: id,
            usuarioId: user.id,
            valorNuevo: JSON.stringify({ comiteId, solicitudId: id }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({
            solicitudId: id,
            numero: solicitud.numero,
            estado: "ASIGNADA",
            comiteId,
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
