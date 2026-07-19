import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth, hashPassword } from "@/lib/auth";
import { ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { randomBytes } from "crypto";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

async function getOperador(id: string, admin: { id: string; rol: string; tenantId: string | null }) {
    const where: Record<string, unknown> = { id, rol: { in: ["OPERADOR", "COMITE_VALIDACION"] } };
    if (admin.rol === "SCHOOL_ADMIN") {
        where.tenantId = admin.tenantId ?? null;
    }
    return prisma.usuario.findFirst({ where, include: { perfilOperador: true } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth(["ADMIN", "SCHOOL_ADMIN"]);
        const { id } = await params;
        const operador = await getOperador(id, admin);
        if (!operador) {
            return NextResponse.json(
                { error: { message: "Operador no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const password = randomBytes(6).toString("hex");
        const passwordHash = await hashPassword(password);

        await prisma.usuario.update({
            where: { id },
            data: { passwordHash, debeCambiarPassword: true },
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        const accionAudit = operador.rol === "COMITE_VALIDACION" ? "COMITE_PASSWORD_REGENERADA" : "OPERADOR_PASSWORD_REGENERADA";
        await logAudit({
            accion: accionAudit,
            tipoRecurso: "Usuario",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ debeCambiarPassword: operador.debeCambiarPassword }),
            valorNuevo: JSON.stringify({ debeCambiarPassword: true }),
            ipAddress,
            userAgent,
        });

        const esComite = operador.rol === "COMITE_VALIDACION";
        return NextResponse.json({
            operador: {
                id: operador.id,
                email: operador.email,
                nombre: operador.nombre,
                estado: operador.estado,
                debeCambiarPassword: true,
            },
            passwordTemporal: password,
            mensaje: esComite
                ? "Contraseña temporal regenerada. Muéstrela una vez al comité de validación."
                : "Contraseña temporal regenerada. Muéstrela una vez al operador.",
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
