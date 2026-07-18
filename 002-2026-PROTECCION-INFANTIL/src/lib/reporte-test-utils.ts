import { prisma } from "./prisma";
import { createToken, hashPassword } from "./auth";
import type { RolUsuario } from "@prisma/client";

export async function crearUsuario(rol: RolUsuario = "PARENT", email?: string, password = "TestPass123") {
    const uniqueEmail = email || `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    return prisma.usuario.create({
        data: {
            email: uniqueEmail,
            nombre: "Usuario Test",
            passwordHash: await hashPassword(password),
            rol,
            estado: "activo",
        },
    });
}

export async function crearTokenUsuario(userId: string, rol: RolUsuario) {
    return createToken({ sub: userId, rol });
}

export function crearRequestAutenticado(
    method: string,
    url: string,
    body: unknown,
    token?: string
): Request {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
        headers.cookie = `token=${token}`;
    }
    return new Request(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
}

export async function crearPlataforma(clave = "whatsapp", nombre = "WhatsApp", categoria = "mensajeria") {
    return prisma.plataforma.upsert({
        where: { clave },
        update: {},
        create: { clave, nombre, categoria },
    });
}

export async function crearPaisCiudad() {
    const pais = await prisma.pais.upsert({
        where: { codigo: "CO" },
        update: {},
        create: { codigo: "CO", nombre: "Colombia" },
    });
    const ciudad = await prisma.ciudad.upsert({
        where: { nombre_paisId: { nombre: "Bogotá", paisId: pais.id } },
        update: { lat: 4.711, lng: -74.0721 },
        create: { nombre: "Bogotá", paisId: pais.id, lat: 4.711, lng: -74.0721 },
    });
    return { pais, ciudad };
}

export async function crearParametrosReportes() {
    const params = [
        { clave: "visibility.report_threshold", valor: "3", tipo: "INTEGER" as const, categoria: "VISIBILITY" as const, esPublico: true },
        { clave: "visibility.min_authenticated_ratio", valor: "0.5", tipo: "FLOAT" as const, categoria: "VISIBILITY" as const, esPublico: true },
        { clave: "reportes.classification_model", valor: "ornith:9b", tipo: "STRING" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "reportes.classification.umbral_revision", valor: "0.5", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "reportes.classification.min_score_categoria", valor: "0.3", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "reportes.classification.n_votos", valor: "5", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "reportes.classification.temperatura_votos", valor: "0.7", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "reportes.classification.ollama_num_parallel", valor: "2", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "reportes.classification.rag_top_k", valor: "3", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "reportes.embedding_model", valor: "nomic-embed-text", tipo: "STRING" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "reportes.duplicate.similarity_threshold", valor: "0.92", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "reportes.anonymization_model", valor: "ornith:9b", tipo: "STRING" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ranking.weight.count", valor: "10", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ranking.weight.recency", valor: "15", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ranking.weight.severity", valor: "50", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ranking.weight.authenticated", valor: "25", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ranking.recency_days", valor: "90", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ranking.threshold.low", valor: "30", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ranking.threshold.medium", valor: "70", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.weight.count", valor: "10", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.weight.recency", valor: "15", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.weight.severity", valor: "45", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.weight.authenticated", valor: "20", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.weight.diversity", valor: "10", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.recency_days", valor: "90", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.diversity.max_cities", valor: "5", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.threshold.low", valor: "35", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.threshold.medium", valor: "60", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.threshold.high", valor: "80", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.enabled", valor: "false", tipo: "BOOLEAN" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.anonymous", valor: "0.65", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.authenticated", valor: "1.0", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.new_account_factor", valor: "0.7", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.new_account_days_threshold", valor: "7", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.burst_factor", valor: "0.4", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.burst_window_hours", valor: "24", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.burst_max_reports", valor: "3", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.confirmed_factor", valor: "1.2", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "scoring.source_weight.discarded_factor", valor: "0.3", tipo: "FLOAT" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "anti_abuso.retencion_fuente_dias", valor: "90", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "operadores.cupo_maximo_default", valor: "10", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "operadores.estrategia_asignacion", valor: "ponderado_carga_inversa", tipo: "STRING" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.report.window_seconds", valor: "3600", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.report.max_requests", valor: "5", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.login.window_seconds", valor: "300", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.login.max_requests", valor: "10", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.consulta.window_seconds", valor: "60", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.consulta.max_requests", valor: "30", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.register.window_seconds", valor: "3600", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.register.max_requests", valor: "10", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.ia_sandbox.window_seconds", valor: "600", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.ia_sandbox.max_requests", valor: "10", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.report_identificador.window_seconds", valor: "3600", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.report_identificador.max_requests", valor: "10", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.report_identificador.spam_threshold", valor: "20", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.report_fingerprint.window_seconds", valor: "3600", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.report_fingerprint.max_requests", valor: "5", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "anti_abuso.apelacion_pausa_dias", valor: "7", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.apelacion.window_seconds", valor: "86400", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.apelacion.max_requests", valor: "3", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.apelacion_sms.window_seconds", valor: "3600", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "ratelimit.apelacion_sms.max_requests", valor: "3", tipo: "INTEGER" as const, categoria: "SECURITY" as const, esPublico: false },
        { clave: "alerts.admin.enabled", valor: "true", tipo: "BOOLEAN" as const, categoria: "EMAIL" as const, esPublico: false },
        { clave: "alerts.critical_score.enabled", valor: "true", tipo: "BOOLEAN" as const, categoria: "EMAIL" as const, esPublico: false },
        { clave: "worker.max_reintentos", valor: "3", tipo: "INTEGER" as const, categoria: "SYSTEM" as const, esPublico: false },
        { clave: "worker.retry_delay_segundos", valor: "30", tipo: "INTEGER" as const, categoria: "SYSTEM" as const, esPublico: false },
        { clave: "worker.concurrencia", valor: "2", tipo: "INTEGER" as const, categoria: "SYSTEM" as const, esPublico: false },
        { clave: "worker.max_pendientes", valor: "100", tipo: "INTEGER" as const, categoria: "SYSTEM" as const, esPublico: false },
    ];

    for (const p of params) {
        await prisma.$executeRaw`
            INSERT INTO "ParametroSistema" (id, clave, valor, tipo, categoria, "esPublico", "creadoEn", "actualizadoEn")
            VALUES (${crypto.randomUUID()}, ${p.clave}, ${p.valor}, ${p.tipo}::"TipoParametro", ${p.categoria}::"CategoriaParametro", ${p.esPublico}, NOW(), NOW())
            ON CONFLICT (clave) DO NOTHING
        `;
    }
}

export function bodyToRequest(body: unknown): Request {
    return new Request("http://localhost:5005/api/reportes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}
