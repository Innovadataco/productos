import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { hashPassword } from "@/lib/auth";
import { verificarTokenHash } from "@/lib/token-recuperacion";
import { restablecerPasswordSchema } from "@/lib/validators";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = restablecerPasswordSchema.safeParse(body);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            return NextResponse.json(
                { error: { message: issue?.message || "Token y contraseña requeridos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const { token, password } = parsed.data;

        const tokensActivos = await prisma.tokenRecuperacion.findMany({
            where: {
                usado: false,
                expiraEn: { gt: new Date() },
            },
            orderBy: { creadoEn: "desc" },
            take: 50,
            include: { usuario: true },
        });

        let tokenEncontrado: (typeof tokensActivos)[number] | null = null;
        for (const tokenRecuperacion of tokensActivos) {
            if (await verificarTokenHash(token, tokenRecuperacion.tokenHash)) {
                tokenEncontrado = tokenRecuperacion;
                break;
            }
        }

        if (!tokenEncontrado) {
            return NextResponse.json(
                { error: { message: "Token inválido o expirado", code: ERROR_CODES.AUTH_INVALID } },
                { status: 400 }
            );
        }

        if (!tokenEncontrado.usuario) {
            return NextResponse.json(
                { error: { message: "Usuario no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 400 }
            );
        }

        const passwordHash = await hashPassword(password);

        await prisma.$transaction([
            prisma.usuario.update({
                where: { id: tokenEncontrado.usuario.id },
                data: { passwordHash, intentosFallidos: 0, estado: "activo", bloqueadoHasta: null },
            }),
            prisma.tokenRecuperacion.update({
                where: { id: tokenEncontrado.id },
                data: { usado: true },
            }),
        ]);

        return NextResponse.json({ message: "Contraseña actualizada correctamente." });
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
