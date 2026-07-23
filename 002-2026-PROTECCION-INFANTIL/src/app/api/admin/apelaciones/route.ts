import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { EstadoApelacion } from "@prisma/client";
import { esAdminRol } from "@/lib/operadores/permisos";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "apelaciones");
        if (!esAdminRol(user.rol) && user.rol !== "OPERADOR") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { searchParams } = new URL(request.url);
        const rawEstado = searchParams.get("estado");
        const estado = rawEstado && Object.values(EstadoApelacion).includes(rawEstado as EstadoApelacion)
            ? (rawEstado as EstadoApelacion)
            : undefined;

        const where: Record<string, unknown> = {};
        if (estado) {
            where.estado = estado;
        }
        if (user.rol === "OPERADOR") {
            where.operadorId = user.id;
        }

        const items = await prisma.apelacionIdentificador.findMany({
            where,
            orderBy: { creadoEn: "desc" },
            include: { plataforma: true, operador: { select: { id: true, email: true, nombre: true } } },
            take: 100,
        });

        return NextResponse.json({ items });
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
