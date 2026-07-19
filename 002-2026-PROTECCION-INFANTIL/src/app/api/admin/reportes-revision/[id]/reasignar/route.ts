import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { obtenerConfigAsignacion } from "@/lib/operadores/asignador";

const reasignarSchema = z.object({
    operadorId: z.string().min(1),
});

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth(["ADMIN", "SCHOOL_ADMIN"]);
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const { id } = await params;

        const body = await request.json();
        const parsed = reasignarSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "operadorId requerido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

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

        if (reporte.estado !== "REVISION_MANUAL") {
            return NextResponse.json(
                { error: { message: "Solo se pueden reasignar reportes en revisión manual", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 409 }
            );
        }

        const operadorWhere: Record<string, unknown> = {
            id: parsed.data.operadorId,
            rol: "OPERADOR",
            estado: "activo",
        };
        if (admin.rol === "SCHOOL_ADMIN") {
            operadorWhere.tenantId = admin.tenantId ?? null;
        }
        const operador = await prisma.usuario.findFirst({
            where: operadorWhere,
            include: { perfilOperador: { select: { cupoMaximo: true } } },
        });

        if (!operador || !operador.perfilOperador) {
            return NextResponse.json(
                { error: { message: "Operador no encontrado o inactivo", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const [casosAbiertos, config] = await Promise.all([
            prisma.reporte.count({
                where: { operadorId: operador.id, estado: "REVISION_MANUAL", eliminado: false },
            }),
            obtenerConfigAsignacion(),
        ]);
        const cupoMaximo = operador.perfilOperador.cupoMaximo ?? config.cupoDefault;
        if (casosAbiertos >= cupoMaximo) {
            return NextResponse.json(
                { error: { message: "El operador seleccionado está al cupo máximo", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 409 }
            );
        }

        await prisma.reporte.update({
            where: { id },
            data: { operadorId: operador.id },
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "OPERADOR_REASIGNADO",
            tipoRecurso: "Reporte",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ operadorId: reporte.operadorId }),
            valorNuevo: JSON.stringify({ operadorId: operador.id, operadorEmail: operador.email, operadorNombre: operador.nombre }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({
            reporteId: id,
            operadorId: operador.id,
            operadorEmail: operador.email,
            operadorNombre: operador.nombre,
        });
    } catch (error) {
        if (error instanceof Error && "code" in error && typeof error.code === "string") {
            return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: 403 });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
