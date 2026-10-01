/**
 * SPEC-751 · POST /api/audiencia-menor/declarar
 *
 * El titular (PARENT) declara haber OÍDO a UN menor para la versión vigente del consentimiento
 * (Decreto 1377/2013 art. 12). Idempotente por `(hijoId, versión)` — el service no crea un segundo
 * hecho ni un segundo audit. 403/404 si el menor no es del titular (PII: nunca por id suelto).
 *
 * El flag `audienciaPendiente` de la cookie firmada se re-calcula en el próximo
 * `POST /api/vigencia/refresh` (ruta exenta del gate) — por eso ESTA ruta y la del muro quedan en
 * `GUARDIAS_ACCESO.audiencia.exentas`: el padre con audiencia pendiente DEBE poder declararla.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { declararAudienciaMenor } from "@/lib/dal/services/audiencia-menor";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request) {
    try {
        const padre = await verifyAuth("PARENT");

        const body = (await request.json().catch(() => null)) as { hijoId?: unknown } | null;
        const hijoId = typeof body?.hijoId === "string" ? body.hijoId.trim() : "";
        if (!hijoId) {
            return NextResponse.json(
                { error: { message: "Falta el identificador del menor.", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const { ipAddress, userAgent } = getClientInfo(request);
        const resultado = await declararAudienciaMenor({ usuarioId: padre.id, hijoId, ipAddress, userAgent });
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
