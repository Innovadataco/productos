import { NextResponse } from "next/server";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { DepartamentoRepository } from "@/lib/dal/repositories/departamento";

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

        // E-8: la consulta vive en el repo; la ruta no toca prisma.
        const departamentos = await new DepartamentoRepository().listarActivosPorPais(paisId);

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
