import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { enviarTokenRecuperacion } from "@/lib/email";
import { generarTokenRecuperacion, hashToken } from "@/lib/token-recuperacion";
import { checkRateLimit } from "@/lib/rate-limit";
import { recuperarSolicitarSchema } from "@/lib/validators";

const MENSAJE_EXITO = "Si el email está registrado, recibirás un enlace para restablecer tu contraseña.";
const LIMITE_SOLICITUDES = 3;
const VENTANA_MS = 60 * 60 * 1000;
const EXPIRACION_TOKEN_MS = 60 * 60 * 1000;

function buildRateLimitResponse(retryAfter: number, headers: Record<string, string>) {
    return NextResponse.json(
        {
            message: MENSAJE_EXITO,
            emailSent: false,
            error: { message: "Demasiadas solicitudes. Intenta más tarde.", code: ERROR_CODES.RATE_LIMITED, retryAfter },
        },
        { status: 429, headers }
    );
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = recuperarSolicitarSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Email inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const email = parsed.data.email.toLowerCase().trim();

        // Rate limit por IP
        const rateIp = await checkRateLimit(request, "recuperar_solicitar");
        if (!rateIp.allowed) {
            const retryAfter = Math.ceil((rateIp.resetAt - Date.now()) / 1000);
            return buildRateLimitResponse(retryAfter, rateIp.headers);
        }

        // Rate limit por email (identificador)
        const rateEmail = await checkRateLimit(request, "recuperar_solicitar", { identifier: email });
        if (!rateEmail.allowed) {
            const retryAfter = Math.ceil((rateEmail.resetAt - Date.now()) / 1000);
            return buildRateLimitResponse(retryAfter, rateEmail.headers);
        }

        const usuario = await prisma.usuario.findUnique({ where: { email } });

        if (usuario) {
            const desde = new Date(Date.now() - VENTANA_MS);
            const activosRecientes = await prisma.tokenRecuperacion.count({
                where: {
                    email,
                    creadoEn: { gte: desde },
                    usado: false,
                    expiraEn: { gt: new Date() },
                },
            });

            if (activosRecientes >= LIMITE_SOLICITUDES) {
                return NextResponse.json(
                    { error: { message: "Límite de solicitudes excedido. Intenta más tarde.", code: ERROR_CODES.RATE_LIMITED } },
                    { status: 429 }
                );
            }

            // Invalidar tokens previos no usados para este usuario/email
            await prisma.tokenRecuperacion.updateMany({
                where: { email, usado: false },
                data: { usado: true },
            });

            const token = generarTokenRecuperacion();
            const tokenHash = await hashToken(token);

            await prisma.tokenRecuperacion.create({
                data: {
                    email,
                    tokenHash,
                    expiraEn: new Date(Date.now() + EXPIRACION_TOKEN_MS),
                    usuarioId: usuario.id,
                },
            });

            let emailSent = false;
            let emailError: string | null = null;
            try {
                await enviarTokenRecuperacion(email, token);
                emailSent = true;
            } catch (err) {
                const masked = email.replace(/^(.{1})(.*)(@.*)$/, "$1***$3");
                emailError = err instanceof Error ? err.message : String(err);
                console.error("Failed to send recovery email to:", masked, "error:", emailError);
            }

            const response: Record<string, unknown> = {
                message: MENSAJE_EXITO,
                emailSent,
            };

            // Si no se pudo enviar el email, exponemos el token para que el usuario pueda continuar
            // (útil en entornos sin Resend configurado o en modo desarrollo)
            if (!emailSent) {
                response.devToken = token;
                if (emailError) response.emailError = emailError;
            }
            return NextResponse.json(response, { status: 200 });
        }

        // Email no registrado: respuesta idéntica para evitar enumeración
        return NextResponse.json({ message: MENSAJE_EXITO, emailSent: false }, { status: 200 });
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
