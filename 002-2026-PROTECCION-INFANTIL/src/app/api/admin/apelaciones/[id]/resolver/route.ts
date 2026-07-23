import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolverApelacion } from "@/lib/apelaciones";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { esAdminRol, puedeGestionarApelacion } from "@/lib/operadores/permisos";
import { z } from "zod";

const schema = z.object({
    accion: z.enum(["ACEPTAR", "RECHAZAR"]),
    respuestaAdmin: z.string().min(10).max(2000),
    reportesSeleccionados: z.array(z.string().cuid()).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "apelaciones");
        if (!esAdminRol(user.rol) && user.rol !== "OPERADOR") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const { id } = await params;
        const apelacion = await prisma.apelacionIdentificador.findUnique({
            where: { id },
            select: { id: true, operadorId: true, estado: true },
        });
        if (!apelacion) {
            return NextResponse.json({ error: { message: "Apelación no encontrada", code: ERROR_CODES.NOT_FOUND } }, { status: 404 });
        }
        if (!puedeGestionarApelacion(user, apelacion)) {
            return NextResponse.json(
                { error: { message: "No tienes permiso para resolver esta apelación", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }
        if (apelacion.estado !== "RECIBIDA" && apelacion.estado !== "EN_REVISION") {
            return NextResponse.json(
                { error: { message: "La apelación ya fue resuelta", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await request.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        await resolverApelacion({
            apelacionId: id,
            adminId: user.id,
            accion: parsed.data.accion,
            respuestaAdmin: parsed.data.respuestaAdmin,
            reportesSeleccionados: parsed.data.reportesSeleccionados,
            request,
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg === "APELACION_NO_ENCONTRADA") {
            return NextResponse.json({ error: { message: "Apelación no encontrada", code: ERROR_CODES.NOT_FOUND } }, { status: 404 });
        }
        if (msg === "APELACION_NO_RESOLUBLE") {
            return NextResponse.json({ error: { message: "La apelación ya fue resuelta", code: ERROR_CODES.CONFLICT } }, { status: 409 });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
