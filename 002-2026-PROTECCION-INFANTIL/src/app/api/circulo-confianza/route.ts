import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import {
    listarContactos,
    agregarContacto,
    obtenerTopeContactos,
    contarContactosActivos,
} from "@/lib/circulo-confianza";

const createSchema = z.object({
    etiqueta: z.string().max(100).optional(),
    nota: z.string().max(1000).optional(),
    identificadores: z
        .array(
            z.object({
                valor: z.string().min(1).max(100),
                tipo: z.string().max(50).optional(),
                plataformaId: z.string().max(100).optional(),
            })
        )
        .min(1),
});

export async function GET(request: Request) {
    try {
        const usuario = await verifyAuth("PARENT");
        const resultado = await listarContactos(usuario.id);
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

export async function POST(request: Request) {
    try {
        const usuario = await verifyAuth("PARENT");

        const rate = await checkRateLimit(request, "circulo_contacto");
        if (!rate.allowed) {
            return NextResponse.json(
                {
                    error: {
                        message: "Demasiados contactos agregados. Intente más tarde.",
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
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        const message = error instanceof Error ? error.message : "Error interno";
        const status = message.includes("duplicado")
            ? 409
            : message.includes("no encontrada")
              ? 400
              : message.includes("Límite")
                ? 409
                : 500;
        return NextResponse.json(
            { error: { message, code: ERROR_CODES.INTERNAL_ERROR } },
            { status }
        );
    }
}
