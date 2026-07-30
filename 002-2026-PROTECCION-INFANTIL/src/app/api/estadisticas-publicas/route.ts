import { NextResponse } from "next/server";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { EstadisticasService } from "@/lib/dal/services/estadisticas";

export async function GET() {
    try {
        // SPEC-053: las agregaciones viven en el DAL (raw queries en EstadisticasRepository);
        // la ruta no toca prisma.
        const resultado = await new EstadisticasService().publicas();
        return NextResponse.json(resultado);
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
