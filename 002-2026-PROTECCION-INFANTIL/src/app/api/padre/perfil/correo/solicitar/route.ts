import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { solicitarCambioCorreoPadre } from "@/lib/dal/services/cambio-correo-padre";

// SPEC-547: paso 1 del cambio de correo — envía un código al BUZÓN NUEVO.
const schema = z.object({ nuevoEmail: z.string().trim().email() });

export async function POST(request: Request) {
    try {
        const user = await verifyAuth("PARENT");
        const parsed = schema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Escribe un correo válido.", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const r = await solicitarCambioCorreoPadre(user.id, parsed.data.nuevoEmail);
        if (!r.ok) {
            const mensajes: Record<typeof r.tipo, string> = {
                invalido: "Escribe un correo válido.",
                mismo: "Ese ya es tu correo actual.",
                // No confirmamos si el correo existe (evita enumerar cuentas).
                en_uso: "No pudimos usar ese correo. Prueba con otro.",
                limite: "Pediste demasiados códigos. Espera un momento e intenta de nuevo.",
            };
            return NextResponse.json(
                { error: { message: mensajes[r.tipo], code: ERROR_CODES.VALIDATION_ERROR } },
                { status: r.tipo === "limite" ? 429 : 400 }
            );
        }
        return NextResponse.json({ ok: true, mensaje: "Te enviamos un código al correo nuevo. Revisa tu bandeja." });
    } catch (error) {
        if (error instanceof AppError) return NextResponse.json(error.toJSON(), { status: error.statusCode });
        return errorToResponse(error, "[PADRE/PERFIL/CORREO/SOLICITAR]");
    }
}
