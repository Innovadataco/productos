import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { withValidation } from "@/lib/validation";
import { operadorIdParamsSchema } from "@/lib/schemas";
import { OperadorService } from "@/lib/dal/services/operadores";
import { enviarEmailCambioPassword } from "@/lib/email";

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

        // SPEC-053: búsqueda, regeneración del password temporal y auditoría viven en
        // el DAL; la ruta no toca prisma.
        const service = new OperadorService();
        const operador = await service.obtenerOperador(id);
        if (!operador) {
            return NextResponse.json(
                { error: { message: "Operador no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const { password } = await service.regenerarPassword(operador, admin.id, getClientInfo(request), "regenerar");

        // SPEC-322 (camino 4): aviso al dueño de la cuenta cuando un admin le regenera la clave.
        try {
            await enviarEmailCambioPassword(operador.email);
        } catch {
            // fallo silencioso — el aviso no es bloqueante
        }

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
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
