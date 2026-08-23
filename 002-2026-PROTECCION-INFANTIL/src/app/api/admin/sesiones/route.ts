import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { RolUsuario } from "@prisma/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { SessionLogService } from "@/lib/dal/services/session-log";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { clampPage, clampPageSize } from "@/lib/pagination";

export async function GET(request: Request) {
    try {
        const rate = await checkRateLimit(request, "admin_read");
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        await assertModulo(await verifyAuth(RolUsuario.ADMIN), "sesiones_admin");

        const { searchParams } = new URL(request.url);
        const page = clampPage(searchParams.get("page"));
        const pageSize = clampPageSize(searchParams.get("pageSize"));

        const resultado = await new SessionLogService().listarActivas(page, pageSize);
        return NextResponse.json(resultado);
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
