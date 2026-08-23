/**
 * SPEC-234 (002-PI-134): endpoint público de verificación de integridad de PDF.
 * GET /api/publico/verificar-pdf/[hash]
 * Sin autenticación; rate-limit scope `verificar_pdf`.
 */
import { NextResponse } from "next/server";
import { ERROR_CODES } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { InformeConsolidadoRepository } from "@/lib/dal/repositories/informe-consolidado-repository";

export async function GET(request: Request, { params }: { params: Promise<{ hash: string }> }) {
    try {
        const rate = await checkRateLimit(request, "verificar_pdf");
        if (!rate.allowed) {
            return NextResponse.json(
                {
                    error: {
                        message: "Demasiadas consultas. Intenta más tarde.",
                        code: ERROR_CODES.RATE_LIMITED,
                        retryAfter: Math.ceil((rate.resetAt - Date.now()) / 1000),
                    },
                },
                { status: 429, headers: rate.headers }
            );
        }

        const { hash } = await params;
        if (!hash || hash.length < 16) {
            return NextResponse.json(
                { error: { message: "Hash inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const informe = await new InformeConsolidadoRepository().obtenerPorHash(hash);
        if (!informe) {
            return NextResponse.json(
                { error: { message: "Informe no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        return NextResponse.json({
            expedienteId: informe.expedienteId,
            versionSecuencial: informe.versionSecuencial,
            pdfGeneradoEn: informe.pdfGeneradoEn?.toISOString() ?? null,
        });
    } catch {
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
