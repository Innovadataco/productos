import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { crearReporteSchema } from "@/lib/validators";
import { getUserFromToken } from "@/lib/auth";
import { getParametroSistema } from "@/lib/parametros";
import { sendReporte } from "@/lib/queue";
import { detectarKeywordsRiesgo } from "@/lib/ai/keywords-riesgo";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { crearFuenteReporte, calcularFingerprintServerSide } from "@/lib/anti-abuso/fuente-reporte";
import { validarSecretoSimulacion } from "@/lib/anti-abuso/simulador-secreto";
import { ReporteCreationService } from "@/lib/dal/services/reporte-creation";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = crearReporteSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const { identificador, plataforma: plataformaClave, texto, fechaIncidente, ciudad, pais, paisId, ciudadId, otraPlataforma, edadVictima, reportePrevioId } = parsed.data;

        // Spec 092-US5: la longitud mínima es un parámetro (ADR_004), no un literal.
        const paramMinTexto = await getParametroSistema("reportes.spam.min_text_length");
        const minTexto = parseInt(paramMinTexto?.valor ?? "20", 10);
        if (texto.trim().length < minTexto) {
            return NextResponse.json(
                { error: { message: `El texto del reporte debe tener al menos ${minTexto} caracteres`, code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // Obtener usuario autenticado (puede ser null)
        const user = await getUserFromToken(request);
        if (user && user.rol !== "PARENT") {
            return NextResponse.json(
                { error: { message: "Esta función no está disponible para usuarios internos", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }
        const esAnonimo = !user;

        // SPEC-119: un padre con el servicio vencido no puede crear reportes nuevos
        // (los ya enviados siguen su curso; el reporte anónimo no se toca).
        if (user) {
            const { assertVigenciaCliente } = await import("@/lib/colegio/vigencia");
            await assertVigenciaCliente(user.id);
        }

        // Rate limiting por IP (anónimo) o por usuario autenticado
        const identifier = user?.id ?? undefined;
        const rate = await checkRateLimit(request, "report", { identifier });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiados reportes. Espera una hora o crea una cuenta.", code: ERROR_CODES.RATE_LIMITED, retryAfter: Math.ceil((rate.resetAt - Date.now()) / 1000) } },
                { status: 429, headers: rate.headers }
            );
        }

        const usuarioId = user?.id ?? null;

        // SPEC-053: el acceso a datos vive en el DAL; la ruta no toca prisma.
        const creationService = new ReporteCreationService();

        // Verificar plataforma
        const plataforma = await creationService.resolverPlataforma(plataformaClave);
        if (!plataforma) {
            return NextResponse.json(
                { error: { message: "Plataforma no válida", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // Rate limiting por fuente (Fase B)
        // SPEC-192: el worker del simulador envía un secret compartido para saltar
        // el rate-limit por fingerprint, que satura por /24 con IPs RFC 5737.
        // Solo se salta este scope; report (IP) e report_identificador siguen activos.
        const bypassFingerprint = validarSecretoSimulacion(request);
        const fingerprintHash = calcularFingerprintServerSide(request);

        if (!bypassFingerprint) {
            const rateFingerprint = await checkRateLimit(request, "report_fingerprint", { identifier: fingerprintHash });
            if (!rateFingerprint.allowed) {
                return NextResponse.json(
                    { error: { message: "Demasiados reportes desde este dispositivo. Espere un momento.", code: ERROR_CODES.RATE_LIMITED, retryAfter: Math.ceil((rateFingerprint.resetAt - Date.now()) / 1000) } },
                    { status: 429, headers: rateFingerprint.headers }
                );
            }
        }

        const rateIdentificador = await checkRateLimit(request, "report_identificador", {
            identifier: `${identificador}:${plataforma.id}`,
            soft: true,
        });

        // Determinar estado inicial del reporte (solo volumen, nunca contenido)
        let estadoInicial: "PENDIENTE" | "POSIBLE_SPAM" | "REVISION_MANUAL" = "PENDIENTE";
        if (rateIdentificador.softExceeded) {
            estadoInicial = rateIdentificador.markAsSpam ? "POSIBLE_SPAM" : "REVISION_MANUAL";
        }

        // Determinar prioridad de encolamiento (Spec 027)
        const keywordsRiesgo = detectarKeywordsRiesgo(texto);
        const prioridadAlta = !esAnonimo || (esAnonimo && keywordsRiesgo.tieneMatch);
        const keywordsDetectadas = keywordsRiesgo.tieneMatch ? keywordsRiesgo.keywords : [];

        // SPEC-137 (E-5): dedup + create + upsert del identificador en UNA
        // transacción (con advisory lock por usuario+identificador dentro — cierra
        // la carrera de deduplicación). La fuente anti-abuso y el encolado quedan
        // FUERA, como hasta ahora (FR-004).
        const resultado = await withUnitOfWork((tx) =>
            new ReporteCreationService(tx).crear({
                identificador,
                plataformaId: plataforma.id,
                plataformaClave,
                texto,
                fechaIncidente,
                ciudad,
                pais,
                paisId,
                ciudadId,
                otraPlataforma,
                edadVictima,
                esAnonimo,
                usuarioId,
                // SPEC-295 (002-PI-196 · I-146): marca el rol del origen del
                // reporte. "PARENT" cuando el padre autenticado reporta desde
                // /dashboard/padre/reportar; null para anónimos e históricos.
                origenRol: user?.rol === "PARENT" ? "PARENT" : null,
                tenantId: user?.tenantId ?? null,
                estadoInicial,
                prioridadAlta,
                keywordsDetectadas,
                reportePrevioId,
            })
        );

        if (!resultado.ok) {
            if (resultado.tipo === "duplicado") {
                // SPEC-323 (AD-1): padre autenticado recibe oferta de vinculación;
                // anónimo y otros usuarios siguen con 429 (candado 26 — solo la respuesta cambia).
                if (user?.rol === "PARENT") {
                    return NextResponse.json(
                        { oferta: true, reporteExistenteId: resultado.reporteExistenteId, identificador },
                        { status: 200 }
                    );
                }
                return NextResponse.json(
                    { error: { message: "Ya reportaste este identificador recientemente", code: "DUPLICATE_REPORT", reporteExistenteId: resultado.reporteExistenteId } },
                    { status: 429 }
                );
            }
            if (resultado.tipo === "error_numero") {
                return NextResponse.json(
                    { error: { message: "Error generando número de seguimiento", code: ERROR_CODES.INTERNAL_ERROR } },
                    { status: 500 }
                );
            }
            return NextResponse.json(
                { error: { message: "Error de seguridad almacenando el reporte", code: ERROR_CODES.INTERNAL_ERROR } },
                { status: 500 }
            );
        }

        const { reporte } = resultado;

        // SPEC-323 (T011/US2): vinculación aceptada → crear/reutilizar expediente y agregar eventos.
        let expedienteId: string | undefined;
        if ("vinculacion" in resultado && resultado.vinculacion) {
            const { reportePrevioId, reportePrevioCreadoEn } = resultado.vinculacion;
            const expRepo = new ExpedienteRepository();
            const existente = await expRepo.buscarExpedienteActivo(usuarioId!, identificador);
            const expediente = existente ?? await expRepo.crearExpediente({
                padreUsuarioId: usuarioId!,
                identificadorReportado: identificador,
            });
            expedienteId = expediente.id;
            // Evento #1 retroactivo (reporte previo). texto="" — AD-3 opción C: el texto
            // se descifra al leer, no se persiste en el evento.
            await expRepo.agregarEvento({
                expedienteId: expediente.id,
                texto: "",
                reporteId: reportePrevioId,
                fechaEvento: reportePrevioCreadoEn,
            });
            // Evento #2 (reporte recién creado).
            await expRepo.agregarEvento({
                expedienteId: expediente.id,
                texto: "",
                reporteId: reporte.id,
            });
        }

        // Registrar señal de fuente para anti-abuso (Fase A)
        try {
            await crearFuenteReporte(reporte.id, { request, usuario: user, identificador, plataformaId: plataforma.id });
        } catch (fuenteErr) {
            const msg = fuenteErr instanceof Error ? fuenteErr.message : "Error desconocido";
            logger.error("[REPORTES] Error registrando fuente:", msg);
            // No fallamos la creación del reporte si falla el registro de fuente.
        }

        // Publicar en cola para procesamiento asíncrono (solo si queda en PENDIENTE)
        if (estadoInicial === "PENDIENTE") {
            try {
                await sendReporte(reporte.id, { prioridadAlta });
            } catch (queueErr) {
                const msg = queueErr instanceof Error ? queueErr.message : "Error desconocido";
                logger.error("[REPORTES] Error publicando en cola:", msg);
                // No fallamos la creación del reporte si la cola falla
            }
        }

        return NextResponse.json(
            {
                reporte: {
                    id: reporte.id,
                    numeroSeguimiento: reporte.numeroSeguimiento,
                    estado: reporte.estado,
                },
                ...(expedienteId ? { expedienteId } : {}),
                mensaje: "Reporte recibido. Tu número de seguimiento es " + reporte.numeroSeguimiento + ".",
            },
            { status: 201 }
        );
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
