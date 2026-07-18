import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import {
    listarContactos,
    agregarContacto,
    obtenerTopeContactos,
    contarContactosActivos,
} from "@/lib/circulo-confianza";

const createSchema = z.object({
    identificador: z.string().min(3).max(100),
    plataformaId: z.string().min(1),
    etiqueta: z.string().max(100).optional(),
});

export async function GET(request: Request) {
    try {
        const usuario = await getUserFromToken(request);
        if (!usuario) {
            return NextResponse.json(
                { error: { message: "No autenticado", code: ERROR_CODES.AUTH_INVALID } },
                { status: 401 }
            );
        }
        const resultado = await listarContactos(usuario.id);
        return NextResponse.json(resultado);
    } catch (error) {
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const usuario = await getUserFromToken(request);
        if (!usuario) {
            return NextResponse.json(
                { error: { message: "No autenticado", code: ERROR_CODES.AUTH_INVALID } },
                { status: 401 }
            );
        }

        const rate = await checkRateLimit(request, "circulo_contacto");
        if (!rate.allowed) {
            return NextResponse.json(
                {
                    error: {
                        message: "Demasiados contactos agregados. Intentá más tarde.",
                        code: ERROR_CODES.RATE_LIMITED,
                        retryAfter: Math.ceil((rate.resetAt - Date.now()) / 1000),
                    },
                },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await request.json();
        const parsed = createSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const tope = await obtenerTopeContactos();
        const activos = await contarContactosActivos(usuario.id);
        if (activos >= tope) {
            return NextResponse.json(
                {
                    error: {
                        message: `Límite de ${tope} contactos activos alcanzado`,
                        code: ERROR_CODES.VALIDATION_ERROR,
                    },
                },
                { status: 409 }
            );
        }

        const contacto = await agregarContacto(usuario.id, parsed.data, request);
        return NextResponse.json(contacto, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === "No autenticado") {
            return NextResponse.json(
                { error: { message: "No autenticado", code: ERROR_CODES.AUTH_INVALID } },
                { status: 401 }
            );
        }
        const message = error instanceof Error ? error.message : "Error interno";
        const status = message.includes("ya existe") ? 409 : message.includes("no encontrada") ? 400 : 500;
        return NextResponse.json(
            { error: { message, code: ERROR_CODES.INTERNAL_ERROR } },
            { status }
        );
    }
}
