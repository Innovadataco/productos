import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { numeroSeguimientoSchema } from "@/lib/validators";
import { calcularRanking } from "@/lib/ranking";
import { ERROR_CODES } from "@/lib/errors";

const CATEGORIA_LABELS: Record<string, string> = {
    CONTACTO_INSISTENTE: "Contacto insistente",
    SOLICITUD_MATERIAL: "Solicitud de material",
    OFRECIMIENTO_REGALOS: "Ofrecimiento de regalos",
    SUPLANTACION_IDENTIDAD: "Suplantación de identidad",
    SOLICITUD_ENCUENTRO: "Solicitud de encuentro",
    COMPARTIMIENTO_SEXUAL: "Compartimiento sexual",
    OTRO: "Otro",
};

const ESTADO_MENSAJE: Record<string, string> = {
    PENDIENTE: "Tu reporte está pendiente de procesamiento.",
    PROCESANDO: "Tu reporte está siendo procesado.",
    CLASIFICADO: "Tu reporte ha sido procesado y clasificado.",
    REVISION_MANUAL: "Tu reporte requiere revisión manual.",
    POSIBLE_SPAM: "Tu reporte está siendo revisado.",
    DUPLICADO: "Tu reporte fue vinculado a uno existente.",
    REQUIERE_ANONIMIZACION: "Tu reporte está en revisión de privacidad.",
    CORREGIDO: "Tu reporte ha sido revisado y corregido.",
};

export async function GET(
    request: Request,
    { params }: { params: Promise<{ numero: string }> }
) {
    try {
        const rate = await checkRateLimit(request, "seguimiento");
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas consultas. Esperá un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { numero: rawNumero } = await params;
        const parsedNumero = numeroSeguimientoSchema.safeParse(rawNumero);
        if (!parsedNumero.success) {
            return NextResponse.json(
                { error: { message: "Número de seguimiento inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const numero = parsedNumero.data;

        const reporte = await prisma.reporte.findUnique({
            where: { numeroSeguimiento: numero },
            include: {
                clasificacion: true,
                plataforma: { select: { clave: true, nombre: true } },
            },
        });

        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Número de seguimiento no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const identificadorReportado = await prisma.identificadorReportado.findUnique({
            where: {
                identificador_plataformaId: {
                    identificador: reporte.identificador,
                    plataformaId: reporte.plataformaId,
                },
            },
        });

        let ranking = null;
        if (identificadorReportado?.esVisiblePublicamente) {
            ranking = await calcularRanking(reporte.identificador, reporte.plataformaId);
        }

        return NextResponse.json({
            numeroSeguimiento: reporte.numeroSeguimiento,
            estado: reporte.estado,
            creadoEn: reporte.creadoEn,
            mensaje: ESTADO_MENSAJE[reporte.estado] || "Estado desconocido",
            identificador: reporte.identificador,
            plataforma: reporte.plataforma.nombre,
            clasificacion: reporte.clasificacion
                ? {
                    categoria: reporte.clasificacion.categoria,
                    categoriaLabel: CATEGORIA_LABELS[reporte.clasificacion.categoria] || reporte.clasificacion.categoria,
                    confianza: reporte.clasificacion.confianza,
                    contienePii: reporte.clasificacion.contienePii,
                    piiDetectada: reporte.clasificacion.piiDetectada,
                }
                : null,
            ranking: ranking
                ? {
                    score: ranking.score,
                    nivelRiesgo: ranking.nivelRiesgo,
                    totalReportes: ranking.totalReportes,
                    reportesAutenticados: ranking.reportesAutenticados,
                    reportesAnonimos: ranking.reportesAnonimos,
                }
                : null,
        });
    } catch {
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
