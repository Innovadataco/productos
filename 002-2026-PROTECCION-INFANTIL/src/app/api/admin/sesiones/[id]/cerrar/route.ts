import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { RolUsuario } from "@prisma/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { SessionLogService } from "@/lib/dal/services/session-log";
import { AppError, ERROR_CODES } from "@/lib/errors";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
    try {
        const rate = await checkRateLimit(request, "admin_write");
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const admin = await assertModulo(await verifyAuth(RolUsuario.ADMIN), "sesiones_admin");
        const { id } = await params;

        await new SessionLogService().cerrarForzado(id, admin.id, request);
        return NextResponse.json({ ok: true, sesionId: id });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        const message = error instanceof Error ? error.message : "Error desconocido";
        if (message.includes("no encontrada") || message.includes("ya cerrada")) {
            return NextResponse.json(
                { error: { message, code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
