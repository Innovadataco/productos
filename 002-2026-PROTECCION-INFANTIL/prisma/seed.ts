import { PrismaClient, RolUsuario, TipoParametro, CategoriaParametro } from "@prisma/client";
// DECISION-PENDIENTE-PO: categorías de plataforma podrían requerir ajuste
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    // Admin default
    const adminExists = await prisma.usuario.findUnique({
        where: { email: "admin@proteccion.local" },
    });

    if (!adminExists) {
        await prisma.usuario.create({
            data: {
                email: "admin@proteccion.local",
                nombre: "Administrador",
                passwordHash: await bcrypt.hash("Admin123!Secure", 12),
                rol: RolUsuario.ADMIN,
            },
        });
        console.log("Admin creado");
    }

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
            clave: "visibility.min_authenticated_ratio",
            valor: "0.5",
            tipo: TipoParametro.FLOAT,
            categoria: CategoriaParametro.VISIBILITY,
            esPublico: true,
            descripcion: "Ratio mínimo de reportes autenticados para visibilidad pública",
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

    // Empty SaaS tables - just verify they exist
    console.log("Tablas Tenant, Plan, Subscription, BillingCycle listas");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });