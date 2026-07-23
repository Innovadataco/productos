import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { RolUsuario } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { clampPageSize, clampPage } from "@/lib/pagination";

export async function GET(request: Request) {
    try {
        await assertModulo(await verifyAuth(RolUsuario.ADMIN), "configuracion_sistema");

        const { searchParams } = new URL(request.url);
        const categoria = searchParams.get("categoria");
        const page = clampPage(searchParams.get("page"));
        const pageSize = clampPageSize(searchParams.get("pageSize"));

        const where = categoria ? { categoria: categoria as never } : {};

        const [items, total] = await Promise.all([
            prisma.parametroSistema.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { categoria: "asc" },
            }),
            prisma.parametroSistema.count({ where }),
        ]);

        const sanitizedItems = items.map((p) => ({
            ...p,
            valor: p.esSecreto ? null : p.valor,
        }));

        return NextResponse.json({
            items: sanitizedItems,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        });
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
