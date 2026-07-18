import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import {
    toggleNotificacionesCirculo,
    obtenerPreferenciasCirculo,
} from "@/lib/circulo-confianza";

const schema = z.object({
    notificacionesCirculo: z.boolean(),
});

export async function GET(request: Request) {
    try {
        const usuario = await verifyAuth("PARENT");
        const prefs = await obtenerPreferenciasCirculo(usuario.id);
        return NextResponse.json(prefs);
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

export async function PATCH(request: Request) {
    try {
        const usuario = await verifyAuth("PARENT");
        const body = await request.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const prefs = await toggleNotificacionesCirculo(usuario.id, parsed.data.notificacionesCirculo);
        return NextResponse.json(prefs);
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
