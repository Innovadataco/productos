import { NextResponse } from "next/server";
import { z } from "zod";
import { ERROR_CODES } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

const eventoSchema = z.object({
    evento: z.literal("consulta_vacia_cta_reportar"),
});

/**
 * POST /api/consulta/evento (F3/N-5)
 * Evento analítico del CTA "Reportar una conducta" del estado vacío de la
 * consulta pública. Privacidad: NO recibe ni persiste el identificador
 * consultado; el AuditLog solo registra la acción (IP hasheada por logAudit).
 */
export async function POST(request: Request) {
    try {
        const rate = await checkRateLimit(request, "consulta");
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Intenta más tarde.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const parsed = eventoSchema.safeParse(await request.json().catch(() => undefined));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Evento inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        await logAudit({
            accion: "CONSULTA_VACIA_CTA_REPORTAR",
            tipoRecurso: "consulta_publica",
            ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
            userAgent: request.headers.get("user-agent") || undefined,
        });

        return NextResponse.json({ ok: true }, { status: 202 });
    } catch {
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
