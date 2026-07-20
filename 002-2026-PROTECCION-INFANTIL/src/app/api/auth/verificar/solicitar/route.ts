import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { enviarCodigoVerificacion } from "@/lib/email";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";

function generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

const MENSAJE_EXITO = "Si el email es válido, recibirás un código de verificación.";

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
        const body = (await request.json()) as { email: string };
        const email = body.email?.toLowerCase().trim();

        if (!email || !email.includes("@")) {
            return NextResponse.json(
                { error: { message: "Email inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // Rate limit por IP
        const rateIp = await checkRateLimit(request, "verificacion_solicitar");
        if (!rateIp.allowed) {
            const retryAfter = Math.ceil((rateIp.resetAt - Date.now()) / 1000);
            return buildRateLimitResponse(retryAfter, rateIp.headers);
        }

        // Rate limit por email (identificador)
        const rateEmail = await checkRateLimit(request, "verificacion_solicitar", { identifier: email });
        if (!rateEmail.allowed) {
            const retryAfter = Math.ceil((rateEmail.resetAt - Date.now()) / 1000);
            return buildRateLimitResponse(retryAfter, rateEmail.headers);
        }

        const existingUser = await prisma.usuario.findUnique({ where: { email } });
        if (existingUser) {
            return NextResponse.json({ message: MENSAJE_EXITO }, { status: 202 });
        }

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentCodes = await prisma.codigoVerificacion.count({
            where: {
                email,
                creadoEn: { gte: oneHourAgo },
                usado: false,
            },
        });

        if (recentCodes >= 3) {
            return NextResponse.json(
                { error: { message: "Límite de solicitudes excedido", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429 }
            );
        }

        const code = generateCode();
        const codeHash = await bcrypt.hash(code, 12);

        await prisma.codigoVerificacion.create({
            data: {
                email,
                codigoHash: codeHash,
                expiraEn: new Date(Date.now() + 15 * 60 * 1000),
            },
        });

        let emailSent = false;
        let emailError: string | null = null;
        try {
            await enviarCodigoVerificacion(email, code);
            emailSent = true;
        } catch (err) {
            const masked = email.replace(/^(.{1})(.*)(@.*)$/, "$1***$3");
            emailError = err instanceof Error ? err.message : String(err);
            console.error("Failed to send verification email to:", masked, "error:", emailError);
        }

        const response: Record<string, unknown> = {
            message: emailSent
                ? MENSAJE_EXITO
                : "El servicio de email no está disponible; usa el código mostrado para continuar.",
            emailSent,
        };

        // Si no se pudo enviar el email, exponemos el código para que el usuario pueda continuar
        // (útil en entornos sin Resend configurado o en modo desarrollo)
        if (!emailSent) {
            response.devCode = code;
            if (emailError) response.emailError = emailError;
        }

        return NextResponse.json(response, { status: 202 });
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
