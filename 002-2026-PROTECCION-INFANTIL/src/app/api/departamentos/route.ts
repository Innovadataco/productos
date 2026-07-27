import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const paisId = searchParams.get("paisId");

        if (!paisId) {
            return NextResponse.json(
                { error: { message: "El parámetro paisId es requerido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const departamentos = await prisma.departamento.findMany({
            where: { paisId, esActivo: true },
            orderBy: { nombre: "asc" },
            select: { id: true, nombre: true, paisId: true },
        });

        return NextResponse.json({ departamentos });
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
