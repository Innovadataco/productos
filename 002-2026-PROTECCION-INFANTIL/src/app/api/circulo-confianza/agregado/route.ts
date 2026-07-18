import { NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import { ERROR_CODES } from "@/lib/errors";
import { obtenerVistaAgregada } from "@/lib/circulo-confianza";

export async function GET(request: Request) {
    try {
        const usuario = await getUserFromToken(request);
        if (!usuario) {
            return NextResponse.json(
                { error: { message: "No autenticado", code: ERROR_CODES.AUTH_INVALID } },
                { status: 401 }
            );
        }
        const resultado = await obtenerVistaAgregada(usuario.id);
        return NextResponse.json(resultado);
    } catch (error) {
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
