import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { assertModulo, puedeAccederAModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { obtenerSeveridades } from "@/lib/scoring";
import {
    armarEtapas,
    cargarDatosExpediente,
    obtenerConfigEtapas,
} from "@/lib/expediente/expediente";
import { armarVotacion, cargarPreguntasRubrica } from "@/lib/expediente/votacion";
import { construirAnalisisInterno, type VotoInterno } from "@/lib/expediente/analisis-interno";
import { construirMensajePadre, cargarCanalesPadre } from "@/lib/expediente/mensaje-padre";

/**
 * GET /api/admin/reportes/[id]/expediente (spec 096).
 * Traza del pipeline de UN reporte: 10 etapas (parámetro admin.expediente.etapas),
 * votación pregunta por pregunta (ClasificacionRubricaVoto × ia.rubrica.preguntas
 * en vivo), análisis interno y mensaje al padre (borrador, plantillas).
 * Query `revelar=true`: incluye campos gated solo con el módulo
 * `expediente_revelar_original` y registra AuditLog TEXTO_ORIGINAL_REVELADO.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "bandeja_reportes");

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id: rawId } = await params;
        const parsedId = idSchema.safeParse(rawId);
        if (!parsedId.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const reporteId = parsedId.data;

        const datos = await cargarDatosExpediente(reporteId);
        if (!datos) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        // R2 (contrato): sin permiso y revelar=true NO es error — se omiten los
        // campos gated y se responde 200 con revelado:false.
        const url = new URL(request.url);
        const quiereRevelar = url.searchParams.get("revelar") === "true";
        const puedeRevelar = await puedeAccederAModulo(user.rol, "expediente_revelar_original");
        const revelar = quiereRevelar && puedeRevelar;

        if (revelar) {
            // Nunca se registra el texto: solo metadatos de la revelación.
            await logAudit({
                accion: "TEXTO_ORIGINAL_REVELADO",
                tipoRecurso: "Reporte",
                recursoId: reporteId,
                usuarioId: user.id,
                ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
                userAgent: request.headers.get("user-agent") || "unknown",
                metadatos: { origen: "expediente" },
            });
        }

        const config = await obtenerConfigEtapas();
        const etapas = armarEtapas(datos, config, { revelar });

        const c = datos.reporte.clasificacion;
        const preguntas = await cargarPreguntasRubrica();
        const clasificacion = c ? armarVotacion(c, preguntas) : null;

        const [severidades, canales] = await Promise.all([obtenerSeveridades(), cargarCanalesPadre()]);
        const votosInternos: VotoInterno[] = (c?.rubricaVotos ?? []).map((v) => ({
            modelo: v.modelo,
            categoria: v.categoria,
            cumple: v.cumple,
            preguntasCumplidas: Array.isArray(v.preguntasJson)
                ? v.preguntasJson.filter((x): x is string => typeof x === "string")
                : [],
        }));

        const sintesis = {
            analisisInterno: construirAnalisisInterno({
                estado: datos.reporte.estado,
                esRafaga: datos.reporte.esRafaga,
                prioridadAlta: datos.reporte.prioridadAlta,
                processingError: datos.reporte.processingError,
                clasificacion: c && clasificacion
                    ? { categoria: c.categoria, confianza: c.confianza, categorias: clasificacion.categorias }
                    : null,
                votos: votosInternos,
                preguntas,
                severidades: { ...severidades },
                pesoFuente: datos.reporte.fuente?.pesoAplicado ?? null,
            }),
            mensajePadre: construirMensajePadre({
                conductas: clasificacion?.categorias ?? [],
                canales,
            }),
        };

        const r = datos.reporte;
        return NextResponse.json({
            reporte: {
                id: r.id,
                numeroSeguimiento: r.numeroSeguimiento,
                estado: r.estado,
                creadoEn: r.creadoEn.toISOString(),
                plataforma: r.plataforma.nombre,
                pais: r.pais,
                ciudad: r.ciudad,
                esAnonimo: r.esAnonimo,
            },
            etapas,
            clasificacion,
            sintesis,
            revelado: revelar,
            puedeRevelar,
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[Expediente] Error ensamblando expediente", {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
