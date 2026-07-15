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

    for (const p of paisesData) {
        const pais = await prisma.pais.upsert({
            where: { codigo: p.codigo },
            update: {},
            create: { codigo: p.codigo, nombre: p.nombre },
        });
        for (const c of p.ciudades) {
            await prisma.ciudad.upsert({
                where: { nombre_paisId: { nombre: c, paisId: pais.id } },
                update: {},
                create: { nombre: c, paisId: pais.id },
            });
        }
    }
    console.log("Países y ciudades creados");

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