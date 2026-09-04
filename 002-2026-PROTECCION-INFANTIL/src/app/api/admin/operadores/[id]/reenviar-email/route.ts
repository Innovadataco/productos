import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { enviarEmailBienvenidaOperador, enviarEmailBienvenidaComite } from "@/lib/email";
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

        // SPEC-053: búsqueda, regeneración del password temporal y auditoría viven en
        // el DAL; la ruta no toca prisma. El email queda en su adaptador.
        const service = new OperadorService();
        const operador = await service.obtenerOperador(id);
        if (!operador) {
            return NextResponse.json(
                { error: { message: "Operador no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const { password } = await service.regenerarPassword(operador, admin.id, getClientInfo(request), "reenviar");

        const esComite = operador.rol === "COMITE_VALIDACION";
        let emailEnviado = false;
        try {
            await (esComite ? enviarEmailBienvenidaComite : enviarEmailBienvenidaOperador)(operador.email, password);
            emailEnviado = true;
        } catch (err) {
            logger.error(`[OPERADORES] Error reenviando email de bienvenida a ${esComite ? "comité" : "operador"}`, err);
        }

        return NextResponse.json({
            operador: {
                id: operador.id,
                email: operador.email,
                nombre: operador.nombre,
                estado: operador.estado,
                debeCambiarPassword: true,
            },
            // SPEC-423 (I-298): la temporal SIEMPRE viaja en la respuesta —
            // `emailEnviado` mide encolado en el motor de notif (SPEC-296),
            // no entrega real, así que no puede decidir si mostrar la clave.
            passwordTemporal: password,
            encolado: emailEnviado,
            mensaje: emailEnviado
                ? `Contraseña temporal regenerada. Envío por correo al ${esComite ? "comité de validación" : "operador"} encolado — puede no llegar (proveedor asíncrono). La temporal está abajo (se muestra una sola vez).`
                : "Contraseña temporal regenerada. No se pudo encolar el envío por correo. Copie la temporal y compártala manualmente (se muestra una sola vez).",
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
