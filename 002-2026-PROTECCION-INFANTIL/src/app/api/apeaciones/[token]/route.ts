import { NextResponse } from "next/server";
import { getApelacionByToken } from "@/lib/apealaciones";
import { AppError, ERROR_CODES } from "@/lib/errors";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
    try {
        const { token } = await params;
        const apelacion = await getApelacionByToken(token);
        if (!apelacion) {
            return NextResponse.json(
                { error: { message: "Apelación no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        return NextResponse.json({
            estado: apelacion.estado,
            tipoVerificacion: apelacion.tipoVerificacion,
            pausaHasta: apelacion.pausaHasta,
            visibilidadRestaurada: apelacion.visibilidadRestaurada,
            plataformaNombre: apelacion.plataforma?.nombre ?? null,
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
