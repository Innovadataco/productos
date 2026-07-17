import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { RolUsuario, EstadoApelacion } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);

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

        const items = await prisma.apelacionIdentificador.findMany({
            where: estado ? { estado } : {},
            orderBy: { creadoEn: "desc" },
            include: { plataforma: true },
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
