import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { enviarCodigoVerificacion } from "@/lib/email";
import { AppError, ERROR_CODES } from "@/lib/errors";

function generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
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

        const existingUser = await prisma.usuario.findUnique({ where: { email } });
        if (existingUser) {
            return NextResponse.json(
                { message: "Si el email es válido, recibirás un código de verificación." },
                { status: 202 }
            );
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

        try {
            await enviarCodigoVerificacion(email, code);
        } catch (err) {
            const masked = email.replace(/^(.{1})(.*)(@.*)$/, "$1***$3");
            console.error("Failed to send verification email to:", masked, "error:", err instanceof Error ? err.message : String(err));
            return NextResponse.json(
                { error: { message: "Error al enviar email de verificación", code: ERROR_CODES.INTERNAL_ERROR } },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { message: "Si el email es válido, recibirás un código de verificación." },
            { status: 202 }
        );
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