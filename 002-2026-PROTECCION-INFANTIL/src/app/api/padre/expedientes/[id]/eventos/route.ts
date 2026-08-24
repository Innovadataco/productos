import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";

const bodySchema = z.object({
    texto: z.string().trim().min(1, "El texto es obligatorio").max(2000, "El texto no puede superar 2000 caracteres"),
    plataforma: z.string().trim().max(100).optional(),
    fechaEvento: z.string().datetime().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        if (user.rol !== "PARENT") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes" } },
                { status: 403 }
            );
        }

        const { id } = await params;
        const body = await request.json();
        const parsed = bodySchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", details: parsed.error.flatten() } },
                { status: 400 }
            );
        }

        const repo = new ExpedienteRepository();
        const expediente = await repo.obtenerExpedientePorId(id, user.id);

        if (!expediente) {
            return NextResponse.json(
                { error: { message: "Expediente no encontrado" } },
                { status: 404 }
            );
        }

        const input: Parameters<ExpedienteRepository["agregarEvento"]>[0] = {
            expedienteId: id,
            texto: parsed.data.texto,
        };
        if (parsed.data.plataforma !== undefined) input.plataforma = parsed.data.plataforma;
        if (parsed.data.fechaEvento !== undefined) input.fechaEvento = new Date(parsed.data.fechaEvento);

        const evento = await repo.agregarEvento(input);

        return NextResponse.json({ evento }, { status: 201 });
    } catch (err: unknown) {
        if (err instanceof AppError) {
            return NextResponse.json(
                { error: { message: err.message } },
                { status: err.statusCode }
            );
        }
        const message = err instanceof Error ? err.message : "Error desconocido";
        console.error("[Padre/Expedientes] Error al agregar evento:", message);
        return NextResponse.json(
            { error: { message: "Error interno del servidor" } },
            { status: 500 }
        );
    }
}
