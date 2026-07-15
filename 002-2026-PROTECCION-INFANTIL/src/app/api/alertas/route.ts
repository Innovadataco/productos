import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

/**
 * GET /api/alertas
 * Lista las suscripciones de alertas del usuario autenticado.
 */
export async function GET() {
    try {
        const user = await verifyAuth();
        const suscripciones = await prisma.alertaSuscripcion.findMany({
            where: { usuarioId: user.id, activa: true },
            include: { plataforma: { select: { id: true, nombre: true, clave: true } } },
            orderBy: { creadoEn: "desc" },
        });
        return NextResponse.json({ suscripciones });
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
