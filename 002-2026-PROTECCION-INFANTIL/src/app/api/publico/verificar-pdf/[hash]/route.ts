/**
 * SPEC-234 (002-PI-134): endpoint público de verificación de integridad de PDF.
 * GET /api/publico/verificar-pdf/[hash]
 * Sin autenticación; rate-limit scope `verificar_pdf`.
 */
import { NextResponse } from "next/server";
import { ERROR_CODES } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { InformeConsolidadoRepository } from "@/lib/dal/repositories/informe-consolidado-repository";
import { buscarInformePadrePorHash, buscarInformePadrePorCodigo } from "@/lib/dal/services/informes-padre";

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

        // SPEC-340: TRES búsquedas sobre el mismo contrato de respuesta —
        // el informe de comité (SPEC-234, por hash), el informe del PADRE por
        // hash (sha256 del archivo: la integridad byte a byte), y el informe
        // del padre por su CÓDIGO impreso (los 16 hex del pie: lo que una
        // autoridad teclea desde el papel).
        const informe = await new InformeConsolidadoRepository().obtenerPorHash(hash);
        if (informe) {
            return NextResponse.json({
                expedienteId: informe.expedienteId,
                versionSecuencial: informe.versionSecuencial,
                pdfGeneradoEn: informe.pdfGeneradoEn?.toISOString() ?? null,
            });
        }

        const informePadre =
            (await buscarInformePadrePorHash(hash)) ??
            (hash.length === 16 ? await buscarInformePadrePorCodigo(hash) : null);
        if (informePadre) {
            // Mismo shape mínimo: sin identificadores, sin nombres, sin URLs.
            return NextResponse.json({
                expedienteId: informePadre.expedienteId,
                versionSecuencial: informePadre.numeroSecuencial,
                pdfGeneradoEn: informePadre.generadoEn.toISOString(),
            });
        }

        return NextResponse.json(
            { error: { message: "Informe no encontrado", code: ERROR_CODES.NOT_FOUND } },
            { status: 404 }
        );
    } catch {
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
