import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { withValidation } from "@/lib/validation";
import { operadorIdParamsSchema } from "@/lib/schemas";
import { OperadorService } from "@/lib/dal/services/operadores";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "operadores");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const { id } = withValidation.params(operadorIdParamsSchema)(await params);

        // SPEC-053: búsqueda, reactivación y auditoría viven en el DAL; la ruta no toca prisma.
        const service = new OperadorService();
        const operador = await service.obtenerOperador(id);
        if (!operador) {
            return NextResponse.json(
                { error: { message: "Operador no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (operador.estado === "activo") {
            return NextResponse.json({ operador });
        }

        await service.reactivar(operador, admin.id, getClientInfo(request));

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
