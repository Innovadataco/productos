import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { obtenerVistaAgregada } from "@/lib/circulo-confianza";

export async function GET(request: Request) {
    try {
        const usuario = await verifyAuth("PARENT");
        const resultado = await obtenerVistaAgregada(usuario.id);
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
