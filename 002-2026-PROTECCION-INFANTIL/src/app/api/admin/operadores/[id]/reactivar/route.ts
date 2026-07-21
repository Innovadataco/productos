import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { withValidation } from "@/lib/validation";
import { operadorIdParamsSchema } from "@/lib/schemas";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

async function getOperador(id: string) {
    const where: Record<string, unknown> = { id, rol: { in: ["OPERADOR", "COMITE_VALIDACION"] } };
    return prisma.usuario.findFirst({ where, include: { perfilOperador: true } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const { id } = withValidation.params(operadorIdParamsSchema)(await params);
        const operador = await getOperador(id);
        if (!operador) {
            return NextResponse.json(
                { error: { message: "Operador no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (operador.estado === "activo") {
            return NextResponse.json({ operador });
        }

        await prisma.usuario.update({ where: { id }, data: { estado: "activo" } });
        const { ipAddress, userAgent } = getClientInfo(request);
        const accionAudit = operador.rol === "COMITE_VALIDACION" ? "COMITE_ACTIVADO" : "OPERADOR_ACTIVADO";
        await logAudit({
            accion: accionAudit,
            tipoRecurso: "Usuario",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ estado: operador.estado }),
            valorNuevo: JSON.stringify({ estado: "activo" }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ operador: { ...operador, estado: "activo" } });
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
