import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { numeroSeguimientoSchema } from "@/lib/validators";
import { calcularRanking } from "@/lib/ranking";
import { getParametroSistemaValor } from "@/lib/parametros";
import { mapEstadoUsuario, getMensajeUsuario, parseSlaHoras } from "@/lib/reporte-estados-usuario";
import { obtenerGruposCategoria, nombreGrupoParaCategoria } from "@/lib/categoria-grupos";
import { ERROR_CODES } from "@/lib/errors";
import { formatPlataforma } from "@/lib/plataforma";

const CATEGORIA_LABELS: Record<string, string> = {
    CONTACTO_INSISTENTE: "Contacto insistente",
    SOLICITUD_MATERIAL: "Solicitud de material",
    OFRECIMIENTO_REGALOS: "Ofrecimiento de regalos",
    SUPLANTACION_IDENTIDAD: "Suplantación de identidad",
    SOLICITUD_ENCUENTRO: "Solicitud de encuentro",
    COMPARTIMIENTO_SEXUAL: "Compartimiento sexual",
    OTRO: "Otro",
};

export async function GET(
    request: Request,
    { params }: { params: Promise<{ numero: string }> }
) {
    try {
        const rate = await checkRateLimit(request, "seguimiento");
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas consultas. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
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
            select: {
                id: true,
                identificador: true,
                plataformaId: true,
                plataforma: { select: { clave: true, nombre: true } },
                otraPlataforma: true,
                estado: true,
                eliminado: true,
                creadoEn: true,
                actualizadoEn: true,
                numeroSeguimiento: true,
                clasificacion: true,
            },
        });

        if (!reporte || reporte.eliminado) {
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

        const slaRaw = await getParametroSistemaValor("ui.sla_horas_procesamiento");
        const actividadAltaMin = parseInt((await getParametroSistemaValor("visibility.actividad_alta_min")) ?? "5", 10);
        const slaHoras = parseSlaHoras(slaRaw);
        const estadoUsuario = mapEstadoUsuario(reporte.estado);
        const mensaje = getMensajeUsuario(reporte.estado, slaHoras);
        const gruposCategoria = await obtenerGruposCategoria();

        return NextResponse.json({
            numeroSeguimiento: reporte.numeroSeguimiento,
            estadoVisual: estadoUsuario.estadoVisual,
            estadoInterno: reporte.estado,
            badge: estadoUsuario.badge,
            enProceso: estadoUsuario.enProceso,
            mensaje,
            slaHoras,
            creadoEn: reporte.creadoEn,
            actualizadoEn: reporte.actualizadoEn,
            identificador: reporte.identificador,
            plataforma: formatPlataforma(reporte.plataforma.nombre, reporte.otraPlataforma, reporte.plataforma.clave),
            clasificacion:
                reporte.clasificacion && ["CLASIFICADO", "CORREGIDO"].includes(reporte.estado)
                    ? {
                          categoria: reporte.clasificacion.categoria,
                          categoriaLabel:
                              CATEGORIA_LABELS[reporte.clasificacion.categoria] || reporte.clasificacion.categoria,
                          categoriaGrupo: nombreGrupoParaCategoria(gruposCategoria, reporte.clasificacion.categoria),
                          categoriasSecundarias: (
                              (reporte.clasificacion.categoriasSecundarias ?? []) as Array<{ categoria?: string }>
                          )
                              .map((s) => s.categoria)
                              .filter((c): c is string => typeof c === "string"),
                          contienePii: reporte.clasificacion.contienePii,
                          piiDetectada: reporte.clasificacion.piiDetectada,
                      }
                    : null,
            // Spec 089-US6: nunca score ni etiqueta de riesgo sobre el identificador.
            // Se exponen solo hechos agregados (conteos) y la señal descriptiva.
            actividad: ranking ? (ranking.totalReportes >= actividadAltaMin ? "alta" : "baja") : null,
            ranking: ranking
                ? {
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
