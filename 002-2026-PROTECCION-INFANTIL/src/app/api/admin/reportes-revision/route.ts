import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

export async function GET() {
    try {
        const user = await verifyAuth();
        if (String(user.rol) !== "ADMIN_PLATAFORMA") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const reportes = await prisma.reporte.findMany({
            where: {
                estado: { in: ["REVISION_MANUAL", "REQUIERE_ANONIMIZACION", "POSIBLE_SPAM"] },
            },
            orderBy: { creadoEn: "desc" },
            take: 100,
            include: {
                clasificacion: true,
                plataforma: { select: { nombre: true, clave: true } },
            },
        });

        return NextResponse.json({ reportes, admin: user.email });
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