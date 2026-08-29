import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { ConfiguracionService } from "@/lib/dal/services/configuracion";

type RouteContext = { params: Promise<{ clave: string }> };

export async function POST(request: Request, context: RouteContext) {
    try {
        await assertModulo(await verifyAuth("ADMIN" as never), "configuracion_sistema");
        const rate = await checkRateLimit(request, "admin_read");
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429 }
            );
        }

        const { clave } = await context.params;

        // SPEC-053: la lectura y el descifrado del secreto viven en el DAL; la ruta no toca prisma.
        const resultado = await new ConfiguracionService().revelar(clave);
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
