/**
 * SPEC-435 · listado + alta de cuentas VERIFICADOR (patrón operadores).
 *
 * Contrato Jelkin (vivo 04-09): al crear la cuenta, la contraseña temporal
 * SIEMPRE viaja en la respuesta como `passwordTemporal` — el admin la lee en
 * pantalla y se la pasa al verificador. El envío por correo es cortesía; si
 * falla, la clave sigue disponible en la misma respuesta.
 *
 * Guardia: `assertModulo(admin, "verificadores_admin")`. Módulo nuevo, default
 * SOLO ADMIN. La cuenta creada no hereda módulos de admin — solo lo que el rol
 * VERIFICADOR ya tiene sembrado (`admin_verificacion_profesionales`).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { enviarEmailBienvenidaOperador } from "@/lib/email";
import { VerificadorService } from "@/lib/dal/services/verificadores";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

const crearSchema = z.object({
    email: z.string().email(),
    nombre: z.string().min(2).max(100),
});

export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "verificadores_admin");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers },
            );
        }
        const verificadores = await new VerificadorService().listar();
        return NextResponse.json({ verificadores });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/VERIFICADORES]");
    }
}

export async function POST(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "verificadores_admin");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers },
            );
        }
        const body = await request.json().catch(() => ({}));
        const parsed = crearSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 },
            );
        }

        const { verificador, password } = await new VerificadorService().crear(parsed.data, admin.id, getClientInfo(request));

        let emailEnviado = false;
        try {
            await enviarEmailBienvenidaOperador(verificador.email, password);
            emailEnviado = true;
        } catch (err) {
            logger.error("[ADMIN/VERIFICADORES] envío de bienvenida falló", err);
        }

        return NextResponse.json({
            verificador,
            // SPEC-435 · contrato Jelkin: la contraseña temporal SIEMPRE viaja en la respuesta
            // del alta. El correo es cortesía; si falla, el admin la lee en pantalla.
            passwordTemporal: password,
            emailEnviado,
            mensaje: emailEnviado
                ? "Verificador creado. Se envió la contraseña temporal por email."
                : "Verificador creado. No se pudo enviar el email; copie la contraseña temporal que se muestra arriba.",
        }, { status: 201 });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/VERIFICADORES]");
    }
}
