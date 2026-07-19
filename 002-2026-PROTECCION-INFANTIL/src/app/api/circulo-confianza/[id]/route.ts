import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { actualizarContacto, obtenerDetalleContacto } from "@/lib/circulo-confianza";

const updateSchema = z.object({
    etiqueta: z.string().max(100).optional(),
    nota: z.string().max(1000).optional(),
    activo: z.boolean().optional(),
    identificadores: z
        .array(
            z.object({
                id: z.string().optional(),
                valor: z.string().min(1).max(100),
                tipo: z.string().max(50).optional(),
                plataformaId: z.string().max(100).optional(),
            })
        )
        .optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const usuario = await verifyAuth("PARENT");
        const { id } = await params;
        const detalle = await obtenerDetalleContacto(id, usuario.id);
        return NextResponse.json(detalle);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        if (error instanceof Error && error.message === "Contacto no encontrado") {
            return NextResponse.json(
                { error: { message: "Contacto no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const usuario = await verifyAuth("PARENT");
        const { id } = await params;

        const body = await request.json();
        const parsed = updateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const contacto = await actualizarContacto(id, usuario.id, parsed.data, request);
        return NextResponse.json(contacto);
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        if (error instanceof Error && error.message === "Contacto no encontrado") {
            return NextResponse.json(
                { error: { message: "Contacto no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        const message = error instanceof Error ? error.message : "Error interno";
        const status = message.includes("duplicado") ? 409 : 500;
        return NextResponse.json(
            { error: { message, code: ERROR_CODES.INTERNAL_ERROR } },
            { status }
        );
    }
}
