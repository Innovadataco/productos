import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { confirmarCambioCorreoPadre } from "@/lib/dal/services/cambio-correo-padre";

// SPEC-547: paso 2 — con el código del buzón nuevo, recién ahí se cambia el correo.
const schema = z.object({
    nuevoEmail: z.string().trim().email(),
    codigo: z.string().trim().min(4).max(10),
});

export async function POST(request: Request) {
    try {
        const user = await verifyAuth("PARENT");
        const parsed = schema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos.", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const r = await confirmarCambioCorreoPadre(user.id, parsed.data.nuevoEmail, parsed.data.codigo, request);
        if (!r.ok) {
            const mensajes: Record<typeof r.tipo, string> = {
                sin_codigo: "No encontramos una solicitud de cambio para ese correo. Pídela de nuevo.",
                expirado: "El código venció. Pide uno nuevo.",
                max_intentos: "Demasiados intentos. Pide un código nuevo.",
                incorrecto: "El código no es correcto.",
                en_uso: "Ese correo ya no está disponible. Prueba con otro.",
            };
            return NextResponse.json(
                { error: { message: mensajes[r.tipo], code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        return NextResponse.json({ ok: true, email: r.email, mensaje: "Tu correo quedó actualizado." });
    } catch (error) {
        if (error instanceof AppError) return NextResponse.json(error.toJSON(), { status: error.statusCode });
        return errorToResponse(error, "[PADRE/PERFIL/CORREO/CONFIRMAR]");
    }
}
