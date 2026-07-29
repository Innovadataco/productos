import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createToken } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { verificarValidarSchema } from "@/lib/validators";

export async function POST(request: Request) {
    try {
        // SPEC-125: esquema Zod; el mensaje es contrato del frontend (registro/page.tsx).
        const bodyRaw = await request.json().catch(() => undefined);
        const parsed = verificarValidarSchema.safeParse(bodyRaw);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Email y código de 6 dígitos requeridos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { email, codigo } = parsed.data;

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

        const valid = await bcrypt.compare(codigo, codeRecord.codigoHash);
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