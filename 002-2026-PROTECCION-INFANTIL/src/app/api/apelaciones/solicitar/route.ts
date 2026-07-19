import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { crearApelacion } from "@/lib/apelaciones";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { z } from "zod";

const schema = z.object({
    identificador: z.string().min(1).max(120),
    plataformaClave: z.string().min(1).max(50),
    motivoSolicitud: z.string().min(20).max(2000),
    evidenciaUrl: z.string().url().max(500).optional().nullable(),
    tipoVerificacion: z.enum(["SMS", "NICK"]),
    contacto: z.string().max(120).optional().nullable(),
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const { identificador, plataformaClave, motivoSolicitud, evidenciaUrl, tipoVerificacion, contacto } = parsed.data;

        const plataforma = await prisma.plataforma.findUnique({ where: { clave: plataformaClave } });
        if (!plataforma) {
            return NextResponse.json(
                { error: { message: "Plataforma no válida", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        if (tipoVerificacion === "SMS" && !contacto) {
            return NextResponse.json(
                { error: { message: "El contacto es obligatorio para verificación por SMS", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // Rate limit por identificador/plataforma (evita spam de apelaciones)
        const rate = await checkRateLimit(request, "apelacion", { identifier: `${identificador}:${plataforma.id}` });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas apelaciones. Esperá un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        // Rate limit adicional por contacto cuando se envía SMS
        if (tipoVerificacion === "SMS" && contacto) {
            const smsRate = await checkRateLimit(request, "apelacion_sms", { identifier: contacto });
            if (!smsRate.allowed) {
                return NextResponse.json(
                    { error: { message: "Demasiados envíos de SMS. Esperá un momento.", code: ERROR_CODES.RATE_LIMITED } },
                    { status: 429, headers: smsRate.headers }
                );
            }
        }

        const { token } = await crearApelacion({
            identificador,
            plataformaId: plataforma.id,
            motivoSolicitud,
            evidenciaUrl,
            tipoVerificacion,
            contacto,
            request,
        });

        return NextResponse.json(
            {
                token,
                mensaje: "Apelación recibida. Guardá el enlace de seguimiento.",
                requiereVerificacion: tipoVerificacion === "SMS",
            },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg === "APELACION_ACTIVA_EXISTENTE") {
            return NextResponse.json(
                { error: { message: "Ya existe una apelación activa para este identificador", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }
        if (msg === "DERECHO_APELAR_BLOQUEADO") {
            return NextResponse.json(
                { error: { message: "El derecho a apelar fue rechazado previamente y no ha sido rehabilitado", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
