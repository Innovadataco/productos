import { PrismaClient, RolUsuario, TipoPeriodoServicio, TipoParametro, CategoriaParametro, CasoEvalFuente, CategoriaConducta } from "@prisma/client";
import { generarEmbedding } from "@/lib/ai/embedder";
// DECISION-PENDIENTE-PO: categorías de plataforma podrían requerir ajuste
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

async function main() {
    // Admin de prueba para desarrollo (solo desarrollo; cambiar/eliminar antes de producción)
    const adminEmail = "soporte@innovadataco.com";
    const adminPassword = "Admin123!Test";
    await prisma.usuario.upsert({
        where: { email: adminEmail },
        update: {
            passwordHash: await bcrypt.hash(adminPassword, 12),
            estado: "activo",
            debeCambiarPassword: false,
        },
        create: {
            email: adminEmail,
            nombre: "Administrador",
            passwordHash: await bcrypt.hash(adminPassword, 12),
            rol: RolUsuario.ADMIN,
            estado: "activo",
            debeCambiarPassword: false,
        },
    });
    console.log("Admin de prueba creado/actualizado");

    // Default parameters
    const defaults = [
        {
            clave: "visibility.report_threshold",
            valor: "3",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.VISIBILITY,
            esPublico: true,
            descripcion: "Mínimo reportes independientes para visibilidad pública",
        },
        {
            clave: "security.max_login_attempts",
            valor: "5",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Intentos fallidos antes de bloqueo temporal",
        },
        {
            clave: "security.lockout_duration_minutes",
            valor: "30",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Minutos de bloqueo tras exceder intentos",
        },
        {
            clave: "security.password_min_length",
            valor: "8",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: true,
            descripcion: "Longitud mínima de contraseña",
        },
        {
            clave: "security.jwt_ttl_hours",
            valor: "24",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Vida del token JWT en horas",
        },
        {
            clave: "system.maintenance_mode",
            valor: "false",
            tipo: TipoParametro.BOOLEAN,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: true,
            descripcion: "Modo mantenimiento de la plataforma",
        },
        {
            clave: "ui.sla_horas_procesamiento",
            valor: "24",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: true,
            descripcion: "Horas máximas que un reporte puede estar \"En proceso\" antes de mostrar advertencia al usuario",
        },
        {
            clave: "ui.grupos_categoria",
            valor: JSON.stringify({
                grupos: [
                    {
                        clave: "contacto_sexual",
                        nombre: "Contacto sexual",
                        orden: 1,
                        categorias: ["SOLICITUD_MATERIAL", "COMPARTIMIENTO_SEXUAL", "SOLICITUD_ENCUENTRO"],
                    },
                    {
                        clave: "manipulacion_engano",
                        nombre: "Manipulación o engaño",
                        orden: 2,
                        categorias: ["OFRECIMIENTO_REGALOS", "CONTACTO_INSISTENTE", "SUPLANTACION_IDENTIDAD"],
                    },
                    {
                        clave: "amenazas_extorsion",
                        nombre: "Amenazas o extorsión",
                        orden: 3,
                        categorias: ["EXTORSION", "DIFUSION_NO_CONSENTIDA", "DOXING"],
                    },
                    {
                        clave: "contenido_falso_ia",
                        nombre: "Contenido falso (IA)",
                        orden: 4,
                        categorias: ["CONTENIDO_GENERADO_IA"],
                    },
                    {
                        clave: "otro",
                        nombre: "Otro",
                        orden: 5,
                        categorias: ["OTRO"],
                    },
                ],
            }),
            tipo: TipoParametro.JSON,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: true,
            descripcion: "Grupos de presentación de categorías de conducta para el usuario final",
        },
        {
            clave: "system.ollama_base_url",
            valor: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
            tipo: TipoParametro.STRING,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "URL base del servidor Ollama local (validado R2: solo localhost/IPs privadas)",
        },
        {
            clave: "worker.max_reintentos",
            valor: "3",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Máximo de reintentos ante fallo de procesamiento",
        },
        {
            clave: "worker.retry_delay_segundos",
            valor: "30",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Delay base entre reintentos de procesamiento",
        },
        {
            clave: "worker.concurrencia",
            valor: "2",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Jobs en paralelo según capacidad de GPU",
        },
        {
            clave: "worker.max_pendientes",
            valor: "100",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Límite de jobs pendientes para backpressure",
        },
    ];

    for (const p of defaults) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: {},
            create: p,
        });
    }
    console.log("Parámetros por defecto creados");

    // Nuevos parámetros del módulo de reportes (fase 2)
    const reportesParams = [
        {
            clave: "reportes.classification_model",
            valor: "ornith:9b",
            tipo: TipoParametro.STRING,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Modelo Ollama para clasificación de conductas",
        },
        {
            clave: "reportes.classification.umbral_revision",
            valor: "1.0",
            tipo: TipoParametro.FLOAT,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Umbral de confianza mínima para clasificar sin revisión manual",
        },
        {
            clave: "clasificacion.umbral_spam",
            valor: "0.7",
            tipo: TipoParametro.FLOAT,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Confianza mínima para que la IA marque un reporte como POSIBLE_SPAM",
        },
        {
            clave: "reportes.classification.min_score_categoria",
            valor: "0.3",
            tipo: TipoParametro.FLOAT,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Score mínimo para que una categoría sea principal o secundaria",
        },
        {
            clave: "reportes.classification.n_votos",
            valor: "5",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Número de votos independientes del clasificador (F4)",
        },
        {
            clave: "reportes.classification.modelo_desempate",
            valor: "",
            tipo: TipoParametro.STRING,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Modelo de desempate para casos no unánimes (F6). Vacío = deshabilitado.",
        },
        {
            clave: "reportes.rafaga.n_reportes",
            valor: "3",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Cantidad de reportes en X horas contra un identificador sin historial que dispara revisión por ráfaga (F7)",
        },
        {
            clave: "reportes.rafaga.ventana_horas",
            valor: "24",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Ventana en horas para detectar ráfagas de reportes contra un mismo identificador (F7)",
        },
        {
            clave: "reportes.classification.temperatura_votos",
            valor: "0.7",
            tipo: TipoParametro.FLOAT,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Temperatura para las llamadas de votación del clasificador (F4); llamadas únicas usan 0",
        },
        {
            clave: "reportes.classification.ollama_num_parallel",
            valor: "2",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Máximo de llamadas Ollama en paralelo durante la votación (F4)",
        },
        {
            clave: "reportes.classification.rag_top_k",
            valor: "3",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Cantidad de ejemplos RAG recuperados para el prompt de clasificación (F5)",
        },
        {
            clave: "reportes.embedding_model",
            valor: "nomic-embed-text",
            tipo: TipoParametro.STRING,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Modelo Ollama para embeddings de similitud",
        },
        {
            clave: "reportes.duplicate.similarity_threshold",
            valor: "0.92",
            tipo: TipoParametro.FLOAT,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Umbral de similitud coseno para duplicados anónimos",
        },
        {
            clave: "reportes.spam.min_text_length",
            valor: "20",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: true,
            descripcion: "Longitud mínima de texto para no marcar como spam",
        },
        {
            clave: "reportes.worker.max_retries",
            valor: "3",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Máximo de reintentos de procesamiento por job",
        },
        {
            clave: "reportes.worker.stalled_threshold_minutes",
            valor: "5",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Minutos antes de alertar cola estancada",
        },
        {
            clave: "reportes.anonymization_model",
            valor: "ornith:9b",
            tipo: TipoParametro.STRING,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Modelo Ollama para anonimización automática de PII",
        },
        {
            clave: "ranking.weight.count",
            valor: "10",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Peso de la cantidad de reportes en el score",
        },
        {
            clave: "ranking.weight.recency",
            valor: "15",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Peso de la recencia de reportes en el score",
        },
        {
            clave: "ranking.weight.severity",
            valor: "50",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Peso de la severidad de categorías en el score",
        },
        {
            clave: "ranking.weight.authenticated",
            valor: "25",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Peso del ratio de reportes autenticados en el score",
        },
        {
            clave: "ranking.recency_days",
            valor: "90",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Días para considerar un reporte como reciente",
        },
        {
            clave: "ranking.threshold.low",
            valor: "30",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Umbral inferior de score (riesgo bajo/medio)",
        },
        {
            clave: "ranking.threshold.medium",
            valor: "70",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Umbral medio de score (riesgo medio/alto)",
        },
        {
            clave: "ranking.severity.CONTACTO_INSISTENTE",
            valor: "30",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Severidad base para CONTACTO_INSISTENTE",
        },
        {
            clave: "ranking.severity.SOLICITUD_MATERIAL",
            valor: "80",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Severidad base para SOLICITUD_MATERIAL",
        },
        {
            clave: "ranking.severity.OFRECIMIENTO_REGALOS",
            valor: "60",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Severidad base para OFRECIMIENTO_REGALOS",
        },
        {
            clave: "ranking.severity.SUPLANTACION_IDENTIDAD",
            valor: "70",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Severidad base para SUPLANTACION_IDENTIDAD",
        },
        {
            clave: "ranking.severity.SOLICITUD_ENCUENTRO",
            valor: "90",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Severidad base para SOLICITUD_ENCUENTRO",
        },
        {
            clave: "ranking.severity.COMPARTIMIENTO_SEXUAL",
            valor: "95",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Severidad base para COMPARTIMIENTO_SEXUAL",
        },
        {
            clave: "ranking.severity.OTRO",
            valor: "20",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Severidad base para OTRO",
        },
        {
            clave: "scoring.weight.count",
            valor: "10",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Peso de la cantidad de reportes en el score F1",
        },
        {
            clave: "scoring.weight.recency",
            valor: "15",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Peso de la recencia de reportes en el score F1",
        },
        {
            clave: "scoring.weight.severity",
            valor: "45",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Peso de la severidad de categorías en el score F1",
        },
        {
            clave: "scoring.weight.authenticated",
            valor: "20",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Peso del ratio de reportes autenticados en el score F1",
        },
        {
            clave: "scoring.weight.diversity",
            valor: "10",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Peso de la diversidad geográfica en el score F1",
        },
        {
            clave: "scoring.recency_days",
            valor: "90",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Días para considerar un reporte como reciente en el score F1",
        },
        {
            clave: "scoring.diversity.max_cities",
            valor: "5",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Número de ciudades diferentes que otorgan puntaje máximo de diversidad",
        },
        {
            clave: "scoring.threshold.low",
            valor: "35",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Umbral inferior de score F1 (riesgo bajo/medio)",
        },
        {
            clave: "scoring.threshold.medium",
            valor: "60",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Umbral medio de score F1 (riesgo medio/alto)",
        },
        {
            clave: "scoring.threshold.high",
            valor: "80",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Umbral alto de score F1 (riesgo alto/crítico)",
        },
        {
            clave: "scoring.source_weight.enabled",
            valor: "false",
            tipo: TipoParametro.BOOLEAN,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Activar ajuste de score por peso de fuente (anti-abuso Fase A)",
        },
        {
            clave: "scoring.source_weight.anonymous",
            valor: "0.65",
            tipo: TipoParametro.FLOAT,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Peso base de reportes anónimos",
        },
        {
            clave: "scoring.source_weight.authenticated",
            valor: "1.0",
            tipo: TipoParametro.FLOAT,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Peso base de reportes autenticados",
        },
        {
            clave: "scoring.source_weight.new_account_factor",
            valor: "0.7",
            tipo: TipoParametro.FLOAT,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Factor multiplicador para cuentas recién creadas",
        },
        {
            clave: "scoring.source_weight.new_account_days_threshold",
            valor: "7",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Días de antigüedad para considerar una cuenta como nueva",
        },
        {
            clave: "scoring.source_weight.burst_factor",
            valor: "0.4",
            tipo: TipoParametro.FLOAT,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Factor multiplicador para ráfagas de reportes",
        },
        {
            clave: "scoring.source_weight.burst_window_hours",
            valor: "24",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Ventana en horas para detectar ráfagas de reportes",
        },
        {
            clave: "scoring.source_weight.burst_max_reports",
            valor: "3",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Máximo de reportes en la ventana antes de considerar ráfaga",
        },
        {
            clave: "scoring.source_weight.confirmed_factor",
            valor: "1.2",
            tipo: TipoParametro.FLOAT,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Factor multiplicador por cada reporte confirmado previo",
        },
        {
            clave: "scoring.source_weight.discarded_factor",
            valor: "0.3",
            tipo: TipoParametro.FLOAT,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Factor multiplicador por cada reporte descartado previo",
        },
        {
            clave: "anti_abuso.retencion_fuente_dias",
            valor: "90",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Días de retención de hashes de fuente (IP/fingerprint) para anti-abuso",
        },
        {
            clave: "visibility.min_authenticated_ratio",
            valor: "0.5",
            tipo: TipoParametro.FLOAT,
            categoria: CategoriaParametro.VISIBILITY,
            esPublico: true,
            descripcion: "Ratio mínimo de reportes autenticados para visibilidad pública",
        },
        {
            clave: "ratelimit.report.window_seconds",
            valor: "3600",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Ventana de rate limiting para reportes (segundos)",
        },
        {
            clave: "ratelimit.report.max_requests",
            valor: "5",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Máximo de reportes permitidos por ventana",
        },
        {
            clave: "ratelimit.login.window_seconds",
            valor: "300",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Ventana de rate limiting para login (segundos)",
        },
        {
            clave: "ratelimit.login.max_requests",
            valor: "10",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Máximo de intentos de login por ventana",
        },
        {
            clave: "ratelimit.consulta.window_seconds",
            valor: "60",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Ventana de rate limiting para consulta pública (segundos)",
        },
        {
            clave: "ratelimit.consulta.max_requests",
            valor: "30",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Máximo de consultas públicas por ventana",
        },
        {
            clave: "ratelimit.register.window_seconds",
            valor: "3600",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Ventana de rate limiting para registro (segundos)",
        },
        {
            clave: "ratelimit.register.max_requests",
            valor: "10",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Máximo de registros por ventana",
        },
        {
            clave: "alerts.admin.enabled",
            valor: "true",
            tipo: TipoParametro.BOOLEAN,
            categoria: CategoriaParametro.EMAIL,
            esPublico: false,
            descripcion: "Enviar alertas por email a administradores",
        },
        {
            clave: "alerts.critical_score.enabled",
            valor: "true",
            tipo: TipoParametro.BOOLEAN,
            categoria: CategoriaParametro.EMAIL,
            esPublico: false,
            descripcion: "Enviar alerta cuando un identificador alcanza score crítico",
        },
        {
            clave: "alerts.subscriptions.enabled",
            valor: "true",
            tipo: TipoParametro.BOOLEAN,
            categoria: CategoriaParametro.EMAIL,
            esPublico: false,
            descripcion: "Enviar alertas por email a usuarios suscritos a identificadores",
        },
        {
            clave: "ratelimit.admin_read.window_seconds",
            valor: "60",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Ventana de rate limiting para lecturas del panel admin (segundos)",
        },
        {
            clave: "ratelimit.admin_read.max_requests",
            valor: "60",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Máximo de lecturas del panel admin por ventana",
        },
        {
            clave: "ratelimit.admin_write.window_seconds",
            valor: "60",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Ventana de rate limiting para escrituras del panel admin (segundos)",
        },
        {
            clave: "ratelimit.admin_write.max_requests",
            valor: "30",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Máximo de escrituras del panel admin por ventana",
        },
        {
            clave: "ratelimit.seguimiento.window_seconds",
            valor: "60",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Ventana de rate limiting para consulta de seguimiento pública (segundos)",
        },
        {
            clave: "ratelimit.seguimiento.max_requests",
            valor: "10",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Máximo de consultas de seguimiento por ventana",
        },
        {
            clave: "anti_abuso.apelacion_pausa_dias",
            valor: "7",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Días máximos de pausa de visibilidad por apelación (Fase C)",
        },
        {
            clave: "ratelimit.apelacion.window_seconds",
            valor: "86400",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Ventana de rate limiting para creación de apelaciones (segundos)",
        },
        {
            clave: "ratelimit.apelacion.max_requests",
            valor: "3",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Máximo de apelaciones por identificador por ventana",
        },
        {
            clave: "ratelimit.apelacion_sms.window_seconds",
            valor: "3600",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Ventana de rate limiting para envío/verificación de SMS de apelación (segundos)",
        },
        {
            clave: "ratelimit.apelacion_sms.max_requests",
            valor: "3",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Máximo de envíos/verificaciones de SMS por apelación por ventana",
        },
        {
            clave: "ratelimit.report_identificador.window_seconds",
            valor: "3600",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Ventana de rate limit por identificador/plataforma (anti-abuso Fase B)",
        },
        {
            clave: "ratelimit.report_identificador.max_requests",
            valor: "10",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Máximo de reportes por identificador/plataforma antes de marcar para revisión",
        },
        {
            clave: "ratelimit.report_identificador.spam_threshold",
            valor: "20",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Umbral de reportes por identificador/plataforma para marcar como POSIBLE_SPAM",
        },
        {
            clave: "ratelimit.report_fingerprint.window_seconds",
            valor: "3600",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Ventana de rate limit por fingerprint server-side (anti-abuso Fase B)",
        },
        {
            clave: "ratelimit.report_fingerprint.max_requests",
            valor: "5",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Máximo de reportes por fingerprint server-side por ventana",
        },
        {
            clave: "ratelimit.ia_sandbox.window_seconds",
            valor: "600",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Ventana de rate limiting para el sandbox de IA (segundos)",
        },
        {
            clave: "ratelimit.ia_sandbox.max_requests",
            valor: "10",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Máximo de ejecuciones del sandbox de IA por ventana (modo comparación cuenta doble)",
        },
        {
            clave: "circulo.max_contactos",
            valor: "20",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Máximo de contactos activos por usuario en Círculo de Confianza",
        },
        {
            clave: "circulo.umbral_agregacion",
            valor: '{"contactosConReportes":2,"totalReportes":3}',
            tipo: TipoParametro.JSON,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Umbral mínimo para mostrar vista agregada del Círculo de Confianza",
        },
        {
            clave: "circulo.notificaciones.enabled",
            valor: "true",
            tipo: TipoParametro.BOOLEAN,
            categoria: CategoriaParametro.EMAIL,
            esPublico: false,
            descripcion: "Enviar alertas por email de Círculo de Confianza",
        },
        {
            clave: "circulo.notificaciones.cooldown_horas",
            valor: "24",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.EMAIL,
            esPublico: false,
            descripcion: "Cooldown mínimo entre alertas de Círculo de Confianza (horas)",
        },
        {
            clave: "ratelimit.circulo_contacto.window_seconds",
            valor: "3600",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Ventana de rate limiting para alta de contactos en Círculo de Confianza (segundos)",
        },
        {
            clave: "ratelimit.circulo_contacto.max_requests",
            valor: "20",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Máximo de altas de contactos en Círculo de Confianza por ventana",
        },
        {
            clave: "comite.notificaciones.enabled",
            valor: "true",
            tipo: TipoParametro.BOOLEAN,
            categoria: CategoriaParametro.EMAIL,
            esPublico: false,
            descripcion: "Enviar alertas por email al comité de validación",
        },
        {
            clave: "comite.notificaciones.frecuencia_horas",
            valor: "24",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.EMAIL,
            esPublico: false,
            descripcion: "Frecuencia mínima entre alertas al comité de validación (horas)",
        },
    ];

    for (const p of reportesParams) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: {},
            create: p,
        });
    }
    console.log("Parámetros del módulo de reportes creados");

    // Plataformas para reportes (fase 2)
    const plataformas = [
        { clave: "whatsapp", nombre: "WhatsApp", categoria: "mensajeria" },
        { clave: "instagram", nombre: "Instagram", categoria: "red_social" },
        { clave: "tiktok", nombre: "TikTok", categoria: "red_social" },
        { clave: "facebook", nombre: "Facebook", categoria: "red_social" },
        { clave: "discord", nombre: "Discord", categoria: "mensajeria" },
        { clave: "roblox", nombre: "Roblox", categoria: "juego" },
        { clave: "minecraft", nombre: "Minecraft", categoria: "juego" },
        { clave: "telegram", nombre: "Telegram", categoria: "mensajeria" },
        { clave: "snapchat", nombre: "Snapchat", categoria: "red_social" },
        { clave: "otro", nombre: "Otra plataforma", categoria: "otro" },
    ];

    for (const pl of plataformas) {
        await prisma.plataforma.upsert({
            where: { clave: pl.clave },
            update: {},
            create: pl,
        });
    }
    console.log("Plataformas creadas");

    // Coordenadas aproximadas de ciudades principales para el mapa de consulta pública
    const COORDENADAS_CIUDADES: Record<string, { lat: number; lng: number }> = {
        "CO:Bogotá": { lat: 4.7110, lng: -74.0721 },
        "CO:Medellín": { lat: 6.2476, lng: -75.5658 },
        "CO:Cali": { lat: 3.4516, lng: -76.5320 },
        "CO:Barranquilla": { lat: 10.9685, lng: -74.7813 },
        "CO:Cartagena": { lat: 10.3910, lng: -75.4794 },
        "CO:Bucaramanga": { lat: 7.1193, lng: -73.1227 },
        "CO:Pereira": { lat: 4.8087, lng: -75.6906 },
        "CO:Manizales": { lat: 5.0689, lng: -75.5174 },
        "CO:Cúcuta": { lat: 7.8939, lng: -72.5078 },
        "CO:Ibagué": { lat: 4.4447, lng: -75.2424 },
        "MX:Ciudad de México": { lat: 19.4326, lng: -99.1332 },
        "MX:Guadalajara": { lat: 20.6597, lng: -103.3496 },
        "MX:Monterrey": { lat: 25.6866, lng: -100.3161 },
        "MX:Puebla": { lat: 19.0414, lng: -98.2063 },
        "MX:Tijuana": { lat: 32.5149, lng: -117.0382 },
        "AR:Buenos Aires": { lat: -34.6037, lng: -58.3816 },
        "AR:Córdoba": { lat: -31.4201, lng: -64.1888 },
        "AR:Rosario": { lat: -32.9442, lng: -60.6505 },
        "BR:São Paulo": { lat: -23.5505, lng: -46.6333 },
        "BR:Río de Janeiro": { lat: -22.9068, lng: -43.1729 },
        "BR:Brasilia": { lat: -15.7975, lng: -47.8919 },
        "CL:Santiago": { lat: -33.4489, lng: -70.6693 },
        "CL:Valparaíso": { lat: -33.0472, lng: -71.6127 },
        "PE:Lima": { lat: -12.0464, lng: -77.0428 },
        "PE:Arequipa": { lat: -16.3989, lng: -71.5350 },
        "EC:Quito": { lat: -0.1807, lng: -78.4678 },
        "EC:Guayaquil": { lat: -2.1894, lng: -79.8891 },
        "VE:Caracas": { lat: 10.4806, lng: -66.9036 },
        "UY:Montevideo": { lat: -34.9011, lng: -56.1645 },
        "PY:Asunción": { lat: -25.2637, lng: -57.5759 },
        "BO:La Paz": { lat: -16.5000, lng: -68.1500 },
        "BO:Santa Cruz de la Sierra": { lat: -17.7833, lng: -63.1833 },
        "CR:San José": { lat: 9.9281, lng: -84.0907 },
        "PA:Ciudad de Panamá": { lat: 8.9824, lng: -79.5199 },
        "GT:Ciudad de Guatemala": { lat: 14.6349, lng: -90.5069 },
        "DO:Santo Domingo": { lat: 18.4861, lng: -69.9312 },
        "HN:Tegucigalpa": { lat: 14.0723, lng: -87.2068 },
        "SV:San Salvador": { lat: 13.6929, lng: -89.2182 },
        "NI:Managua": { lat: 12.1150, lng: -86.2362 },
    };

    // Seed de Países y Ciudades (Latinoamérica)
    const paisesData = [
        { codigo: "CO", nombre: "Colombia", ciudades: ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena", "Bucaramanga", "Pereira", "Manizales", "Cúcuta", "Ibagué"] },
        { codigo: "MX", nombre: "México", ciudades: ["Ciudad de México", "Guadalajara", "Monterrey", "Puebla", "Tijuana", "León", "Cancún", "Mérida"] },
        { codigo: "AR", nombre: "Argentina", ciudades: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "La Plata", "Mar del Plata", "Salta", "Tucumán"] },
        { codigo: "BR", nombre: "Brasil", ciudades: ["São Paulo", "Río de Janeiro", "Brasilia", "Salvador", "Fortaleza", "Belo Horizonte", "Manaos", "Curitiba"] },
        { codigo: "CL", nombre: "Chile", ciudades: ["Santiago", "Valparaíso", "Concepción", "La Serena", "Antofagasta", "Temuco", "Iquique", "Puerto Montt"] },
        { codigo: "PE", nombre: "Perú", ciudades: ["Lima", "Arequipa", "Trujillo", "Cusco", "Chiclayo", "Piura", "Iquitos", "Huancayo"] },
        { codigo: "EC", nombre: "Ecuador", ciudades: ["Quito", "Guayaquil", "Cuenca", "Ambato", "Manta", "Loja", "Portoviejo"] },
        { codigo: "VE", nombre: "Venezuela", ciudades: ["Caracas", "Maracaibo", "Valencia", "Barquisimeto", "Maracay", "Maturín", "San Cristóbal"] },
        { codigo: "UY", nombre: "Uruguay", ciudades: ["Montevideo", "Punta del Este", "Salto", "Paysandú", "Maldonado", "Rivera"] },
        { codigo: "PY", nombre: "Paraguay", ciudades: ["Asunción", "Ciudad del Este", "San Lorenzo", "Luque", "Capiatá", "Lambaré"] },
        { codigo: "BO", nombre: "Bolivia", ciudades: ["La Paz", "Santa Cruz de la Sierra", "Cochabamba", "Sucre", "Oruro", "Potosí", "Tarija"] },
        { codigo: "CR", nombre: "Costa Rica", ciudades: ["San José", "Cartago", "Alajuela", "Heredia", "Liberia", "Puntarenas"] },
        { codigo: "PA", nombre: "Panamá", ciudades: ["Ciudad de Panamá", "Colón", "David", "Santiago", "Chitré", "Penonomé"] },
        { codigo: "GT", nombre: "Guatemala", ciudades: ["Ciudad de Guatemala", "Quetzaltenango", "Escuintla", "Villa Nueva", "Mazatenango", "Cobán"] },
        { codigo: "DO", nombre: "República Dominicana", ciudades: ["Santo Domingo", "Santiago", "La Romana", "San Pedro de Macorís", "Higüey", "Puerto Plata"] },
        { codigo: "HN", nombre: "Honduras", ciudades: ["Tegucigalpa", "San Pedro Sula", "La Ceiba", "Choluteca", "Comayagua", "El Progreso"] },
        { codigo: "SV", nombre: "El Salvador", ciudades: ["San Salvador", "Santa Ana", "San Miguel", "Soyapango", "Apopa", "Mejicanos"] },
        { codigo: "NI", nombre: "Nicaragua", ciudades: ["Managua", "León", "Masaya", "Matagalpa", "Chinandega", "Estelí"] },
    ];

    // División político-administrativa de Colombia: 32 departamentos + Bogotá D.C.
    const departamentosColombia = [
        { nombre: "Amazonas", ciudades: ["Leticia"] },
        { nombre: "Antioquia", ciudades: ["Medellín", "Bello", "Envigado", "Itagüí", "Rionegro"] },
        { nombre: "Arauca", ciudades: ["Arauca"] },
        { nombre: "Atlántico", ciudades: ["Barranquilla", "Soledad", "Malambo"] },
        { nombre: "Bolívar", ciudades: ["Cartagena", "Magangué", "Turbaco"] },
        { nombre: "Boyacá", ciudades: ["Tunja", "Duitama", "Sogamoso"] },
        { nombre: "Caldas", ciudades: ["Manizales", "Villamaría", "Chinchiná"] },
        { nombre: "Caquetá", ciudades: ["Florencia"] },
        { nombre: "Casanare", ciudades: ["Yopal", "Aguazul"] },
        { nombre: "Cauca", ciudades: ["Popayán", "Santander de Quilichao"] },
        { nombre: "Cesar", ciudades: ["Valledupar", "Aguachica"] },
        { nombre: "Chocó", ciudades: ["Quibdó", "Istmina"] },
        { nombre: "Córdoba", ciudades: ["Montería", "Cereté", "Lorica"] },
        { nombre: "Cundinamarca", ciudades: ["Girardot", "Fusagasugá", "Soacha"] },
        { nombre: "Bogotá D.C.", ciudades: ["Bogotá"] },
        { nombre: "Guainía", ciudades: ["Inírida"] },
        { nombre: "Guaviare", ciudades: ["San José del Guaviare"] },
        { nombre: "Huila", ciudades: ["Neiva", "Pitalito", "Garzón"] },
        { nombre: "La Guajira", ciudades: ["Riohacha", "Maicao"] },
        { nombre: "Magdalena", ciudades: ["Santa Marta", "Ciénaga"] },
        { nombre: "Meta", ciudades: ["Villavicencio", "Acacías"] },
        { nombre: "Nariño", ciudades: ["Pasto", "Ipiales", "Tumaco"] },
        { nombre: "Norte de Santander", ciudades: ["Cúcuta", "Ocaña", "Pamplona"] },
        { nombre: "Putumayo", ciudades: ["Mocoa", "Puerto Asís"] },
        { nombre: "Quindío", ciudades: ["Armenia", "Calarcá"] },
        { nombre: "Risaralda", ciudades: ["Pereira", "Dosquebradas", "Santa Rosa de Cabal"] },
        { nombre: "San Andrés y Providencia", ciudades: ["San Andrés"] },
        { nombre: "Santander", ciudades: ["Bucaramanga", "Floridablanca", "Girón"] },
        { nombre: "Sucre", ciudades: ["Sincelejo", "Corozal"] },
        { nombre: "Tolima", ciudades: ["Ibagué", "Espinal", "Melgar"] },
        { nombre: "Valle del Cauca", ciudades: ["Cali", "Palmira", "Buenaventura"] },
        { nombre: "Vaupés", ciudades: ["Mitú"] },
        { nombre: "Vichada", ciudades: ["Puerto Carreño"] },
    ];

    for (const p of paisesData) {
        const pais = await prisma.pais.upsert({
            where: { codigo: p.codigo },
            update: {},
            create: { codigo: p.codigo, nombre: p.nombre },
        });

        // Carga de Colombia con departamentos y ciudades principales
        if (p.codigo === "CO") {
            const departamentoMap = new Map<string, string>();
            for (const d of departamentosColombia) {
                const departamento = await prisma.departamento.upsert({
                    where: {
                        nombre_paisId: { nombre: d.nombre, paisId: pais.id },
                    },
                    update: {},
                    create: { nombre: d.nombre, paisId: pais.id },
                });
                departamentoMap.set(d.nombre, departamento.id);
            }

            for (const d of departamentosColombia) {
                const departamentoId = departamentoMap.get(d.nombre);
                for (const c of d.ciudades) {
                    const coords = COORDENADAS_CIUDADES[`${p.codigo}:${c}`];
                    await prisma.ciudad.upsert({
                        where: { nombre_paisId: { nombre: c, paisId: pais.id } },
                        update: {
                            lat: coords?.lat,
                            lng: coords?.lng,
                            departamentoId,
                        },
                        create: {
                            nombre: c,
                            paisId: pais.id,
                            lat: coords?.lat,
                            lng: coords?.lng,
                            departamentoId,
                        },
                    });
                }
            }

            console.log(`Colombia: ${departamentosColombia.length} departamentos y ciudades principales creados`);
            continue;
        }

        for (const c of p.ciudades) {
            const coords = COORDENADAS_CIUDADES[`${p.codigo}:${c}`];
            await prisma.ciudad.upsert({
                where: { nombre_paisId: { nombre: c, paisId: pais.id } },
                update: { lat: coords?.lat, lng: coords?.lng },
                create: { nombre: c, paisId: pais.id, lat: coords?.lat, lng: coords?.lng },
            });
        }
    }
    console.log("Países y ciudades creados");

    // Seed de casos de evaluación desde fixture (Spec 013)
    await seedEvalFixture();

    // Seed de ejemplos de spam para el RAG (Spec 026)
    await seedSpamExamples();

    // Empty SaaS tables - just verify they exist
    console.log("Tablas Tenant, Plan, Subscription, BillingCycle listas");

    // Usuarios de prueba para desarrollo
    await seedUsuariosPrueba();
}

async function seedEvalFixture() {
    const fixturePath = path.join(process.cwd(), "scripts", "eval-fixture.json");
    let raw: string;
    try {
        raw = await fs.readFile(fixturePath, "utf-8");
    } catch {
        console.warn("No se encontró scripts/eval-fixture.json; omitiendo seed de casos de evaluación");
        return;
    }

    const fixture = JSON.parse(raw) as {
        examples?: { text: string; expected: string; ruido?: boolean; secundariaEsperada?: string }[];
    };
    const examples = fixture.examples || [];
    if (examples.length === 0) {
        console.warn("eval-fixture.json no contiene ejemplos");
        return;
    }

    let created = 0;
    let updated = 0;
    for (const ex of examples) {
        const existing = await prisma.casoEval.findFirst({
            where: {
                texto: ex.text,
                fuente: CasoEvalFuente.SEMILLA,
                fixtureVersion: 1,
            },
        });

        const data = {
            categoriaEsperada: ex.expected,
            secundariaEsperada: ex.secundariaEsperada || null,
            ruido: ex.ruido ?? false,
            activo: true,
        };

        if (existing) {
            if (
                existing.categoriaEsperada !== data.categoriaEsperada ||
                existing.secundariaEsperada !== data.secundariaEsperada ||
                existing.ruido !== data.ruido ||
                existing.activo !== data.activo
            ) {
                await prisma.casoEval.update({
                    where: { id: existing.id },
                    data,
                });
                updated++;
            }
        } else {
            await prisma.casoEval.create({
                data: {
                    texto: ex.text,
                    ...data,
                    fuente: CasoEvalFuente.SEMILLA,
                    fixtureVersion: 1,
                    creadoPorId: null,
                },
            });
            created++;
        }
    }

    console.log(`Casos de evaluación SEMILLA: ${created} creados, ${updated} actualizados`);
}

async function seedSpamExamples() {
    const paramEmbedding = await prisma.parametroSistema.findUnique({ where: { clave: "reportes.embedding_model" } });
    const modeloEmbedding = paramEmbedding?.valor || "nomic-embed-text";

    const ejemplos = [
        "Compra relojes baratos viagra cripto dinero fácil 100% gratis",
        "Haz clic aquí para ganar dinero rápido en línea",
        "Visita nuestra página web para obtener productos gratuitos",
        "Promoción exclusiva: gana un teléfono nuevo solo por registrarte",
        "Envía este mensaje a todos tus contactos y gana premios",
        "Oferta limitada: compra ahora y recibe envío gratis",
        "Hola, ¿te interesaría ganar dinero desde casa? Solo necesitas un celular",
        "Descubre el secreto para hacer dinero fácil sin esfuerzo",
    ];

    let created = 0;
    let updated = 0;
    for (const texto of ejemplos) {
        const existing = await prisma.datasetEntrenamiento.findFirst({
            where: { texto, fuente: "spam_revisado" },
        });

        const data = {
            clasificacionCorrecta: CategoriaConducta.SPAM,
            textoAnonimizado: true,
        };

        let dataset;
        if (existing) {
            if (
                existing.clasificacionCorrecta !== data.clasificacionCorrecta ||
                existing.textoAnonimizado !== data.textoAnonimizado
            ) {
                dataset = await prisma.datasetEntrenamiento.update({
                    where: { id: existing.id },
                    data,
                });
                updated++;
            } else {
                dataset = existing;
            }
        } else {
            dataset = await prisma.datasetEntrenamiento.create({
                data: {
                    texto,
                    ...data,
                    fuente: "spam_revisado",
                },
            });
            created++;
        }

        const existingEmbedding = await prisma.embeddingDataset.findUnique({
            where: { datasetId: dataset.id },
        });

        if (!existingEmbedding) {
            try {
                const vector = await generarEmbedding(modeloEmbedding, texto);
                const vectorStr = "[" + vector.join(",") + "]";
                await prisma.$executeRaw`
                    INSERT INTO "EmbeddingDataset" (id, "datasetId", vector, "modeloUsado", "creadoEn")
                    VALUES (${crypto.randomUUID()}, ${dataset.id}, ${vectorStr}::vector, ${modeloEmbedding}, NOW())
                `;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(`[SEED] No se pudo generar embedding para ejemplo spam: ${msg}`);
            }
        }
    }

    console.log(`Ejemplos de spam: ${created} creados, ${updated} actualizados`);
}

async function seedUsuariosPrueba() {
    // Usuarios de prueba para desarrollo. Solo para desarrollo; cambiar/eliminar antes de producción.
    const usuarios = [
        { email: "soporte@innovadataco.com", rol: RolUsuario.ADMIN, password: "Admin123!Test", nombre: "Administrador" },
        { email: "padre@innovadataco.com", rol: RolUsuario.PARENT, password: "Padre123!Test", nombre: "padre" },
        { email: "padre1@innovadataco.com", rol: RolUsuario.PARENT, password: "Padre123!Test", nombre: "padre1" },
        { email: "carrillo_franco@hotmail.com", rol: RolUsuario.OPERADOR, password: "Operador123!Test", nombre: "operador1" },
        { email: "jelkin.carrillo@gmail.com", rol: RolUsuario.COMITE_VALIDACION, password: "Comite123!Test", nombre: "comite" },
        { email: "gerencia@innovadataco.com", rol: RolUsuario.SCHOOL_ADMIN, password: "Colegio123!Test", nombre: "colegio1" },
    ];

    // Limpieza de usuarios de prueba obsoletos de corridas anteriores del seed.
    const emailsObsoletos = [
        "admin@proteccion.local",
        "padre1@proteccion.local",
        "padre2@proteccion.local",
        "operador1@proteccion.local",
        "comite1@proteccion.local",
        "colegio1@proteccion.local",
    ];

    try {
        await prisma.usuario.deleteMany({
            where: {
                email: { in: emailsObsoletos },
                // Solo eliminar si no tienen datos reales asociados (Prisma con onDelete Cascade)
            },
        });
        console.log("Usuarios de prueba obsoletos eliminados");
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`No se pudieron eliminar usuarios de prueba obsoletos: ${msg}`);
    }

    // Colegio de prueba para el SCHOOL_ADMIN (datos mínimos válidos, vigencia futura)
    let colegioId: string | undefined;
    const colegioAdmin = usuarios.find((u) => u.rol === RolUsuario.SCHOOL_ADMIN);
    if (colegioAdmin) {
        const pais = await prisma.pais.findUnique({ where: { codigo: "CO" } });
        const departamento = await prisma.departamento.findFirst({ where: { nombre: "Antioquia", paisId: pais?.id } });
        const ciudad = await prisma.ciudad.findFirst({ where: { nombre: "Medellín", paisId: pais?.id } });

        if (!pais || !departamento || !ciudad) {
            console.warn("No se encontró país/departamento/ciudad de Colombia; omitiendo colegio de prueba");
        } else {
            const tenant = await prisma.tenant.upsert({
                where: { id: "tenant-colegio-pruebas" },
                update: {},
                create: { id: "tenant-colegio-pruebas", nombre: "Tenant Colegio de Pruebas", estado: "activo" },
            });

            const inicioServicio = new Date();
            const finServicio = new Date();
            finServicio.setFullYear(finServicio.getFullYear() + 1);

            const colegio = await prisma.colegio.upsert({
                where: { tenantId: tenant.id },
                update: {},
                create: {
                    nombre: "Colegio de Pruebas",
                    paisId: pais.id,
                    departamentoId: departamento.id,
                    ciudadId: ciudad.id,
                    direccion: "Calle de Prueba 123",
                    representanteLegalNombre: "Representante Legal de Prueba",
                    representanteLegalIdentificacion: "123456789",
                    representanteLegalEmail: "representante.colegio.prueba@proteccion.local",
                    representanteLegalTelefono: "3001234567",
                    inicioServicio,
                    finServicio,
                    tipoPeriodo: TipoPeriodoServicio.ANUAL,
                    estado: "activo",
                    tenantId: tenant.id,
                },
            });
            colegioId = colegio.id;

            // El colegio solo puede tener un SCHOOL_ADMIN; desvincular cualquier usuario previo
            await prisma.usuario.updateMany({
                where: { colegioId },
                data: { colegioId: null },
            });

            console.log("Colegio de prueba creado/actualizado");
        }
    }

    for (const u of usuarios) {
        const passwordHash = await bcrypt.hash(u.password, 12);
        await prisma.usuario.upsert({
            where: { email: u.email },
            update: {
                passwordHash,
                estado: "activo",
                debeCambiarPassword: false,
                ...(u.rol === RolUsuario.SCHOOL_ADMIN && colegioId ? { colegioId } : {}),
            },
            create: {
                email: u.email,
                nombre: u.nombre,
                passwordHash,
                rol: u.rol,
                estado: "activo",
                debeCambiarPassword: false,
                ...(u.rol === RolUsuario.SCHOOL_ADMIN && colegioId ? { colegioId } : {}),
            },
        });
    }

    console.log("Usuarios de prueba creados/actualizados");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });