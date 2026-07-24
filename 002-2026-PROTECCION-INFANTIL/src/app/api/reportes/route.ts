import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { crearReporteSchema } from "@/lib/validators";
import { generarNumeroSeguimiento } from "@/lib/reporte-utils";
import { getUserFromToken } from "@/lib/auth";
import { sendReporte } from "@/lib/queue";
import { detectarKeywordsRiesgo } from "@/lib/ai/keywords-riesgo";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { crearFuenteReporte, calcularFingerprintServerSide } from "@/lib/anti-abuso/fuente-reporte";
import { encryptParameter } from "@/lib/param-encryption";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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

        const { identificador, plataforma: plataformaClave, texto, fechaIncidente, ciudad, pais, paisId, ciudadId, otraPlataforma, edadVictima } = parsed.data;

        // Spec 092-US5: la longitud mínima es un parámetro (ADR_004), no un literal.
        const paramMinTexto = await prisma.parametroSistema.findUnique({ where: { clave: "reportes.spam.min_text_length" } });
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

        // Verificar plataforma
        const plataforma = await prisma.plataforma.findUnique({
            where: { clave: plataformaClave },
        });
        if (!plataforma) {
            return NextResponse.json(
                { error: { message: "Plataforma no válida", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // Rate limiting por fuente (Fase B)
        const fingerprintHash = calcularFingerprintServerSide(request);

        const rateFingerprint = await checkRateLimit(request, "report_fingerprint", { identifier: fingerprintHash });
        if (!rateFingerprint.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiados reportes desde este dispositivo. Espere un momento.", code: ERROR_CODES.RATE_LIMITED, retryAfter: Math.ceil((rateFingerprint.resetAt - Date.now()) / 1000) } },
                { status: 429, headers: rateFingerprint.headers }
            );
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

        // Deduplicación autenticada: mismo usuario + identificador en 30 días
        if (usuarioId) {
            const desde = new Date(Date.now() - THIRTY_DAYS_MS);
            const existente = await prisma.reporte.findFirst({
                where: {
                    usuarioId,
                    identificador,
                    creadoEn: { gte: desde },
                },
                orderBy: { creadoEn: "desc" },
            });
            if (existente) {
                return NextResponse.json(
                    { error: { message: "Ya reportaste este identificador recientemente", code: "DUPLICATE_REPORT", reporteExistenteId: existente.id } },
                    { status: 429 }
                );
            }
        }

        // Generar número de seguimiento único
        let numeroSeguimiento: string;
        let intentos = 0;
        do {
            numeroSeguimiento = generarNumeroSeguimiento();
            const existente = await prisma.reporte.findUnique({
                where: { numeroSeguimiento },
            });
            if (!existente) break;
            intentos++;
        } while (intentos < 10);

        if (intentos >= 10) {
            return NextResponse.json(
                { error: { message: "Error generando número de seguimiento", code: ERROR_CODES.INTERNAL_ERROR } },
                { status: 500 }
            );
        }

        // Crear reporte. El texto original se cifra inmediatamente; la copia
        // anonimizada se genera en el worker de procesamiento asíncrono.
        let textoOriginalCifrado: string;
        try {
            textoOriginalCifrado = encryptParameter(texto);
        } catch (err) {
            console.error("[REPORTES] Error cifrando texto original:", err);
            return NextResponse.json(
                { error: { message: "Error de seguridad almacenando el reporte", code: ERROR_CODES.INTERNAL_ERROR } },
                { status: 500 }
            );
        }

        const reporte = await prisma.reporte.create({
            data: {
                identificador,
                plataformaId: plataforma.id,
                texto,
                textoOriginal: textoOriginalCifrado,
                fechaIncidente: new Date(fechaIncidente),
                ciudad,
                pais,
                paisId: ciudadId === "otra" ? null : (paisId || null),
                ciudadId: ciudadId === "otra" ? null : (ciudadId || null),
                otraPlataforma: plataformaClave === "otro" ? (otraPlataforma || null) : null,
                edadVictima: edadVictima ?? null,
                esAnonimo,
                usuarioId,
                numeroSeguimiento,
                tenantId: user?.tenantId ?? null,
                estado: estadoInicial,
                prioridadAlta,
                keywordsDetectadas,
            },
        });

        // Registrar señal de fuente para anti-abuso (Fase A)
        try {
            await crearFuenteReporte(reporte.id, { request, usuario: user, identificador, plataformaId: plataforma.id });
        } catch (fuenteErr) {
            const msg = fuenteErr instanceof Error ? fuenteErr.message : "Error desconocido";
            console.error("[REPORTES] Error registrando fuente:", msg);
            // No fallamos la creación del reporte si falla el registro de fuente.
        }

        // Actualizar o crear IdentificadorReportado
        await prisma.identificadorReportado.upsert({
            where: {
                identificador_plataformaId: {
                    identificador,
                    plataformaId: plataforma.id,
                },
            },
            update: {
                totalReportes: { increment: 1 },
                reportesAutenticados: esAnonimo ? undefined : { increment: 1 },
                reportesAnonimos: esAnonimo ? { increment: 1 } : undefined,
                ultimoReporteEn: new Date(),
            },
            create: {
                identificador,
                plataformaId: plataforma.id,
                totalReportes: 1,
                reportesAutenticados: esAnonimo ? 0 : 1,
                reportesAnonimos: esAnonimo ? 1 : 0,
                ultimoReporteEn: new Date(),
            },
        });

        // Publicar en cola para procesamiento asíncrono (solo si queda en PENDIENTE)
        if (estadoInicial === "PENDIENTE") {
            try {
                await sendReporte(reporte.id, { prioridadAlta });
            } catch (queueErr) {
                const msg = queueErr instanceof Error ? queueErr.message : "Error desconocido";
                console.error("[REPORTES] Error publicando en cola:", msg);
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
                mensaje: "Reporte recibido. Tu número de seguimiento es " + numeroSeguimiento + ".",
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
