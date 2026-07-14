import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { verificarTokenHash } from "@/lib/token-recuperacion";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get("token");

        if (!token) {
            return NextResponse.json(
                { error: { message: "Token requerido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const tokensActivos = await prisma.tokenRecuperacion.findMany({
            where: {
                usado: false,
                expiraEn: { gt: new Date() },
            },
            orderBy: { creadoEn: "desc" },
            take: 50,
        });

        for (const tokenRecuperacion of tokensActivos) {
            if (await verificarTokenHash(token, tokenRecuperacion.tokenHash)) {
                return NextResponse.json({ valido: true, email: tokenRecuperacion.email });
            }
        }

        return NextResponse.json(
            { error: { message: "Token inválido o expirado", code: ERROR_CODES.AUTH_INVALID } },
            { status: 400 }
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
