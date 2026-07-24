import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getParametroSistema } from "@/lib/parametros";

const schemaBase = z.object({
    passwordActual: z.string().min(1),
    passwordNueva: z.string().max(100),
});

export async function POST(request: Request) {
    try {
        const user = await verifyAuth();
        const body = await request.json();
        const parsed = schemaBase.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const { passwordActual, passwordNueva } = parsed.data;

        // Spec 095-US2: longitud mínima de contraseña desde parámetro (security.password_min_length, fallback 8)
        const paramMin = await getParametroSistema("security.password_min_length");
        const minLength = parseInt(paramMin?.valor ?? "8", 10);
        if (passwordNueva.length < minLength) {
            return NextResponse.json(
                { error: { message: `La contraseña debe tener al menos ${minLength} caracteres`, code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const valid = await verifyPassword(passwordActual, user.passwordHash);
        if (!valid) {
            return NextResponse.json(
                { error: { message: "Contraseña actual incorrecta", code: ERROR_CODES.AUTH_INVALID } },
                { status: 401 }
            );
        }

        const hash = await hashPassword(passwordNueva);
        await prisma.usuario.update({
            where: { id: user.id },
            data: { passwordHash: hash, debeCambiarPassword: false },
        });

        return NextResponse.json({ ok: true });
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
