import { NextResponse } from "next/server";
import { verifyAuth, verifyToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { SessionLogService } from "@/lib/dal/services/session-log";
import { AppError, ERROR_CODES } from "@/lib/errors";

export async function POST(request: Request) {
    try {
        const rate = await checkRateLimit(request, "session_ping");
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiados pings. Intenta más tarde.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const user = await verifyAuth();

        const cookieHeader = request.headers.get("cookie") ?? "";
        const match = cookieHeader.match(/(?:__Host-)?token=([^;]+)/);
        const payload = match ? await verifyToken(match[1]) : null;
        const sesionLogId = payload && typeof payload.sesionLogId === "string" ? payload.sesionLogId : undefined;

        if (!sesionLogId) {
            // Token previo sin sesionLogId: no hay nada que actualizar, pero no es error.
            return NextResponse.json({ ok: true });
        }

        const actualizado = await new SessionLogService().pingSesion(sesionLogId, user.id);
        if (!actualizado) {
            return NextResponse.json(
                { error: { message: "Sesión cerrada o inválida", code: ERROR_CODES.AUTH_INVALID } },
                { status: 401 }
            );
        }

        return NextResponse.json({ ok: true });
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
