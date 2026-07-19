import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth, hashPassword } from "@/lib/auth";
import { ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { enviarEmailBienvenidaOperador, enviarEmailBienvenidaComite } from "@/lib/email";
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
        const esComite = operador.rol === "COMITE_VALIDACION";
        const accionAudit = esComite ? "COMITE_EMAIL_REENVIADO" : "OPERADOR_EMAIL_REENVIADO";
        await logAudit({
            accion: accionAudit,
            tipoRecurso: "Usuario",
            recursoId: id,
            usuarioId: admin.id,
            valorNuevo: JSON.stringify({ email: operador.email }),
            ipAddress,
            userAgent,
        });

        let emailEnviado = false;
        try {
            await (esComite ? enviarEmailBienvenidaComite : enviarEmailBienvenidaOperador)(operador.email, password);
            emailEnviado = true;
        } catch (err) {
            console.error(`[OPERADORES] Error reenviando email de bienvenida a ${esComite ? "comité" : "operador"}`, err);
        }

        return NextResponse.json({
            operador: {
                id: operador.id,
                email: operador.email,
                nombre: operador.nombre,
                estado: operador.estado,
                debeCambiarPassword: true,
            },
            passwordTemporal: emailEnviado ? undefined : password,
            emailEnviado,
            mensaje: emailEnviado
                ? `Email de bienvenida reenviado al ${esComite ? "comité de validación" : "operador"}.`
                : "No se pudo reenviar el email. Copie la contraseña temporal mostrada arriba.",
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
