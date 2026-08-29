import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { pedirAclaracionBodySchema } from "@/lib/schemas";
import { solicitarAclaracion } from "@/lib/dal/services/aclaracion-expediente";

/**
 * POST /api/padre/expediente/[id]/pedir-aclaracion — SPEC-238 (US1, FR-003).
 *
 * El padre titular pide UNA aclaración al comité antes de aprobar. Crea la
 * aclaración PENDIENTE y transita el expediente a EN_ACLARACION (publica
 * `expediente.aclaracion.solicitada`). Una segunda petición recibe 409
 * (máximo una por expediente, garantizado por @@unique([expedienteId])).
 *
 * El payload NO incluye `solicitudTexto` (dato sensible, D-7).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        if (user.rol !== "PARENT") {
            return NextResponse.json(
                { error: { message: "Solo el padre titular puede pedir una aclaración", code: "FORBIDDEN" } },
                { status: 403 }
            );
        }

        const { id } = await params;
        const body = pedirAclaracionBodySchema.parse(await request.json());

        const aclaracion = await solicitarAclaracion({
            expedienteId: id,
            padreUsuarioId: user.id,
            solicitudTexto: body.solicitudTexto,
            ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
            userAgent: request.headers.get("user-agent") ?? undefined,
        });

        return NextResponse.json(
            {
                aclaracion: {
                    id: aclaracion.id,
                    expedienteId: aclaracion.expedienteId,
                    informeConsolidadoId: aclaracion.informeConsolidadoId,
                    estado: aclaracion.estado,
                    solicitadaEn: aclaracion.solicitadaEn,
                    createdAt: aclaracion.createdAt,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        return errorToResponse(error, "[PADRE/EXPEDIENTE/PEDIR-ACLARACION]");
    }
}
