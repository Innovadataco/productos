import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolverApelacion } from "@/lib/apealaciones";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { RolUsuario } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
    accion: z.enum(["ACEPTAR", "RECHAZAR"]),
    respuestaAdmin: z.string().min(10).max(2000),
    reportesSeleccionados: z.array(z.string().cuid()).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = await params;
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
