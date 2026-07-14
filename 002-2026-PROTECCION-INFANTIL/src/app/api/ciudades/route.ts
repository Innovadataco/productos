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

        const ciudades = await prisma.ciudad.findMany({
            where: { paisId, esActivo: true },
            orderBy: { nombre: "asc" },
            select: { id: true, nombre: true, paisId: true },
        });

        const resultado = [
            ...ciudades,
            { id: "otra", nombre: "Otra ciudad o municipio", paisId },
        ];

        return NextResponse.json({ ciudades: resultado });
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