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
        update: {},
        create: { nombre: "Bogotá", paisId: pais.id },
    });
    return { pais, ciudad };
}

export async function crearParametrosReportes() {
    const params = [
        { clave: "visibility.report_threshold", valor: "3", tipo: "INTEGER" as const, categoria: "VISIBILITY" as const, esPublico: true },
        { clave: "visibility.min_authenticated_ratio", valor: "0.5", tipo: "FLOAT" as const, categoria: "VISIBILITY" as const, esPublico: true },
        { clave: "reportes.classification_model", valor: "ornith:9b", tipo: "STRING" as const, categoria: "SECURITY" as const, esPublico: false },
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
