import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { enviarTokenRecuperacion } from "@/lib/email";
import { generarTokenRecuperacion, hashToken } from "@/lib/token-recuperacion";

const MENSAJE_EXITO = "Si el email está registrado, recibirás un enlace para restablecer tu contraseña.";
const LIMITE_SOLICITUDES = 3;
const VENTANA_MS = 60 * 60 * 1000;
const EXPIRACION_TOKEN_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as { email?: string };
        const email = body.email?.toLowerCase().trim();

        if (!email || !email.includes("@")) {
            return NextResponse.json(
                { error: { message: "Email inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
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
            try {
                await enviarTokenRecuperacion(email, token);
                emailSent = true;
            } catch (err) {
                const masked = email.replace(/^(.{1})(.*)(@.*)$/, "$1***$3");
                console.error("Failed to send recovery email to:", masked, "error:", err instanceof Error ? err.message : String(err));
                if (process.env.NODE_ENV === "production") {
                    return NextResponse.json(
                        { error: { message: "Error al enviar email de recuperación", code: ERROR_CODES.INTERNAL_ERROR } },
                        { status: 500 }
                    );
                }
            }

            const isDev = process.env.NODE_ENV !== "production";
            const response: Record<string, unknown> = { message: MENSAJE_EXITO, emailSent };
            if (isDev) {
                response.devToken = token;
                console.log(`[DEV] Token de recuperación para ${email}: ${token}`);
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
