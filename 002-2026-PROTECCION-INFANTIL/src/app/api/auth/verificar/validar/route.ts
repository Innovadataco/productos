import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createToken } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as { email: string; codigo: string };
        const email = body.email?.toLowerCase().trim();

        if (!email || !body.codigo || body.codigo.length !== 6) {
            return NextResponse.json(
                { error: { message: "Email y código de 6 dígitos requeridos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const codeRecord = await prisma.codigoVerificacion.findFirst({
            where: { email, usado: false },
            orderBy: { creadoEn: "desc" },
        });

        if (!codeRecord || new Date() > codeRecord.expiraEn) {
            return NextResponse.json(
                { error: { message: "Código inválido o expirado", code: ERROR_CODES.AUTH_INVALID } },
                { status: 400 }
            );
        }

        if (codeRecord.intentosFallidos >= 5) {
            return NextResponse.json(
                { error: { message: "Máximo de intentos excedido", code: ERROR_CODES.AUTH_INVALID } },
                { status: 400 }
            );
        }

        const valid = await bcrypt.compare(body.codigo, codeRecord.codigoHash);
        if (!valid) {
            await prisma.codigoVerificacion.update({
                where: { id: codeRecord.id },
                data: { intentosFallidos: { increment: 1 } },
            });
            return NextResponse.json(
                { error: { message: "Código incorrecto", code: ERROR_CODES.AUTH_INVALID } },
                { status: 400 }
            );
        }

        await prisma.codigoVerificacion.update({
            where: { id: codeRecord.id },
            data: { usado: true },
        });

        const tempToken = await createToken({
            sub: email,
            type: "verification",
            exp: Math.floor(Date.now() / 1000) + 15 * 60,
        });

        return NextResponse.json({ valido: true, token: tempToken });
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