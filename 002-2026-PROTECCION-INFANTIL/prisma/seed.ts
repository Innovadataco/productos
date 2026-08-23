import { RUBRICA_SEMILLA } from "../src/lib/ai/rubrica-semilla";
import { normalizarNombreGeografico } from "../src/lib/normalizar";
import { syncModulosYGrants } from "./seed-modulos-grants";
import { PrismaClient, RolUsuario, TipoParametro, CategoriaParametro, TipoTitular, DuracionPlan } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { realpathSync } from "fs";

let prismaInstance: PrismaClient | null = null;

function isMainModule(): boolean {
    if (typeof process === "undefined" || !process.argv[1]) return false;
    try {
        const scriptReal = realpathSync(process.argv[1]);
        const moduleReal = realpathSync(fileURLToPath(import.meta.url));
        return scriptReal === moduleReal;
    } catch {
        return false;
    }
}

function getPrisma(): PrismaClient {
    if (!prismaInstance) {
        prismaInstance = new PrismaClient();
    }
    return prismaInstance;
}

// Proxy para mantener todas las referencias existentes a `prisma` funcionales
// mientras permitimos recrear el cliente entre llamadas a main() en tests.
const prisma = new Proxy({} as PrismaClient, {
    get(_target, prop) {
        return getPrisma()[prop as keyof PrismaClient];
    },
});

// SPEC-230 (002-PI-130): parámetros del módulo Padre.
// Idempotencia anti-I-100: upsert por clave, propaga cambios de default definidos en código.
async function seedParametrosPadre() {
    const parametrosPadre = [
        { clave: "padre.expediente.auto_cierre_meses", valor: "6", tipo: TipoParametro.INTEGER, descripcion: "Meses de inactividad para auto-cierre de expediente" },
        { clave: "padre.expediente.consolidacion_min_reportes", valor: "2", tipo: TipoParametro.INTEGER, descripcion: "Mínimo de reportes para pasar a CONSOLIDANDO" },
        { clave: "padre.expediente.max_aclaraciones", valor: "1", tipo: TipoParametro.INTEGER, descripcion: "Máximo de aclaraciones por expediente" },
        { clave: "padre.expediente.rate_limit_eventos_24h", valor: "999", tipo: TipoParametro.INTEGER, descripcion: "Límite de eventos que un padre puede agregar en 24h" },
        { clave: "padre.comite.sla_horas_normal", valor: "48", tipo: TipoParametro.INTEGER, descripcion: "SLA de comité para casos normales" },
        { clave: "padre.comite.sla_horas_gravedad_roja", valor: "12", tipo: TipoParametro.INTEGER, descripcion: "SLA de comité para expedientes ROJO" },
        { clave: "padre.comite.miembros_minimos_aprobacion", valor: "2", tipo: TipoParametro.INTEGER, descripcion: "Miembros mínimos del comité para aprobación" },
        { clave: "padre.score.peso_num_reportes", valor: "2", tipo: TipoParametro.FLOAT, descripcion: "Peso del número de reportes en score" },
        { clave: "padre.score.peso_categoria_grave", valor: "5", tipo: TipoParametro.FLOAT, descripcion: "Peso de categoría grave en score" },
        { clave: "padre.score.peso_aceleracion", valor: "3", tipo: TipoParametro.FLOAT, descripcion: "Peso de aceleración de reportes en score" },
        { clave: "padre.score.peso_senal_comunitaria", valor: "4", tipo: TipoParametro.FLOAT, descripcion: "Peso de señal comunitaria en score" },
        { clave: "padre.score.umbral_amarillo", valor: "20", tipo: TipoParametro.INTEGER, descripcion: "Score mínimo para gravedad AMARILLO" },
        { clave: "padre.score.umbral_rojo", valor: "50", tipo: TipoParametro.INTEGER, descripcion: "Score mínimo para gravedad ROJO" },
        { clave: "padre.categorias_graves_json", valor: '["GROOMING","SEXTORSION","EXTORSION","DIFUSION_NO_CONSENTIDA","SOLICITUD_ENCUENTRO","COMPARTIMIENTO_SEXUAL"]', tipo: TipoParametro.STRING, descripcion: "JSON array de códigos de categorías graves" },
        { clave: "padre.patron.aceleracion_ratio_minimo", valor: "2.0", tipo: TipoParametro.FLOAT, descripcion: "Ratio mínimo de aceleración para detectar patrón" },
        { clave: "padre.patron.senal_comunitaria_perpetrador_serial", valor: "5", tipo: TipoParametro.INTEGER, descripcion: "Reportes que señalan posible perpetrador serial" },
        { clave: "padre.patron.multiplataforma_min", valor: "2", tipo: TipoParametro.INTEGER, descripcion: "Mínimo de plataformas distintas para patrón multiplataforma" },
        { clave: "padre.guia.umbral_confianza_categoria_minimo", valor: "0.4", tipo: TipoParametro.FLOAT, descripcion: "Confianza mínima de clasificación para mostrar categoría" },
    ];

    for (const p of parametrosPadre) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: {
                valor: p.valor,
                tipo: p.tipo,
                descripcion: p.descripcion,
            },
            create: {
                clave: p.clave,
                valor: p.valor,
                tipo: p.tipo,
                categoria: CategoriaParametro.SYSTEM,
                esPublico: false,
                descripcion: p.descripcion,
            },
        });
    }
    console.log("Parámetros padre (SPEC-230) listos");
}
// SPEC-210 (002-PI-110): seed de planes base del módulo de pagos.
// EXCEPCIÓN DOCUMENTADA: los planes son estructurales del motor de pagos.
// Cuando cambia el catálogo, duración o año base, el seed debe propagar el
// cambio con update explícito (anti-I-100). El primer seed es INSERT limpio.
async function seedPlanesPagos(adminId: string) {
    const planesBase = [];
    for (const tipo of [TipoTitular.COLEGIO, TipoTitular.PADRE]) {
        for (const duracion of [
            DuracionPlan.MES_1,
            DuracionPlan.MES_2,
            DuracionPlan.MES_3,
            DuracionPlan.MES_6,
            DuracionPlan.MES_12,
        ]) {
            planesBase.push({
                tipoTitular: tipo,
                duracion,
                anio: 2026,
                nombre: `${tipo} · ${duracion} · 2026`,
                precio: 0, // legacy placeholder; no usar en lógica nueva
                precioBaseUSD: 0,
                activo: true,
                descripcion: `Plan ${tipo} ${duracion} 2026 (precio placeholder)`,
                creadoPorAdminId: adminId,
            });
        }
    }

    for (const plan of planesBase) {
        await prisma.plan.upsert({
            where: {
                tipoTitular_duracion_anio: {
                    tipoTitular: plan.tipoTitular,
                    duracion: plan.duracion,
                    anio: plan.anio,
                },
            },
            update: {
                precioBaseUSD: plan.precioBaseUSD,
                activo: plan.activo,
                descripcion: plan.descripcion,
                creadoPorAdminId: plan.creadoPorAdminId,
            },
            create: plan,
        });
    }
    console.log(`[SEED] ${planesBase.length} planes de pagos listos`);
}

// SPEC-210 (002-PI-110): parámetros del módulo de pagos.
async function seedParametrosPagos() {
    const pagosParams = [
        { clave: "pagos.descuento_anual_pct_default", valor: "15", tipo: TipoParametro.FLOAT, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "% descuento aplicable a duración MES_12 salvo override en Plan" },
        { clave: "pagos.freemium.duracion_dias", valor: "30", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Días de duración del freemium" },
        { clave: "pagos.freemium.activo", valor: "true", tipo: TipoParametro.BOOLEAN, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Activar freemium para nuevos clientes" },
        { clave: "pagos.referidos.max_por_año", valor: "5", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Máximo de referidos exitosos por año por cliente" },
        { clave: "pagos.referidos.notificar_admin_al", valor: "4", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Al 4º referido del año notificar a admin para revisión" },
        { clave: "pagos.gracia_dias", valor: "3", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Días de gracia antes del corte automático" },
        { clave: "pagos.moneda_base", valor: "USD", tipo: TipoParametro.STRING, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Moneda base del modelo comercial" },
        { clave: "pagos.tasas.api_url_default", valor: "https://api.exchangerate.host/v1/latest?access_key=REPLACE_ME&base=USD&symbols=", tipo: TipoParametro.STRING, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "URL default para consulta de tasas de cambio" },
        { clave: "pagos.tasas.refresco_horas", valor: "24", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Horas entre refrescos de la tasa de cambio" },
        { clave: "pagos.tasas.monedas_destino", valor: "COP,MXN,CLP,ARS", tipo: TipoParametro.STRING, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Monedas destino para tasas de cambio (CSV)" },
        { clave: "pagos.contrato_obligatorio_colegios", valor: "true", tipo: TipoParametro.BOOLEAN, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "El contrato firmado es obligatorio para colegios" },
        { clave: "pagos.contrato_obligatorio_padres", valor: "false", tipo: TipoParametro.BOOLEAN, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "El contrato firmado es obligatorio para padres" },
        { clave: "pagos.comprobante_tamaño_max_mb", valor: "10", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Tamaño máximo del comprobante de pago en MB" },
        { clave: "pagos.comprobante_formatos_permitidos", valor: "image/png,image/jpeg,application/pdf", tipo: TipoParametro.STRING, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Formatos MIME permitidos para comprobantes" },
    ];

    for (const p of pagosParams) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: { valor: p.valor, descripcion: p.descripcion },
            create: p,
        });
    }
    console.log(`[SEED] ${pagosParams.length} parámetros pagos.* listos`);
}

async function main() {
    // Admin inicial: SOLO desde variable de entorno, SOLO si no existe (spec 105, I-31).
    // Nunca un literal en el repo; el seed nunca pisa una credencial ya rotada.
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "soporte@innovadataco.com";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "";
    const minLengthParam = await prisma.parametroSistema.findUnique({
        where: { clave: "security.password_min_length" },
    });
    const minLength = Number.isFinite(parseInt(minLengthParam?.valor ?? ""))
        ? parseInt(minLengthParam!.valor)
        : 12;

    if (adminPassword.trim().length < minLength) {
        console.log(`[SEED] Admin omitido: SEED_ADMIN_PASSWORD no definida o débil (mínimo ${minLength} caracteres).`);
    } else {
        const existente = await prisma.usuario.findUnique({ where: { email: adminEmail } });
        if (existente) {
            console.log("[SEED] Admin existente, sin cambios (el seed nunca pisa credenciales).");
        } else {
            await prisma.usuario.create({
                data: {
                    email: adminEmail,
                    nombre: "Administrador",
                    passwordHash: await bcrypt.hash(adminPassword, 12),
                    rol: RolUsuario.ADMIN,
                    estado: "activo",
                    debeCambiarPassword: true,
                },
            });
            console.log("[SEED] Admin inicial creado (debeCambiarPassword=true).");
        }
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
            clave: "visibility.actividad_alta_min",
            valor: "5",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.VISIBILITY,
            esPublico: true,
            descripcion: "Reportes mínimos para mostrar la señal 'Actividad alta de reportes' en consulta y seguimiento",
        },
        {
            clave: "ia.simulacion_timeout_minutos",
            valor: "60",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Minutos máximos que una simulación puede estar EN_PROGRESO antes de marcarse FALLIDA",
        },
        {
            clave: "ia.ollama.timeout_ms",
            valor: "120000",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Timeout en ms para las llamadas de generación a Ollama (/api/generate); default 120000 si el parámetro falta o es inválido",
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
        // SPEC-110: parámetros de la apelación del identificador (ADR_004, con test de efecto)
        {
            clave: "apelacion.plazo_respuesta_dias_habiles",
            valor: "15",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.LEGAL,
            esPublico: true,
            descripcion: "Plazo de respuesta de una apelación en días hábiles (Ley 1581)",
        },
        {
            clave: "apelacion.aviso_previo_dias",
            valor: "10",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.LEGAL,
            esPublico: false,
            descripcion: "Días hábiles sin resolver para avisar al comité de validación",
        },
        {
            clave: "apelacion.retencion_documento_dias",
            valor: "30",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.LEGAL,
            esPublico: false,
            descripcion: "Días tras la resolución para eliminar el documento de evidencia",
        },
        {
            clave: "apelacion.max_tamano_documento_mb",
            valor: "5",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.LEGAL,
            esPublico: true,
            descripcion: "Tamaño máximo del PDF de evidencia de una apelación (MB)",
        },
        // SPEC-186 (002-PI-081): parámetros del vigilante de infraestructura se siembran
        // por separado (ver bloque monitoreoParams debajo): los 13 viejos de SPEC-171
        // usan ON CONFLICT DO NOTHING (crean los faltantes sin pisar valores del CEO),
        // y los 2 nuevos de SPEC-186 usan ON CONFLICT DO UPDATE (aplican el nuevo default).
        // SPEC-172 (Pilar D.5): parámetros de la deriva del motor en producción.
        { clave: "motor.deriva.enabled", valor: "true", tipo: TipoParametro.BOOLEAN, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Medir la deriva del motor en producción (tasa de corrección semanal vs banco curado)" },
        { clave: "motor.deriva.umbral_pp", valor: "15", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Avisar si la brecha de una categoría supera estos puntos porcentuales" },
        { clave: "motor.deriva.min_muestra", valor: "20", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Mínimo de casos semanales para medir una categoría (debajo no alerta)" },
        { clave: "motor.deriva.ventana_dias", valor: "7", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Días de la ventana de medición (la semana operativa)" },
        { clave: "motor.deriva.email.destinatarios", valor: "", tipo: TipoParametro.STRING, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "A quién avisar si hay deriva (correos separados por coma; vacío = no enviar)" },
        { clave: "motor.deriva.email.siempre", valor: "false", tipo: TipoParametro.BOOLEAN, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Enviar el resumen semanal aunque ninguna categoría supere el umbral" },
    ];

    for (const p of defaults) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: {},
            create: p,
        });
    }

    // SPEC-186 (002-PI-081): seed MIXTO del vigilante (I-65).
    // Los 13 parámetros viejos de SPEC-171 se crean si faltan, pero NO pisan valores custom (DO NOTHING).
    // Los 2 parámetros nuevos/cambiados de SPEC-186 se aplican siempre (DO UPDATE).
    const monitoreoViejos = [
        { clave: "monitoreo.enabled", valor: "true", tipo: TipoParametro.BOOLEAN, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Activar el vigilante del sistema (probes e incidentes)" },
        { clave: "monitoreo.app.intervalo_seg", valor: "60", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Cada cuánto revisamos que la app responde (segundos)" },
        { clave: "monitoreo.worker.heartbeat_max_seg", valor: "90", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Tiempo máximo sin señal del worker antes de marcarlo en rojo (segundos)" },
        { clave: "monitoreo.ollama.ping.intervalo_seg", valor: "60", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Cada cuánto tocamos la puerta del cerebro IA /api/tags (segundos)" },
        { clave: "monitoreo.ollama.smoke.timeout_ms", valor: "60000", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Espera máxima de la generación mínima del cerebro IA (milisegundos)" },
        { clave: "monitoreo.tailscale.url", valor: "", tipo: TipoParametro.STRING, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "URL del cerebro por el túnel Tailscale (vacío = no aplica, ej. desarrollo local)" },
        { clave: "monitoreo.tailscale.intervalo_seg", valor: "60", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Cada cuánto revisamos el túnel Tailscale (segundos)" },
        { clave: "monitoreo.reprobe.segundos", valor: "60", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Espera antes de confirmar un rojo con un segundo intento (segundos)" },
        { clave: "monitoreo.email.throttle_min", valor: "30", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Mínimo entre correos del mismo aviso de infraestructura (minutos)" },
        { clave: "monitoreo.email.destinatarios", valor: "", tipo: TipoParametro.STRING, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "A quién avisar cuando algo se pone en rojo (correos separados por coma; vacío = no enviar)" },
        { clave: "monitoreo.autorefresh_seg", valor: "30", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Autorefresco del tablero operativo (segundos)" },
        { clave: "monitoreo.atascados.horas", valor: "24", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Horas sin moverse para considerar un reporte atascado" },
        // SPEC-187 (002-PI-082): override opcional de modelo para el smoke real de Ollama.
        // Se siembra con update: {} para respetar cualquier override ya configurado por el CEO.
        { clave: "monitoreo.ollama.smoke.modelo", valor: "", tipo: TipoParametro.STRING, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Modelo de Ollama a usar en el smoke real (override). Si está vacío, usa ia.rubrica.modelos[0]" },
    ];
    for (const p of monitoreoViejos) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: {},
            create: p,
        });
    }
    const monitoreoNuevos = [
        // SPEC-186: intervalo del smoke real pasa de 5 a 30 min (decisión de diseño; se aplica siempre).
        { clave: "monitoreo.ollama.smoke.intervalo_min", valor: "30", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Cada cuánto pedimos una generación mínima real al cerebro IA, si no hay tráfico reciente (minutos)" },
        // SPEC-186: ventana de piggyback en tráfico real de ClasificacionIA.
        { clave: "monitoreo.ollama.smoke.piggyback_min", valor: "15", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Si hubo una clasificación real en estos minutos, el smoke se considera sano sin tocar Ollama (minutos)" },
    ];
    // EXCEPCIÓN DOCUMENTADA (SPEC-190): estos parámetros nacieron o cambiaron de
    // default por decisión de diseño de SPEC-186. Se aplica ON CONFLICT DO UPDATE
    // para que el nuevo default llegue a producción. No son valores operativos
    // ajustados por el CEO en runtime.
    for (const p of monitoreoNuevos) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: { valor: p.valor, descripcion: p.descripcion },
            create: p,
        });
    }

    // SPEC-199 + SPEC-207: parámetros de la guarda de dominancia SPAM y hard-rule.
    // EXCEPCIÓN DOCUMENTADA (SPEC-207): spam.dominancia_umbral se fuerza a 0.33
    // por decisión de diseño de esta SPEC; spam.dominios_acortadores se fuerza con
    // la lista inicial porque es parte de la red de seguridad determinística.
    const spamDominanciaParams = [
        { clave: "spam.dominancia_umbral", valor: "0.33", tipo: TipoParametro.FLOAT, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Score mínimo de SPAM entre categorías secundarias para disparar guarda de dominancia (SPEC-207: un voto entre tres modelos basta si no hay categoría grave)" },
        { clave: "spam.dominancia_categoria_grave_severidad_min", valor: "75", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Severidad mínima que bloquea la dominancia SPAM" },
        { clave: "spam.dominios_acortadores", valor: JSON.stringify(["bit.ly", "tinyurl", "is.gd", "t.co", "cutt.ly", "ow.ly", "buff.ly"]), tipo: TipoParametro.JSON, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Dominios de acortadores que la hard-rule de spam publicitario considera sospechosos (editable en caliente sin deploy)" },
    ];
    for (const p of spamDominanciaParams) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: { valor: p.valor, descripcion: p.descripcion },
            create: p,
        });
    }

    // SPEC-193 (Fase 1): parámetros de la bitácora de logs de workers.
    const monitoreoLogsParams = [
        { clave: "monitoreo.logs.enabled", valor: "true", tipo: TipoParametro.BOOLEAN, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Activar la persistencia de logs de worker en base de datos" },
        { clave: "monitoreo.logs.nivel_minimo", valor: "WARN", tipo: TipoParametro.STRING, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Nivel mínimo de log que se persiste en base de datos (DEBUG|INFO|WARN|ERROR)" },
        { clave: "monitoreo.logs.max_muestras_ui", valor: "500", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Máximo de logs que la UI de monitoreo puede consultar en una sola petición" },
    ];
    for (const p of monitoreoLogsParams) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: { valor: p.valor, descripcion: p.descripcion },
            create: p,
        });
    }

    // SPEC-194 (002-PI-088): parámetros de analítica de colegios.
    // Se siembran con update: {} para no pisar ajustes custom del CEO (patrón SPEC-187).
    const analyticsColegiosParams = [
        { clave: "analytics.colegios.cache_ttl_min", valor: "5", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "TTL en minutos de la caché en memoria de los endpoints de analítica de colegios" },
        { clave: "analytics.colegios.inactividad_alerta_dias", valor: "45", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Si un colegio no tiene reportes en estos días, se muestra como hallazgo negativo" },
        { clave: "analytics.colegios.spam_alerta_pct", valor: "0.5", tipo: TipoParametro.FLOAT, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Porcentaje de reportes SPAM que dispara hallazgo negativo (0.5 = 50%)" },
        { clave: "analytics.colegios.resolucion_comite_ok_pct", valor: "0.8", tipo: TipoParametro.FLOAT, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Tasa mínima de resolución del comité para generar hallazgo positivo (0.8 = 80%)" },
        { clave: "analytics.colegios.periodo_default_dias", valor: "30", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Ventana temporal por defecto de las series de reportes en la ficha de colegio" },
    ];
    for (const p of analyticsColegiosParams) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: {},
            create: p,
        });
    }

    // SPEC-206 (002-PI-120): parámetros de sesión activa.
    // Se siembran con update: {} para no pisar ajustes custom del CEO (patrón SPEC-187).
    const sesionParams = [
        { clave: "sesion.timeout_inactividad_minutos", valor: "30", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Minutos sin actividad antes de cerrar una sesión automáticamente" },
        { clave: "sesion.ping_intervalo_minutos", valor: "5", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Intervalo entre pings de actividad desde el cliente (minutos)" },
        { clave: "sesion.retencion_dias", valor: "90", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Días que se conservan las filas de SesionLog antes de purgar" },
        { clave: "sesion.worker_intervalo_minutos", valor: "5", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Cada cuántos minutos el worker de sesiones revisa inactividad" },
    ];
    for (const p of sesionParams) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: {},
            create: p,
        });
    }

    console.log("Parámetros por defecto creados");

    // SPEC-210 (002-PI-110): seed del módulo de pagos.
    const adminPagos = await prisma.usuario.findFirst({ where: { rol: RolUsuario.ADMIN } });
    if (adminPagos) {
        await seedPlanesPagos(adminPagos.id);
    } else {
        console.log("[SEED] No hay admin en BD; se omite seed de planes de pagos.");
    }
    await seedParametrosPagos();

    // Nuevos parámetros del módulo de reportes (fase 2)
    const reportesParams = [
        {
            clave: "reportes.classification_model",
            valor: "gemma2:27b",
            tipo: TipoParametro.STRING,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Modelo Ollama para clasificación de conductas (default ADR_006: gemma2:27b, 0 errores silenciosos)",
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
            clave: "ratelimit.ciudades_buscar.window_seconds",
            valor: "60",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Ventana de rate limiting para búsqueda de ciudades (segundos)",
        },
        {
            clave: "ratelimit.ciudades_buscar.max_requests",
            valor: "60",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Máximo de búsquedas de ciudades por ventana",
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
        // SPEC-184 (002-PI-079): alertas throttled ante picos de bloqueos de rate-limit.
        {
            clave: "alerts.ratelimit.enabled",
            valor: "true",
            tipo: TipoParametro.BOOLEAN,
            categoria: CategoriaParametro.EMAIL,
            esPublico: false,
            descripcion: "Enviar alertas por pico de bloqueos de rate-limit",
        },
        {
            clave: "alerts.ratelimit.umbral_bloqueos_hora",
            valor: "20",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.EMAIL,
            esPublico: false,
            descripcion: "Bloqueos por IP/hora que disparan alerta",
        },
        {
            clave: "alerts.ratelimit.throttle_min",
            valor: "60",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.EMAIL,
            esPublico: false,
            descripcion: "Mínimo entre emails del mismo pico de bloqueos (minutos)",
        },
        {
            clave: "alerts.ratelimit.destinatarios",
            valor: "",
            tipo: TipoParametro.STRING,
            categoria: CategoriaParametro.EMAIL,
            esPublico: false,
            descripcion: "A quién avisar por pico de bloqueos (correos separados por coma; vacío = no enviar)",
        },
        // SPEC-185: id de usuario PARENT de prueba para el escenario denunciante_spam.
        {
            clave: "simulacion.spam.usuario_id",
            valor: "",
            tipo: TipoParametro.STRING,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Id de un usuario PARENT de prueba para el simulador de abusos (escenario denunciante_spam). Debe configurarse antes de usar ese escenario.",
        },
        {
            // SPEC-149 (FR-008): interruptor global del canal de avisos del colegio.
            clave: "colegio.notificaciones.enabled",
            valor: "true",
            tipo: TipoParametro.BOOLEAN,
            categoria: CategoriaParametro.EMAIL,
            esPublico: false,
            descripcion: "Enviar avisos por email a los colegios",
        },
        {
            // SPEC-149 (FR-008): legado del email inline viejo (superado por el
            // pipeline de avisos); se seedea porque los tests lo referencian.
            clave: "colegio.notificaciones.cooldown_horas",
            valor: "24",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.EMAIL,
            esPublico: false,
            descripcion: "Horas de cooldown entre avisos al colegio (legado)",
        },
        {
            // SPEC-149 (FR-004/FR-008): tope diario de emails de aviso por colegio;
            // al superarlo los eventos quedan para el resumen del lunes.
            clave: "colegio.avisos.tope_diario",
            valor: "5",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.EMAIL,
            esPublico: false,
            descripcion: "Máximo de emails de aviso por colegio y día (el resto va al resumen del lunes)",
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

    // Severidades por categoría (spec 085: fuente de verdad en parámetros, no en código)
    const severidadesSeed: Array<[string, number]> = [
        ["CONTACTO_INSISTENTE", 30],
        ["SOLICITUD_MATERIAL", 80],
        ["OFRECIMIENTO_REGALOS", 60],
        ["SUPLANTACION_IDENTIDAD", 70],
        ["SOLICITUD_ENCUENTRO", 90],
        ["COMPARTIMIENTO_SEXUAL", 95],
        ["EXTORSION", 85],
        ["CONTENIDO_GENERADO_IA", 75],
        ["DIFUSION_NO_CONSENTIDA", 90],
        ["DOXING", 85],
        ["SPAM", 0],
        ["OTRO", 20],
    ];
    for (const [cat, valor] of severidadesSeed) {
        await prisma.parametroSistema.upsert({
            where: { clave: `scoring.severity.${cat}` },
            update: {},
            create: {
                clave: `scoring.severity.${cat}`,
                valor: String(valor),
                tipo: TipoParametro.INTEGER,
                categoria: CategoriaParametro.VISIBILITY,
                esPublico: false,
                descripcion: `Severidad de la categoría ${cat} (0-100)`,
            },
        });
    }
    console.log("Severidades scoring.severity.* listas");

    // ── Rúbrica de clasificación (spec 090 / SPEC-199) ─────────────────────
    const rubricaParams = [
        { clave: "ia.rubrica.preguntas", valor: JSON.stringify(RUBRICA_SEMILLA), tipo: TipoParametro.JSON, descripcion: "Sets de preguntas factuales por categoría (estructural del motor; ver nota de seed)" },
        { clave: "ia.rubrica.modelos", valor: JSON.stringify(["gemma2:27b", "qwen2.5:14b", "aya-expanse:32b"]), tipo: TipoParametro.JSON, descripcion: "Modelos diversos que votan en la rúbrica (secuencial, 1 voto c/u)" },
        { clave: "ia.rubrica.temperatura", valor: "0.2", tipo: TipoParametro.FLOAT, descripcion: "Temperatura de los votos de la rúbrica (baja = determinista)" },
        { clave: "ia.rubrica.umbral_presencia", valor: "0.6", tipo: TipoParametro.FLOAT, descripcion: "% mínimo de modelos que deben marcar 1 para que una categoría cuente (0.6 ≈ 2/3)" },
        { clave: "ia.rubrica.modelo_embudo", valor: "qwen2.5:14b", tipo: TipoParametro.STRING, descripcion: "Modelo del pase barato que descarta categorías sin señal" },
    ];
    for (const rp of rubricaParams) {
        await prisma.parametroSistema.upsert({
            where: { clave: rp.clave },
            update:
                // SPEC-199 EXCEPCIÓN DOCUMENTADA: ia.rubrica.preguntas es ESTRUCTURAL
                // del motor. Cuando cambia la estructura (nueva categoría o pregunta
                // decisiva), se fuerza el update para propagar a producción. Esto
                // DEPRECA la refinación runtime de este parámetro por expertos vía UI:
                // cada deploy pisa el valor con el código fuente de RUBRICA_SEMILLA.
                rp.clave === "ia.rubrica.preguntas"
                    ? { valor: rp.valor, descripcion: rp.descripcion }
                    : {},
            create: {
                clave: rp.clave,
                valor: rp.valor,
                tipo: rp.tipo,
                categoria: CategoriaParametro.SYSTEM,
                esPublico: false,
                descripcion: rp.descripcion,
            },
        });
    }
    console.log("Rúbrica de clasificación (spec 090 / SPEC-199) lista");

    // ── Expediente del reporte (spec 096) ──────────────────────────────────
    const ETAPAS_EXPEDIENTE = [
        { orden: 1, fase: "A", faseNombre: "Ingesta", clave: "recepcion", nombre: "Recepción", icono: "inbox", capa: 1, gated: false,
            campos: ["creadoEn", "numeroSeguimiento", "plataforma", "pais", "ciudad", "esAnonimo", "edadVictima", "estado"] },
        { orden: 2, fase: "A", faseNombre: "Ingesta", clave: "peso_fuente", nombre: "Peso de fuente", icono: "scale", capa: 1, gated: false,
            campos: ["pesoAplicado", "cuentaDiasAntiguedad", "reportesPrevios", "reportesConfirmados", "reportesDescartados"],
            camposGated: ["ipHash", "fingerprintHash"] },
        { orden: 3, fase: "B", faseNombre: "Preparación", clave: "embedding", nombre: "Embedding", icono: "vector", capa: 1, gated: false,
            campos: ["modeloUsado", "creadoEn", "latenciaMs"] },
        { orden: 4, fase: "B", faseNombre: "Preparación", clave: "deduplicacion", nombre: "Deduplicación", icono: "copy", capa: 2, gated: false,
            campos: ["reporteOrigenId", "scoreSimilitud"] },
        { orden: 5, fase: "B", faseNombre: "Preparación", clave: "guardas", nombre: "Guardas baratas", icono: "shield", capa: 2, gated: false,
            campos: ["esRafaga", "keywordsDetectadas", "prioridadAlta"] },
        { orden: 6, fase: "C", faseNombre: "Evaluación", clave: "contexto_rag", nombre: "Contexto RAG", icono: "book", capa: 2, gated: false,
            campos: ["casosSimilares", "categoriasVecinas"] },
        { orden: 7, fase: "C", faseNombre: "Evaluación", clave: "clasificacion", nombre: "Clasificación por rúbrica", icono: "brain", capa: 1, gated: false,
            campos: ["categorias", "confianza", "usoCascada", "modeloCascada", "latenciaMs", "promptTokens", "responseTokens"],
            camposGated: ["rawResponse"] },
        { orden: 8, fase: "D", faseNombre: "Cierre", clave: "anonimizacion", nombre: "Anonimización PII", icono: "mask", capa: 1, gated: false,
            campos: ["contienePii", "piiDetectada", "anonimizacionValidadaPorId", "anonimizacionValidadaEn"],
            camposGated: ["textoOriginal"] },
        { orden: 9, fase: "D", faseNombre: "Cierre", clave: "decision", nombre: "Decisión", icono: "gavel", capa: 2, gated: false,
            campos: ["transiciones"] },
        { orden: 10, fase: "D", faseNombre: "Cierre", clave: "finalizacion", nombre: "Finalización", icono: "flag", capa: 1, gated: false,
            campos: ["estado", "reintentos", "processingError"] },
    ];
    const CANALES_PADRE = [
        { nombre: "Línea 141 ICBF", contacto: "141",
            descripcion: "Línea gratuita del ICBF para reportar riesgos contra niños, niñas y adolescentes" },
        { nombre: "Te Protejo", contacto: "https://teprotejo.org",
            descripcion: "Canal para reportar material de abuso sexual infantil en internet" },
        { nombre: "CAI Virtual — Policía Nacional", contacto: "123",
            descripcion: "Emergencias y denuncias de la Policía Nacional" },
    ];
    const expedienteParams = [
        { clave: "admin.expediente.etapas", valor: JSON.stringify(ETAPAS_EXPEDIENTE), descripcion: "Etapas del expediente del reporte (traza del pipeline, vista admin; ADR_004: nada quemado en código)" },
        { clave: "mensaje.padre.canales", valor: JSON.stringify(CANALES_PADRE), descripcion: "Canales oficiales que se muestran en el mensaje al padre (revisable por legal, editable sin desplegar)" },
    ];
    for (const ep of expedienteParams) {
        await prisma.parametroSistema.upsert({
            where: { clave: ep.clave },
            update: {},
            create: {
                clave: ep.clave,
                valor: ep.valor,
                tipo: TipoParametro.JSON,
                categoria: CategoriaParametro.SYSTEM,
                esPublico: false,
                descripcion: ep.descripcion,
            },
        });
    }
    console.log("Parámetros del expediente del reporte (spec 096) listos");

    // F3 (N-5): contenido curado del estado vacío de la consulta pública.
    // 100% estático (NADA de IA), revisable por legal, editable sin desplegar.
    // Presunción de inocencia: lenguaje descriptivo, nunca "es seguro/peligroso".
    const SENALES_ALERTA_VACIA = [
        "Pide mantener la conversación en secreto",
        "Solicita fotos o videos íntimos",
        "Ofrece regalos, dinero o recargas a cambio de algo",
        "Propone encontrarse a solas",
        "Dice ser menor de edad pero no lo parece",
    ];
    const ACCIONES_VACIA = [
        "Habla con el menor sin juzgar: escucha y cree en lo que cuenta",
        "Guarda la evidencia: capturas de pantalla, nombres de usuario, fechas y horas",
        "Contacta los canales oficiales: Línea 141 del ICBF, CAI Virtual de la Policía o Te Protejo",
    ];
    const consultaVaciaParams = [
        { clave: "consulta.vacia.disclaimer", valor: JSON.stringify("Que este identificador no tenga reportes registrados no significa que sea seguro. Esta plataforma solo muestra lo que la comunidad ha reportado; la ausencia de reportes no es una garantía."), descripcion: "Aviso del estado vacío de la consulta pública (F3): ausencia de reportes ≠ seguridad" },
        { clave: "consulta.vacia.senales", valor: JSON.stringify(SENALES_ALERTA_VACIA), descripcion: "Señales de alerta curadas del estado vacío de la consulta pública (F3)" },
        { clave: "consulta.vacia.acciones", valor: JSON.stringify(ACCIONES_VACIA), descripcion: "Acciones recomendadas curadas del estado vacío de la consulta pública (F3)" },
    ];
    for (const cv of consultaVaciaParams) {
        await prisma.parametroSistema.upsert({
            where: { clave: cv.clave },
            update: {},
            create: {
                clave: cv.clave,
                valor: cv.valor,
                tipo: TipoParametro.JSON,
                categoria: CategoriaParametro.SYSTEM,
                esPublico: false,
                descripcion: cv.descripcion,
            },
        });
    }
    console.log("Parámetros del estado vacío de la consulta pública (F3) listos");

    for (const p of reportesParams) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: {},
            create: p,
        });
    }
    console.log("Parámetros del módulo de reportes creados");

    // SPEC-182 (I-60): reconciliación periódica de reportes huérfanos sin operador.
    const operadoresParams = [
        {
            clave: "operadores.reconciliacion_intervalo_min",
            valor: "15",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Intervalo en minutos entre ciclos de reconciliación de reportes huérfanos (REVISION_MANUAL sin operador)",
        },
        {
            clave: "operadores.reconciliacion_enabled",
            valor: "true",
            tipo: TipoParametro.BOOLEAN,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Activa/desactiva el job de reconciliación de reportes huérfanos",
        },
    ];
    for (const p of operadoresParams) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: {},
            create: p,
        });
    }
    console.log("Parámetros de reconciliación de operadores creados");

    // SPEC-142 (F6): umbral de k-anonimato de la vista de patrones del colegio
    // (ZEUS D-2: k=3 en TODOS los desgloses — grado, conducta y plataforma).
    await prisma.parametroSistema.upsert({
        where: { clave: "colegio.patrones.k_anonimato" },
        update: {},
        create: {
            clave: "colegio.patrones.k_anonimato",
            valor: "3",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "k-anonimato de la vista de patrones institucionales (celdas con conteo < k se suprimen en lectura)",
        },
    });
    console.log("Parámetro de k-anonimato de patrones (F6) listo");

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

            // EXCEPCIÓN DOCUMENTADA (SPEC-190): las ciudades son un catálogo
            // canónico. El update rellena coordenadas, departamento y nombre
            // normalizado cuando una ciudad fue creada previamente sin esos datos
            // (p. ej. pre-SPEC-115). No es un "valor custom del CEO".
            for (const d of departamentosColombia) {
                const departamentoId = departamentoMap.get(d.nombre);
                for (const c of d.ciudades) {
                    const coords = COORDENADAS_CIUDADES[`${p.codigo}:${c}`];
                    await prisma.ciudad.upsert({
                        where: { nombre_paisId: { nombre: c, paisId: pais.id } },
                        update: {
                            // undefined explícito ≡ omitir en Prisma (exactOptionalPropertyTypes)
                            ...(coords?.lat !== undefined ? { lat: coords.lat } : {}),
                            ...(coords?.lng !== undefined ? { lng: coords.lng } : {}),
                            ...(departamentoId !== undefined ? { departamentoId } : {}),
                            nombreNormalizado: normalizarNombreGeografico(c),
                        },
                        create: {
                            nombre: c,
                            paisId: pais.id,
                            ...(coords?.lat !== undefined ? { lat: coords.lat } : {}),
                            ...(coords?.lng !== undefined ? { lng: coords.lng } : {}),
                            ...(departamentoId !== undefined ? { departamentoId } : {}),
                            nombreNormalizado: normalizarNombreGeografico(c),
                        },
                    });
                }
            }

            console.log(`Colombia: ${departamentosColombia.length} departamentos y ciudades principales creados`);
            continue;
        }

        // EXCEPCIÓN DOCUMENTADA (SPEC-190): catálogo canónico; el update
        // rellena coordenadas y nombre normalizado cuando una ciudad existía
        // sin ellos. No es un valor custom del CEO.
        for (const c of p.ciudades) {
            const coords = COORDENADAS_CIUDADES[`${p.codigo}:${c}`];
            await prisma.ciudad.upsert({
                where: { nombre_paisId: { nombre: c, paisId: pais.id } },
                update: { lat: coords?.lat, lng: coords?.lng, nombreNormalizado: normalizarNombreGeografico(c) },
                create: { nombre: c, paisId: pais.id, lat: coords?.lat, lng: coords?.lng, nombreNormalizado: normalizarNombreGeografico(c) },
            });
        }
    }
    console.log("Países y ciudades creados");

    // Tablas SaaS vacías en desarrollo (no se cargan datos de prueba)
    console.log("Tablas Tenant, Plan, Subscription, BillingCycle listas");

    // ── Permisos de módulos por rol (spec 019) ─────────────────────────────
    // Fuente única: prisma/seed-modulos-grants.ts (también la usa
    // scripts/sync-modulos-grants.ts para sincronizar BD existentes, 002-PI-048).
    const { modulosCatalogo, permisosCreados } = await syncModulosYGrants(prisma);

    console.log(`Permisos de módulos: ${modulosCatalogo} módulos en catálogo, ${permisosCreados} permisos backfill`);

    // ── Parámetros del módulo Padre (SPEC-230) ─────────────────────────────
    await seedParametrosPadre();

    // Cerramos el cliente interno para no dejar conexiones/locks colgando entre
    // llamadas en tests (evita deadlocks con TRUNCATE de resetDatabase).
    await prisma.$disconnect();
    prismaInstance = null;
}

export { main, seedParametrosPadre };

// Solo ejecutar el seed automáticamente cuando este archivo es el punto de
// entrada (p. ej. `tsx prisma/seed.ts` o `prisma db seed`). Al importarse como
// módulo desde tests, main() se invoca explícitamente bajo el mutex de BD;
// un main() top-level desprotegido corría en paralelo con resetDatabase() y
// causaba deadlocks 40P01 contra TRUNCATE CASCADE.
if (isMainModule()) {
    main()
        .catch((e) => {
            console.error(e);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}