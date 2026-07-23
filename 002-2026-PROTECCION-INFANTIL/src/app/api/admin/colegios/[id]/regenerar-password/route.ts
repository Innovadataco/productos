import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth, hashPassword } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { withValidation } from "@/lib/validation";
import { colegioIdParamsSchema } from "@/lib/schemas";
import { randomBytes } from "crypto";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "colegios_gestion");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const { id } = withValidation.params(colegioIdParamsSchema)(await params);

        const colegio = await prisma.colegio.findUnique({
            where: { id },
            include: { admin: { select: { id: true, email: true, nombre: true, estado: true, debeCambiarPassword: true } } },
        });
        if (!colegio) {
            return NextResponse.json(
                { error: { message: "Colegio no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        if (!colegio.admin) {
            return NextResponse.json(
                { error: { message: "El colegio no tiene un administrador asignado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        // La contraseña temporal solo se devuelve en esta respuesta (una sola vez):
        // nunca se persiste en claro ni se registra en logs/auditoría.
        const password = randomBytes(6).toString("hex");
        const passwordHash = await hashPassword(password);

        await prisma.usuario.update({
            where: { id: colegio.admin.id },
            data: { passwordHash, debeCambiarPassword: true },
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_PASSWORD_REGENERADA",
            tipoRecurso: "Colegio",
            recursoId: colegio.id,
            usuarioId: admin.id,
            colegioId: colegio.id,
            valorAnterior: JSON.stringify({ debeCambiarPassword: colegio.admin.debeCambiarPassword }),
            valorNuevo: JSON.stringify({ debeCambiarPassword: true, email: colegio.admin.email }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({
            colegio: { id: colegio.id, nombre: colegio.nombre },
            admin: { id: colegio.admin.id, email: colegio.admin.email, debeCambiarPassword: true },
            passwordTemporal: password,
            mensaje: "Contraseña temporal regenerada. Muéstrela una vez al administrador del colegio.",
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
