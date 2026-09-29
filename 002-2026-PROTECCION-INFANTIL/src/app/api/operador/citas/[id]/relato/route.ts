/**
 * SPEC-780 · Camino SANCIONADO de rectificación del relato de la cita (habeas data).
 * Lo ejecuta un OPERADOR (no autoservicio del padre, nunca a mano en la base). Corrige la
 * solicitud VIVA; el historial de la cadena de reprogramación NO se toca (lo garantiza el
 * service). Rastro del HECHO sin volcar el texto.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { corregirRelatoCita } from "@/lib/profesional/cita/corregir-relato.service";

const bodySchema = z.object({
    presentacion: z.string().trim().min(10, "El relato corregido es muy corto").max(2000),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("OPERADOR");
        const { id } = await context.params;
        const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: parsed.error.issues[0]?.message ?? "Datos inválidos", code: "VALIDATION_ERROR" } },
                { status: 400 },
            );
        }
        const { corregidoEn } = await corregirRelatoCita({
            solicitudId: id,
            presentacion: parsed.data.presentacion,
            actorId: user.id,
        });
        return NextResponse.json({ corregidoEn: corregidoEn.toISOString() });
    } catch (error) {
        return errorToResponse(error, "[OPERADOR/CITAS/RELATO]");
    }
}
