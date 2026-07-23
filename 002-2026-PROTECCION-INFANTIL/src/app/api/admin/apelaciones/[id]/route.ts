import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { RolUsuario } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "apelaciones");

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = await params;
        const apelacion = await prisma.apelacionIdentificador.findUnique({
            where: { id },
            include: {
                plataforma: true,
                admin: { select: { email: true, nombre: true } },
            },
        });
        if (!apelacion) {
            return NextResponse.json(
                { error: { message: "Apelación no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const reportes = await prisma.reporte.findMany({
            where: {
                identificador: apelacion.identificador,
                plataformaId: apelacion.plataformaId,
                eliminado: false,
            },
            orderBy: { creadoEn: "desc" },
            include: { clasificacion: true },
            take: 100,
        });

        return NextResponse.json({ apelacion, reportes });
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
