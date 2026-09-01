import { RUBRICA_SEMILLA, DEFINICIONES_CATEGORIA } from "../src/lib/ai/rubrica-semilla";
import { normalizarNombreGeografico } from "../src/lib/normalizar";
import { REGLAS_SEMILLA } from "../src/lib/analisis/reglas/seed-reglas";
import { syncModulosYGrants } from "./seed-modulos-grants";
import { PrismaClient, RolUsuario, TipoParametro, CategoriaParametro, TipoTitular, DuracionPlan, EstadoGuiaAccion, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { formatInTimeZone } from "date-fns-tz";
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

// SPEC-247 (002-PI-150): upsert idempotente de NotificacionRegla por clave canónica
// (evento, canal, plantillaClave). Reemplaza el patrón findFirst→update/create y
// garantiza cero duplicados tras múltiples ejecuciones del seed.
async function upsertNotificacionRegla(
    data: {
        evento: string;
        rol: string;
        canal: "EMAIL" | "IN_APP";
        plantillaClave: string;
        offset?: string;
        obligatoria?: boolean;
        activa?: boolean;
    },
    options: { preservarExistente?: boolean } = {}
) {
    const updateData: Record<string, unknown> = {};
    if (!options.preservarExistente) {
        updateData.rol = data.rol;
        updateData.offset = data.offset ?? "+0m";
        updateData.obligatoria = data.obligatoria ?? false;
        updateData.activa = data.activa ?? true;
    }
    await prisma.notificacionRegla.upsert({
        where: {
            // SPEC-333 (I-223): la identidad incluye `rol` — cada rol conserva su regla.
            evento_canal_plantillaClave_rol: {
                evento: data.evento,
                canal: data.canal,
                plantillaClave: data.plantillaClave,
                rol: data.rol,
            },
        },
        update: updateData,
        create: {
            evento: data.evento,
            rol: data.rol,
            canal: data.canal,
            plantillaClave: data.plantillaClave,
            offset: data.offset ?? "+0m",
            obligatoria: data.obligatoria ?? false,
            activa: data.activa ?? true,
        },
    });
}

// SPEC-230 (002-PI-130): parámetros del módulo Padre.
// Idempotencia anti-I-100: upsert por clave, propaga cambios de default definidos en código.
async function seedParametrosPadre() {
    const parametrosPadre = [
        { clave: "padre.expediente.auto_cierre_meses", valor: "0", tipo: TipoParametro.INTEGER, descripcion: "DEROGADO (SPEC-340): 0 = los expedientes no se cierran nunca. Regla de Jelkin 01-09-2026." },
        { clave: "padre.expediente.consolidacion_min_reportes", valor: "2", tipo: TipoParametro.INTEGER, descripcion: "Mínimo de reportes para pasar a CONSOLIDANDO" },
        { clave: "padre.expediente.max_aclaraciones", valor: "1", tipo: TipoParametro.INTEGER, descripcion: "Máximo de aclaraciones por expediente" },
        // SPEC-339 (A-67 · brief §2.4): el tope de menores es PARÁMETRO, no una
        // constante en el código — el admin lo cambia sin desplegar. El mensaje
        // que ve el padre también se siembra: {{maximo}} se reemplaza al mostrarlo.
        { clave: "padre.hijos.maximo", valor: "5", tipo: TipoParametro.INTEGER, descripcion: "Máximo de menores que un padre puede registrar" },
        // SPEC-340 (A-68 §3.3-bis): el step-up del texto sensible. Dos relojes:
        // re-tapado (ergonomía, cliente) y umbral de contraseña (SERVIDOR).
        { clave: "padre.texto.retapado_minutos", valor: "10", tipo: TipoParametro.INTEGER, descripcion: "Minutos hasta que el texto revelado se vuelve a tapar solo" },
        { clave: "padre.texto.stepup_minutos", valor: "30", tipo: TipoParametro.INTEGER, descripcion: "Edad de sesión (min) a partir de la cual revelar el texto exige la contraseña" },
        // SPEC-340 (A-68 §3.3): la clasificación EXPLICADA en lenguaje de padre.
        // El admin las edita; el fallback si falta una clave es un texto genérico.
        { clave: "padre.analisis.explicacion.CONTACTO_INSISTENTE", valor: "Encontramos señales de contacto insistente: alguien que escribe una y otra vez aunque no le respondan. Documentarlo ayuda a mostrar el patrón.", tipo: TipoParametro.STRING, descripcion: "Explicación de la categoría para el padre" },
        { clave: "padre.analisis.explicacion.SOLICITUD_MATERIAL", valor: "Encontramos señales de contacto sexual: alguien pidiendo fotos o material íntimo. Es grave y vale la pena documentarlo.", tipo: TipoParametro.STRING, descripcion: "Explicación de la categoría para el padre" },
        { clave: "padre.analisis.explicacion.OFRECIMIENTO_REGALOS", valor: "Encontramos señales de ofrecimientos: regalos, dinero o recargas a cambio de algo. Suele ser la puerta de entrada de un abuso.", tipo: TipoParametro.STRING, descripcion: "Explicación de la categoría para el padre" },
        { clave: "padre.analisis.explicacion.SUPLANTACION_IDENTIDAD", valor: "Encontramos señales de que la persona finge ser alguien que no es: otro menor, un familiar o una figura de confianza.", tipo: TipoParametro.STRING, descripcion: "Explicación de la categoría para el padre" },
        { clave: "padre.analisis.explicacion.SOLICITUD_ENCUENTRO", valor: "Encontramos señales de que alguien busca un encuentro en persona. Es de las señales más serias y conviene documentarla con fechas.", tipo: TipoParametro.STRING, descripcion: "Explicación de la categoría para el padre" },
        { clave: "padre.analisis.explicacion.COMPARTIMIENTO_SEXUAL", valor: "Encontramos señales de envío de contenido sexual hacia el menor. Documentarlo con fecha y hora fortalece tu carpeta.", tipo: TipoParametro.STRING, descripcion: "Explicación de la categoría para el padre" },
        { clave: "padre.analisis.explicacion.EXTORSION", valor: "Encontramos señales de presión o chantaje: pedir algo a cambio de no publicar o no contar. Guarda todo; cada mensaje cuenta.", tipo: TipoParametro.STRING, descripcion: "Explicación de la categoría para el padre" },
        { clave: "padre.analisis.explicacion.CONTENIDO_GENERADO_IA", valor: "Encontramos señales de contenido fabricado con inteligencia artificial usando la imagen del menor. Es reciente en la ley y sí se puede denunciar.", tipo: TipoParametro.STRING, descripcion: "Explicación de la categoría para el padre" },
        { clave: "padre.analisis.explicacion.DIFUSION_NO_CONSENTIDA", valor: "Encontramos señales de difusión de contenido íntimo sin permiso. No compartas el enlace; documenta y busca la baja del contenido.", tipo: TipoParametro.STRING, descripcion: "Explicación de la categoría para el padre" },
        { clave: "padre.analisis.explicacion.DOXING", valor: "Encontramos señales de publicación de datos personales del menor (dirección, colegio, teléfono). Conviene reforzar la privacidad de sus cuentas.", tipo: TipoParametro.STRING, descripcion: "Explicación de la categoría para el padre" },
        { clave: "padre.analisis.explicacion.CIBERACOSO", valor: "Encontramos señales de acoso repetido por medios digitales: burlas, amenazas o exclusión sostenida. El patrón importa más que el mensaje suelto.", tipo: TipoParametro.STRING, descripcion: "Explicación de la categoría para el padre" },
        { clave: "padre.analisis.explicacion.HAPPY_SLAPPING", valor: "Encontramos señales de agresión grabada o difundida para burlarse. La ley lo nombra y lo sanciona; documentarlo sirve.", tipo: TipoParametro.STRING, descripcion: "Explicación de la categoría para el padre" },
        { clave: "padre.analisis.explicacion.STALKING", valor: "Encontramos señales de vigilancia u hostigamiento persistente. Anota cada vez que pase, con fecha y hora: la insistencia es la clave.", tipo: TipoParametro.STRING, descripcion: "Explicación de la categoría para el padre" },
        { clave: "padre.hijos.maximo_mensaje", valor: "Puedes cuidar hasta {{maximo}} menores desde esta cuenta. Si necesitas más, escríbenos y lo resolvemos.", tipo: TipoParametro.STRING, descripcion: "Mensaje que ve el padre al alcanzar el tope de menores" },
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

// SPEC-234 (002-PI-134): parámetro de frecuencia de refresco de la caché de
// señal comunitaria. Idempotente anti-I-100: un cambio de default en código se
// propaga a la base de datos.
async function seedParametrosSenalComunitaria() {
    await prisma.parametroSistema.upsert({
        where: { clave: "padre.senal_comunitaria.refresh_min" },
        update: {
            valor: "60",
            tipo: TipoParametro.INTEGER,
            descripcion: "Minutos entre refrescos de la caché de señal comunitaria por parte del worker",
        },
        create: {
            clave: "padre.senal_comunitaria.refresh_min",
            valor: "60",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Minutos entre refrescos de la caché de señal comunitaria por parte del worker",
        },
    });
    console.log("Parámetro padre.senal_comunitaria.refresh_min (SPEC-234) listo");
}

// ── SPEC-241 (002-PI-144): parámetros de consentimiento informado + evento/plantillas
// del Motor Notif. Idempotente (patrón I-100): upsert de parámetros y plantillas;
// reglas con upsertNotificacionRegla por clave canónica (SPEC-247). Las rutas apuntan a los documentos legales
// copiados en public/legal/; ODIN no redacta contenido legal.
async function seedConsentimiento() {
    const parametros = [
        {
            clave: "consentimiento.version_actual",
            valor: "v0.4",
            tipo: TipoParametro.STRING,
            categoria: CategoriaParametro.LEGAL,
            descripcion: "Versión vigente del consentimiento informado (SPEC-241)",
        },
        {
            clave: "consentimiento.padre.documento_ruta",
            valor: "public/legal/POLITICA-TRATAMIENTO-DATOS-v0.4.md",
            tipo: TipoParametro.STRING,
            categoria: CategoriaParametro.LEGAL,
            descripcion: "Ruta del documento legal para padres/tutores (SPEC-241)",
        },
        {
            clave: "consentimiento.colegio.documento_ruta",
            valor: "public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS.md",
            tipo: TipoParametro.STRING,
            categoria: CategoriaParametro.LEGAL,
            descripcion: "Ruta del convenio institucional para colegios (SPEC-241)",
        },
    ];

    for (const p of parametros) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: {
                valor: p.valor,
                tipo: p.tipo,
                categoria: p.categoria,
                descripcion: p.descripcion,
            },
            create: {
                clave: p.clave,
                valor: p.valor,
                tipo: p.tipo,
                categoria: p.categoria,
                esPublico: false,
                esSecreto: false,
                descripcion: p.descripcion,
            },
        });
    }
    console.log("[SEED] Parámetros de consentimiento (SPEC-241) listos");

    const evento = "consentimiento.aceptado";
    const asunto = "Confirmación de aceptación de términos";
    const cuerpoEmail =
        "Hola {{nombreUsuario}},\n\n" +
        "Confirmamos que aceptaste la versión {{version}} de los términos de tratamiento de datos personales el {{fechaAceptacion}}.\n\n" +
        "Puedes consultar tu expediente y configuración en {{urlDashboard}}.";
    const cuerpoInApp = "Aceptaste los términos de tratamiento de datos personales (versión {{version}}).";

    const plantillas = [
        { clave: `${evento}.email`, canal: "EMAIL" as const, asunto, cuerpoMarkdown: cuerpoEmail },
        { clave: `${evento}.in_app`, canal: "IN_APP" as const, asunto: undefined, cuerpoMarkdown: cuerpoInApp },
    ];

    for (const pl of plantillas) {
        await prisma.notificacionPlantilla.upsert({
            where: { clave: pl.clave },
            update: {
                canal: pl.canal,
                asunto: pl.asunto ?? null,
                cuerpoMarkdown: pl.cuerpoMarkdown,
                variablesSchema: {
                    type: "object",
                    properties: {
                        nombreUsuario: { type: "string" },
                        version: { type: "string" },
                        fechaAceptacion: { type: "string" },
                        urlDashboard: { type: "string" },
                    },
                },
                activa: true,
            },
            create: {
                clave: pl.clave,
                canal: pl.canal,
                asunto: pl.asunto ?? null,
                cuerpoMarkdown: pl.cuerpoMarkdown,
                variablesSchema: {
                    type: "object",
                    properties: {
                        nombreUsuario: { type: "string" },
                        version: { type: "string" },
                        fechaAceptacion: { type: "string" },
                        urlDashboard: { type: "string" },
                    },
                },
                activa: true,
            },
        });
    }

    // SPEC-247: una sola regla por (evento, canal, plantillaClave); el motor no usa
    // `rol` para filtrar destinatarios, así que el representante del evento basta.
    for (const canal of ["EMAIL", "IN_APP"] as const) {
        await upsertNotificacionRegla({
            evento,
            rol: "PARENT",
            canal,
            plantillaClave: `${evento}.${canal.toLowerCase()}`,
            obligatoria: false,
            activa: true,
        });
    }
    console.log("[SEED] Evento consentimiento.aceptado (SPEC-241) listo");
}

// ── SPEC-236 (002-PI-mega-cola): parámetros del motor de expediente + 11 eventos
// y plantillas de Motor Notif. Idempotente (patrón I-100 de SPEC-201: upsert con
// update explícito para propagar cambios de default definidos en código).
// Nota: `padre.expediente.consolidacion_min_reportes`, `padre.expediente.auto_cierre_meses`
// y los SLA `padre.comite.sla_horas_*` ya los siembra SPEC-230 (seedParametrosPadre);
// aquí solo se añaden los parámetros nuevos de esta spec.
async function seedMotorExpediente() {
    const paramsMotor = [
        { clave: "padre.expediente.motor.tick_min", valor: "15", descripcion: "Minutos entre ticks del worker del motor de expediente" },
        { clave: "padre.expediente.retencion_cerrados_meses", valor: "24", descripcion: "Meses tras el cierre para purgar textos del expediente ([retenido])" },
    ];
    for (const p of paramsMotor) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: { valor: p.valor, descripcion: p.descripcion },
            create: {
                clave: p.clave,
                valor: p.valor,
                tipo: TipoParametro.INTEGER,
                categoria: CategoriaParametro.SYSTEM,
                esPublico: false,
                descripcion: p.descripcion,
            },
        });
    }
    console.log("Parámetros del motor de expediente (SPEC-236) listos");

    // 11 eventos del ciclo de vida del expediente (FR-018) con su audiencia.
    type EventoExpedienteSeed = {
    /** SPEC-340: evento derogado — el seed desactiva su plantilla. */
    derogada?: boolean;
        evento: string;
        roles: string[];
        asuntoEmail: string;
        cuerpoEmail: string;
        cuerpoInApp: string;
    };
    const eventosSeed: EventoExpedienteSeed[] = [
        {
            evento: "expediente.creado",
            roles: ["PADRE"],
            asuntoEmail: "Tu expediente fue creado",
            cuerpoEmail: "Hola,\n\nSe creó un expediente para dar seguimiento a tus reportes. Puedes verlo en {{urlExpediente}}.",
            cuerpoInApp: "Se creó un expediente para dar seguimiento a tus reportes.",
        },
        {
            evento: "expediente.evento.agregado",
            roles: ["PADRE"],
            asuntoEmail: "Se agregó un evento a tu expediente",
            cuerpoEmail: "Hola,\n\nSe registró un nuevo evento en tu expediente. Revísalo en {{urlExpediente}}.",
            cuerpoInApp: "Se registró un nuevo evento en tu expediente.",
        },
        {
            evento: "expediente.gravedad.subio_a_rojo",
            roles: ["PADRE", "COMITE_VALIDACION"],
            asuntoEmail: "Cambio de prioridad en un expediente",
            cuerpoEmail: "Hola,\n\nLa prioridad del expediente {{expedienteId}} subió a {{scoreGravedadActual}}. Detalle en {{urlExpediente}}.",
            cuerpoInApp: "La prioridad del expediente {{expedienteId}} subió a {{scoreGravedadActual}}.",
        },
        {
            evento: "expediente.consolidacion.solicitada",
            roles: ["COMITE_VALIDACION"],
            asuntoEmail: "Expediente listo para consolidación",
            cuerpoEmail: "Hola,\n\nEl expediente {{expedienteId}} pasó a estado {{estadoDestino}} y requiere revisión del comité.",
            cuerpoInApp: "El expediente {{expedienteId}} requiere revisión del comité.",
        },
        {
            evento: "expediente.comite.aprobo",
            roles: ["PADRE"],
            asuntoEmail: "El comité aprobó el informe de tu expediente",
            cuerpoEmail: "Hola,\n\nEl comité aprobó el informe consolidado de tu expediente. Ingresa a {{urlExpediente}} para revisarlo.",
            cuerpoInApp: "El comité aprobó el informe consolidado de tu expediente.",
        },
        {
            evento: "expediente.aclaracion.solicitada",
            roles: ["PADRE"],
            asuntoEmail: "Se solicitó una aclaración sobre tu expediente",
            cuerpoEmail: "Hola,\n\nEl comité solicitó una aclaración sobre tu expediente. Motivo: {{motivo}}. Responde en {{urlExpediente}}.",
            cuerpoInApp: "El comité solicitó una aclaración sobre tu expediente.",
        },
        {
            evento: "expediente.aclaracion.respondida",
            roles: ["COMITE_VALIDACION"],
            asuntoEmail: "Aclaración respondida",
            cuerpoEmail: "Hola,\n\nEl titular respondió la aclaración del expediente {{expedienteId}}. El caso vuelve a estado {{estadoDestino}}.",
            cuerpoInApp: "El titular respondió la aclaración del expediente {{expedienteId}}.",
        },
        {
            evento: "expediente.cerrado",
            roles: ["PADRE"],
            asuntoEmail: "Tu expediente fue cerrado",
            cuerpoEmail: "Hola,\n\nTu expediente pasó a estado cerrado. Motivo: {{motivo}}. Puedes consultarlo en {{urlExpediente}}.",
            cuerpoInApp: "Tu expediente pasó a estado cerrado.",
        },
        {
            evento: "expediente.escalado",
            roles: ["PADRE", "COMITE_VALIDACION"],
            asuntoEmail: "Un expediente fue escalado",
            cuerpoEmail: "Hola,\n\nEl expediente {{expedienteId}} pasó a estado escalado a solicitud del titular. Detalle en {{urlExpediente}}.",
            cuerpoInApp: "El expediente {{expedienteId}} pasó a estado escalado.",
        },
        {
            // SPEC-340 (D-1): evento DEROGADO — nada se cierra nunca. La entrada
            // se conserva para que el seed DESACTIVE la plantilla en las BD que
            // ya la tienen activa (el upsert pisa `activa`).
            evento: "expediente.auto_cerrado_inactividad",
            derogada: true,
            roles: ["PADRE"],
            asuntoEmail: "Tu expediente se cerró por inactividad",
            cuerpoEmail: "Hola,\n\nTu expediente se cerró automáticamente por inactividad prolongada. Si lo necesitas, puedes solicitar su reapertura desde {{urlExpediente}}.",
            cuerpoInApp: "Tu expediente se cerró por inactividad. Puedes solicitar su reapertura.",
        },
        {
            evento: "expediente.comite.sla_vencido",
            roles: ["COMITE_VALIDACION"],
            asuntoEmail: "SLA de revisión de comité vencido",
            cuerpoEmail: "Hola,\n\nEl expediente {{expedienteId}} superó el tiempo límite de revisión del comité (límite: {{fechaLimite}}). Prioridad actual: {{scoreGravedadActual}}.",
            cuerpoInApp: "El expediente {{expedienteId}} superó el SLA de revisión del comité.",
        },
    ];

    for (const e of eventosSeed) {
        // SPEC-340: los eventos derogados quedan con la plantilla INACTIVA.
        const activa = !e.derogada;
        const plantillas = [
            { clave: `${e.evento}.email`, canal: "EMAIL" as const, asunto: e.asuntoEmail, cuerpoMarkdown: e.cuerpoEmail },
            { clave: `${e.evento}.in_app`, canal: "IN_APP" as const, asunto: undefined, cuerpoMarkdown: e.cuerpoInApp },
        ];
        for (const pl of plantillas) {
            await prisma.notificacionPlantilla.upsert({
                where: { clave: pl.clave },
                update: {
                    canal: pl.canal,
                    asunto: pl.asunto ?? null,
                    cuerpoMarkdown: pl.cuerpoMarkdown,
                    variablesSchema: { type: "object", properties: {} },
                    activa,
                },
                create: {
                    clave: pl.clave,
                    canal: pl.canal,
                    asunto: pl.asunto ?? null,
                    cuerpoMarkdown: pl.cuerpoMarkdown,
                    variablesSchema: { type: "object", properties: {} },
                    activa: true,
                },
            });
        }

        const rolRepresentativo = e.roles[0] ?? "PARENT";
        for (const canal of ["EMAIL", "IN_APP"] as const) {
            await upsertNotificacionRegla({
                evento: e.evento,
                rol: rolRepresentativo,
                canal,
                plantillaClave: `${e.evento}.${canal.toLowerCase()}`,
                obligatoria: false,
                activa: true,
            });
        }
    }
    console.log("Eventos y plantillas del motor de expediente (SPEC-236) listos");
}

// ── SPEC-237 (002-PI-mega-cola): SLA de las tareas de consolidación de la
// bandeja del comité. Idempotente (patrón I-100: upsert con update explícito).
// Nota: `padre.comite.miembros_minimos_aprobacion` ya lo siembra SPEC-230.
async function seedParametrosComiteConsolidacion() {
    await prisma.parametroSistema.upsert({
        where: { clave: "padre.comite.sla_horas_consolidacion" },
        update: {
            valor: "72",
            tipo: TipoParametro.INTEGER,
            descripcion: "Horas desde la creación para considerar vencido el SLA de una tarea de consolidación",
        },
        create: {
            clave: "padre.comite.sla_horas_consolidacion",
            valor: "72",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Horas desde la creación para considerar vencido el SLA de una tarea de consolidación",
        },
    });
    console.log("Parámetro padre.comite.sla_horas_consolidacion (SPEC-237) listo");
}

// SPEC-235 (002-PI-135): guías de acción v1 para el flujo padre.
// Idempotente: solo crea una guía ACTIVA v1 si la categoría aún no tiene ninguna.
// Si un admin ya creó/editó una guía, el seed la respeta (no pisa).
async function seedGuiasAccion(adminEmail: string) {
    const admin = await prisma.usuario.findUnique({ where: { email: adminEmail } });
    if (!admin) {
        console.log("[SEED] Guías de acción omitidas: no existe admin inicial.");
        return;
    }

    const marcaPreliminar = "contenido preliminar · pendiente revisión psicólogo+jurídico";

    const guiasBase: Array<{
        categoria: string;
        tituloEmocional: string;
        subtitulo: string;
        categoriaBadgeTexto: string;
        pasos: Array<{ orden: number; tipo: "TRANQUILIDAD" | "ATENCION" | "ACCION" | "URGENCIA"; titulo: string; descripcion: string }>;
        calloutTitulo: string;
        calloutTexto: string;
        botones: Array<{ tipo: "tel" | "url"; texto: string; subtexto?: string; valor: string; estilo: "primario" | "urgente" | "secundario" }>;
        piePagina: string;
    }> = [
        {
            categoria: "GROOMING",
            tituloEmocional: "Si alguien está construyendo confianza para dañar",
            subtitulo: "El grooming suele parecer amistad o atención al principio. Tomá distancia, documentá y pedí ayuda.",
            categoriaBadgeTexto: "Manipulación progresiva",
            pasos: [
                { orden: 1, tipo: "TRANQUILIDAD", titulo: "Respirá y escuchá", descripcion: "La urgencia que siente el adulto responsable es natural. Antes de actuar, calmarte ayuda a tomar mejores decisiones." },
                { orden: 2, tipo: "ATENCION", titulo: "No bloqueés el contacto todavía", descripcion: "Preservá las conversaciones como evidencia. Bloquear puede alertar al agresor y dificultar una investigación." },
                { orden: 3, tipo: "ACCION", titulo: "Capturá evidencia sin invadir", descripcion: "Fotos de pantalla de los mensajes, nombres de usuario, plataforma y fechas. No interrogués a la persona menor." },
                { orden: 4, tipo: "ACCION", titulo: "Cambiá contraseñas y revisá privacidad", descripcion: "Asegurá las cuentas del menor y de la familia. Activá la autenticación de dos factores donde sea posible." },
                { orden: 5, tipo: "URGENCIA", titulo: "Denunciá ante autoridad competente", descripcion: "Contactá a la Fiscalía, la Policía Judicial o la línea 141 del ICBF. El bloqueo definitivo lo define la autoridad." },
            ],
            calloutTitulo: "¿Por qué no bloquear de inmediado?",
            calloutTexto: "Bloquear puede destruir pruebas y alertar al agresor. Primero documentá, luego pedí orientación a las autoridades.",
            botones: [
                { tipo: "tel", texto: "Línea 141 ICBF", subtexto: "Atención 24 horas", valor: "141", estilo: "urgente" },
                { tipo: "url", texto: "CAI Virtual", subtexto: "Denuncia en línea", valor: "https://www.cai.gov.co", estilo: "primario" },
                { tipo: "url", texto: "Te Protejo", subtexto: "Orientación y denuncia", valor: "https://teprotejo.org", estilo: "secundario" },
            ],
            piePagina: marcaPreliminar,
        },
        {
            categoria: "SEXTORSION",
            tituloEmocional: "Si alguien exige material íntimo bajo amenaza",
            subtitulo: "La sextorsión funciona con vergüenza y aislamiento. Parar, respirar y pedir ayuda es la mejor estrategia.",
            categoriaBadgeTexto: "Extorsión con contenido íntimo",
            pasos: [
                { orden: 1, tipo: "TRANQUILIDAD", titulo: "No respondas con más contenido", descripcion: "Ceder rara vez detiene la extorsión. El agresor suele seguir exigiendo más." },
                { orden: 2, tipo: "ATENCION", titulo: "No borres todo de inmediato", descripcion: "Conservá mensajes, perfiles, enlaces y capturas. Son evidencia para la denuncia." },
                { orden: 3, tipo: "ACCION", titulo: "Bloqueá la comunicación y reportá la cuenta", descripcion: "Usá los mecanismos de la plataforma para reportar abuso. Luego bloqueá al contacto." },
                { orden: 4, tipo: "URGENCIA", titulo: "Hacé la denuncia", descripcion: "La Fiscalía y la Línea 141 atienden estos casos con protocolo de protección a la víctima." },
            ],
            calloutTitulo: "No estás solo",
            calloutTexto: "Muchas víctimas de sextorsión son menores. Pedir ayuda no es culpa; es el primer paso para cortar el ciclo.",
            botones: [
                { tipo: "tel", texto: "Línea 141 ICBF", subtexto: "Atención 24 horas", valor: "141", estilo: "urgente" },
                { tipo: "url", texto: "CAI Virtual", valor: "https://www.cai.gov.co", estilo: "primario" },
                { tipo: "url", texto: "Te Protejo", valor: "https://teprotejo.org", estilo: "secundario" },
            ],
            piePagina: marcaPreliminar,
        },
        {
            categoria: "DIFUSION_NO_CONSENTIDA",
            tituloEmocional: "Si una imagen o video íntimo se compartió sin consentimiento",
            subtitulo: "La difusión no consentida es delito. Se puede pedir la baja del contenido y denunciar sin exponer a la víctima.",
            categoriaBadgeTexto: "Imágenes compartidas sin permiso",
            pasos: [
                { orden: 1, tipo: "TRANQUILIDAD", titulo: "Priorizá el bienestar de la víctima", descripcion: "Evitá juicios. Ofrecé contención y escuchá sin presionar por detalles." },
                { orden: 2, tipo: "ACCION", titulo: "Solicitá la baja del contenido", descripcion: "Reportá el material en la plataforma como abuso/ contenido íntimo no consentido. No compartas el enlace." },
                { orden: 3, tipo: "ACCION", titulo: "Documentá URLs y perfiles", descripcion: "Capturas de pantalla de dónde se publicó, quién lo compartió y cuándo." },
                { orden: 4, tipo: "URGENCIA", titulo: "Denunciá ante Fiscalía o CAI", descripcion: "La Ley 2196 de 2022 tipifica este delito. Presentá la evidencia sin exponer a la víctima." },
            ],
            calloutTitulo: "No difundir = proteger",
            calloutTexto: "Compartir el material, aunque sea para pedir ayuda, reproduce el daño. Documentá por capturas propias.",
            botones: [
                { tipo: "tel", texto: "Línea 141 ICBF", subtexto: "Atención 24 horas", valor: "141", estilo: "urgente" },
                { tipo: "url", texto: "CAI Virtual", valor: "https://www.cai.gov.co", estilo: "primario" },
                { tipo: "url", texto: "Te Protejo", valor: "https://teprotejo.org", estilo: "secundario" },
            ],
            piePagina: marcaPreliminar,
        },
        {
            categoria: "EXTORSION",
            tituloEmocional: "Si alguien exige dinero o favores bajo amenaza",
            subtitulo: "La extorsión busca miedo y prisa. No pagar y pedir ayuda profesional es lo recomendado.",
            categoriaBadgeTexto: "Amenaza con exigencia",
            pasos: [
                { orden: 1, tipo: "TRANQUILIDAD", titulo: "No actués solo", descripcion: "Contale a un adulto de confianza. La presión del agresor disminuye cuando hay acompañamiento." },
                { orden: 2, tipo: "ATENCION", titulo: "No realices pagos ni entregues información", descripcion: "Pagar suele aumentar las exigencias. No confirmes datos personales ni financieros." },
                { orden: 3, tipo: "ACCION", titulo: "Guardá toda la evidencia", descripcion: "Mensajes de texto, audios, números, nombres de usuario y capturas de pantalla." },
                { orden: 4, tipo: "URGENCIA", titulo: "Denunciá de inmediato", descripcion: "Policía Judicial, Fiscalía o Gaula. Llevá la evidencia organizada." },
            ],
            calloutTitulo: "La plataforma no negocia",
            calloutTexto: "Esta comunidad registra señales para alertar, pero no intercambia con agresores. La denuncia formal es la vía.",
            botones: [
                { tipo: "tel", texto: "Gaula", subtexto: "Policía Nacional", valor: "+571165", estilo: "urgente" },
                { tipo: "tel", texto: "Línea 141 ICBF", valor: "141", estilo: "primario" },
                { tipo: "url", texto: "CAI Virtual", valor: "https://www.cai.gov.co", estilo: "secundario" },
            ],
            piePagina: marcaPreliminar,
        },
        {
            categoria: "DOXING",
            tituloEmocional: "Si alguien publicó datos personales para exponer o intimidar",
            subtitulo: "El doxing expone información privada. La prioridad es proteger la seguridad física y digital de la persona afectada.",
            categoriaBadgeTexto: "Exposición de datos personales",
            pasos: [
                { orden: 1, tipo: "ATENCION", titulo: "Evaluá la gravedad de lo expuesto", descripcion: "Dirección, teléfono, escuela o lugar de trabajo requieren acción más urgente que un email o nickname." },
                { orden: 2, tipo: "ACCION", titulo: "Solicitá la eliminación del contenido", descripcion: "Reportá en la plataforma por violación de privacidad o acoso. Guardá capturas antes de que se borre." },
                { orden: 3, tipo: "ACCION", titulo: "Reforzá la seguridad digital", descripcion: "Cambiá contraseñas, revisá la configuración de privacidad y limitá la información pública." },
                { orden: 4, tipo: "URGENCIA", titulo: "Denunciá ante autoridades", descripcion: "Si hay riesgo físico, contactá a la Policía y Fiscalía. El doxing puede estar vinculado a delitos de amenaza o lesiones." },
            ],
            calloutTitulo: "No respondas con más exposición",
            calloutTexto: "Evitá publicar más datos de la víctima o del agresor. La documentación privada es la herramienta legal.",
            botones: [
                { tipo: "tel", texto: "Línea 141 ICBF", subtexto: "Atención 24 horas", valor: "141", estilo: "urgente" },
                { tipo: "url", texto: "CAI Virtual", valor: "https://www.cai.gov.co", estilo: "primario" },
                { tipo: "url", texto: "Te Protejo", valor: "https://teprotejo.org", estilo: "secundario" },
            ],
            piePagina: marcaPreliminar,
        },
        {
            categoria: "CIBERACOSO",
            tituloEmocional: "Si hay acoso repetido en entornos digitales",
            subtitulo: "El ciberacoso puede ser mensajes, burlas, exclusión o suplantación. Documentar y reportar ayuda a detenerlo.",
            categoriaBadgeTexto: "Acoso en línea",
            pasos: [
                { orden: 1, tipo: "TRANQUILIDAD", titulo: "Escuchá sin minimizar", descripcion: "Para quien lo sufre, el acoso en línea es real. Validá sus emociones antes de buscar soluciones." },
                { orden: 2, tipo: "ACCION", titulo: "Bloqueá y reportá en la plataforma", descripcion: "Usá las herramientas de reporte. Capturá todo antes de bloquear por si la cuenta desaparece." },
                { orden: 3, tipo: "ACCION", titulo: "Conservá un registro de fechas", descripcion: "Una línea de tiempo ayuda a mostrar el patrón repetido ante la escuela, la plataforma o la autoridad." },
                { orden: 4, tipo: "ACCION", titulo: "Informá a la institución correspondiente", descripcion: "Si involucra a la escuela, contactá al comité de convivencia. Si es grave, acudé a la Fiscalía." },
            ],
            calloutTitulo: "No respondas con el mismo tono",
            calloutTexto: "Responder al acoso puede escalar la situación. Documentá, reportá y pedí apoyo institucional.",
            botones: [
                { tipo: "url", texto: "Te Protejo", subtexto: "Orientación y denuncia", valor: "https://teprotejo.org", estilo: "primario" },
                { tipo: "tel", texto: "Línea 141 ICBF", valor: "141", estilo: "secundario" },
                { tipo: "url", texto: "CAI Virtual", valor: "https://www.cai.gov.co", estilo: "secundario" },
            ],
            piePagina: marcaPreliminar,
        },
        {
            categoria: "SOLICITUD_ENCUENTRO",
            tituloEmocional: "Si alguien propone encontrarse en persona",
            subtitulo: "Un adulto que busca encontrarse con un menor en secreto pone en riesgo su seguridad. Actuá con calma y firmeza.",
            categoriaBadgeTexto: "Propuesta de encuentro físico",
            pasos: [
                { orden: 1, tipo: "URGENCIA", titulo: "Evitá el encuentro y no lo justifiques", descripcion: "Ningún adulto con buenas intenciones necesita secreto para ver a un menor." },
                { orden: 2, tipo: "ATENCION", titulo: "Conservá toda la conversación", descripcion: "No borres mensajes, audios ni ubicaciones. Son evidencia clave." },
                { orden: 3, tipo: "ACCION", titulo: "Informá a la familia y a las autoridades", descripcion: "Este tipo de situación requiere denuncia formal. La prevención física es prioridad." },
                { orden: 4, tipo: "ACCION", titulo: "Reforzá la supervisión", descripcion: "Revisá con quién tiene contacto el menor y ajustá la privacidad de sus redes." },
            ],
            calloutTitulo: "El secreto es una señal de alarma",
            calloutTexto: "Pedir encuentros a escondidas, regalos o fotos es parte de una estrategia de acercamiento. Detenerlo temprano es clave.",
            botones: [
                { tipo: "tel", texto: "Línea 141 ICBF", subtexto: "Atención 24 horas", valor: "141", estilo: "urgente" },
                { tipo: "url", texto: "CAI Virtual", valor: "https://www.cai.gov.co", estilo: "primario" },
                { tipo: "url", texto: "Te Protejo", valor: "https://teprotejo.org", estilo: "secundario" },
            ],
            piePagina: marcaPreliminar,
        },
        {
            categoria: "COMPARTIMIENTO_SEXUAL",
            tituloEmocional: "Si se compartió o solicitó material sexual de un menor",
            subtitulo: "Toda imagen o video sexual de menores es abuso. La respuesta es denunciar, preservar evidencia y proteger a la víctima.",
            categoriaBadgeTexto: "Material sexual de menores",
            pasos: [
                { orden: 1, tipo: "ATENCION", titulo: "No compartas el material", descripcion: "Ni siquiera para pedir ayuda. Su posesión o difusión también es delito." },
                { orden: 2, tipo: "ACCION", titulo: "Reportá en la plataforma", descripcion: "Usá la opción de reporte por explotación sexual infantil. Guardá URLs, perfiles y capturas sin el contenido íntimo." },
                { orden: 3, tipo: "URGENCIA", titulo: "Denunciá de inmediato", descripcion: "Fiscalía, CAI o Policía Judicial. Este delito requiere acción profesional urgente." },
                { orden: 4, tipo: "ACCION", titulo: "Acompañá a la víctima", descripcion: "Ofrecé contención y buscá apoyo psicológico. La culpa no es de quien fue engañado o presionado." },
            ],
            calloutTitulo: "La víctima no es responsable",
            calloutTexto: "Los menores son manipulados, engañados o presionados. La responsabilidad es siempre del adulto agresor.",
            botones: [
                { tipo: "tel", texto: "Línea 141 ICBF", subtexto: "Atención 24 horas", valor: "141", estilo: "urgente" },
                { tipo: "url", texto: "CAI Virtual", valor: "https://www.cai.gov.co", estilo: "primario" },
                { tipo: "url", texto: "Te Protejo", valor: "https://teprotejo.org", estilo: "secundario" },
            ],
            piePagina: marcaPreliminar,
        },
    ];

    for (const g of guiasBase) {
        const existe = await prisma.guiaAccionCategoria.findFirst({
            where: { categoria: g.categoria },
        });
        if (existe) {
            console.log(`[SEED] Guía ${g.categoria} ya existe, se respeta.`);
            continue;
        }
        await prisma.guiaAccionCategoria.create({
            data: {
                categoria: g.categoria,
                versionSecuencial: 1,
                tituloEmocional: g.tituloEmocional,
                subtitulo: g.subtitulo,
                categoriaBadgeTexto: g.categoriaBadgeTexto,
                pasosJson: g.pasos,
                calloutTitulo: g.calloutTitulo,
                calloutTexto: g.calloutTexto,
                botonesAccionJson: g.botones,
                piePagina: g.piePagina,
                estado: EstadoGuiaAccion.ACTIVA,
                aprobadaPorComiteJson: [],
                creadaPorAdminId: admin.id,
            },
        });
        console.log(`[SEED] Guía ${g.categoria} v1 creada.`);
    }
}

// SPEC-243 (002-PI-146): seed idempotente del catálogo de planes.
// 4 planes por rol (PADRE/COLEGIO): Freemium 30 días, 3 meses, 6 meses y Anual.
// Se usa upsert({ create, update: {} }) para no pisar ediciones manuales del admin.
async function seedPlanesPagos(adminId: string) {
    const ZONA_BOGOTA = "America/Bogota";
    const anioActual = Number(formatInTimeZone(new Date(), ZONA_BOGOTA, "yyyy"));

    const planesPorRol: Record<TipoTitular, Array<{ duracion: DuracionPlan; nombre: string; precioBaseCOP: number; esFreemium: boolean; usosMaximosPorCliente: number | null; descripcion: string }>> = {
        [TipoTitular.PADRE]: [
            { duracion: DuracionPlan.MES_1, nombre: "Prueba gratis 30 días", precioBaseCOP: 0, esFreemium: true, usosMaximosPorCliente: 1, descripcion: "Plan gratuito de 30 días para padres" },
            { duracion: DuracionPlan.MES_3, nombre: "Padre · 3 meses", precioBaseCOP: 39_900, esFreemium: false, usosMaximosPorCliente: null, descripcion: "Suscripción de 3 meses para padres" },
            { duracion: DuracionPlan.MES_6, nombre: "Padre · 6 meses", precioBaseCOP: 69_900, esFreemium: false, usosMaximosPorCliente: null, descripcion: "Suscripción de 6 meses para padres" },
            { duracion: DuracionPlan.MES_12, nombre: "Padre · Anual", precioBaseCOP: 119_900, esFreemium: false, usosMaximosPorCliente: null, descripcion: "Suscripción anual para padres" },
        ],
        [TipoTitular.COLEGIO]: [
            { duracion: DuracionPlan.MES_1, nombre: "Colegio · Prueba gratis 30 días", precioBaseCOP: 0, esFreemium: true, usosMaximosPorCliente: 1, descripcion: "Plan gratuito de 30 días para colegios" },
            { duracion: DuracionPlan.MES_3, nombre: "Colegio · 3 meses", precioBaseCOP: 199_000, esFreemium: false, usosMaximosPorCliente: null, descripcion: "Suscripción de 3 meses para colegios" },
            { duracion: DuracionPlan.MES_6, nombre: "Colegio · 6 meses", precioBaseCOP: 349_000, esFreemium: false, usosMaximosPorCliente: null, descripcion: "Suscripción de 6 meses para colegios" },
            { duracion: DuracionPlan.MES_12, nombre: "Colegio · Anual", precioBaseCOP: 599_000, esFreemium: false, usosMaximosPorCliente: null, descripcion: "Suscripción anual para colegios" },
        ],
    };

    const planesBase = [];
    for (const tipo of [TipoTitular.COLEGIO, TipoTitular.PADRE]) {
        for (const cfg of planesPorRol[tipo]) {
            planesBase.push({
                tipoTitular: tipo,
                duracion: cfg.duracion,
                anio: anioActual,
                nombre: cfg.nombre,
                precio: 0, // legacy placeholder; no usar en lógica nueva
                precioBaseUSD: 0,
                precioBaseCOP: cfg.precioBaseCOP,
                esFreemium: cfg.esFreemium,
                usosMaximosPorCliente: cfg.usosMaximosPorCliente,
                activo: true,
                descripcion: cfg.descripcion,
                creadoPorAdminId: adminId,
            });
        }
    }

    for (const plan of planesBase) {
        // SPEC-293 (002-PI-194 · cierra I-156): las filas freemium (PADRE MES_1,
        // COLEGIO MES_1) tienen 5 campos canónicos que el seed DEBE curar en cada
        // corrida — no son negociables por el admin (freemium siempre es gratis,
        // activo, 1 uso por cliente). Los 6 planes pagos siguen con update:{}
        // (anti-I-100) para no pisar ediciones de `precioBaseCOP`.
        //
        // Causa raíz del I-156: hasta este SPEC, `update:{}` literal para TODAS
        // las filas dejaba varados los planes MES_1 heredados con esFreemium=false
        // (rename cosmético post-SPEC-289). Para desactivar el freemium en prod,
        // el switch correcto es `pagos.freemium.activo=false` en ParametroSistema,
        // ya soportado por freemium-activacion.service.ts (SPEC-217).
        const updateFreemium = plan.esFreemium
            ? {
                esFreemium: true,
                activo: true,
                precioBaseCOP: 0,
                usosMaximosPorCliente: 1,
                nombre: plan.nombre,
            }
            : {};
        await prisma.plan.upsert({
            where: {
                tipoTitular_duracion_anio: {
                    tipoTitular: plan.tipoTitular,
                    duracion: plan.duracion,
                    anio: plan.anio,
                },
            },
            update: updateFreemium,
            create: plan,
        });
    }
    console.log(`[SEED] ${planesBase.length} planes de pagos listos`);
}

// SPEC-210/243 (002-PI-110/146): parámetros del módulo de pagos.
// Las 7 claves de §6.3 se siembran con update: {} para no pisar ajustes manuales.
async function seedParametrosPagos() {
    const pagosParams = [
        { clave: "pagos.descuento_anual_pct_default", valor: "15", tipo: TipoParametro.FLOAT, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "% descuento aplicable a duración MES_12 salvo override en Plan" },
        { clave: "pagos.freemium.duracion_dias", valor: "30", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Días de duración del freemium" },
        { clave: "pagos.freemium.activo", valor: "true", tipo: TipoParametro.BOOLEAN, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Activar freemium para nuevos clientes" },
        { clave: "pagos.referidos.max_por_año", valor: "5", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Máximo de referidos exitosos por año por cliente" },
        { clave: "pagos.referidos.notificar_admin_al", valor: "4", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Al 4º referido del año notificar a admin para revisión" },
        // ── SPEC-215: % de descuento del primer pago del referido (programa de referidos).
        { clave: "pagos.referidos.descuento_referido_pct", valor: "15", tipo: TipoParametro.FLOAT, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "% de descuento en el primer pago del cliente referido" },
        { clave: "pagos.gracia_dias", valor: "3", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Días de gracia antes del corte automático" },
        { clave: "pagos.moneda_base", valor: "USD", tipo: TipoParametro.STRING, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Moneda base del modelo comercial" },
        { clave: "pagos.tasas.api_url_default", valor: "https://api.exchangerate.host/v1/latest?access_key=REPLACE_ME&base=USD&symbols=", tipo: TipoParametro.STRING, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "URL default para consulta de tasas de cambio" },
        { clave: "pagos.tasas.refresco_horas", valor: "24", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Horas entre refrescos de la tasa de cambio" },
        { clave: "pagos.tasas.monedas_destino", valor: "COP,MXN,CLP,ARS", tipo: TipoParametro.STRING, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Monedas destino para tasas de cambio (CSV)" },
        { clave: "pagos.contrato_obligatorio_colegios", valor: "true", tipo: TipoParametro.BOOLEAN, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "El contrato firmado es obligatorio para colegios" },
        { clave: "pagos.contrato_obligatorio_padres", valor: "false", tipo: TipoParametro.BOOLEAN, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "El contrato firmado es obligatorio para padres" },
        { clave: "pagos.comprobante_tamaño_max_mb", valor: "10", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Tamaño máximo del comprobante de pago en MB" },
        { clave: "pagos.comprobante_formatos_permitidos", valor: "image/png,image/jpeg,application/pdf", tipo: TipoParametro.STRING, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Formatos MIME permitidos para comprobantes" },
        // SPEC-240 (002-PI-143): vigencia del link de activación enviado al rector.
        { clave: "pagos.invitacion.token_vigencia_horas", valor: "48", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Horas de vigencia del link de activación de cuenta de rector" },
        // ── SPEC-243: parámetros globales de IVA, freemium y recompensa (§6.3).
        { clave: "pagos.iva.porcentaje", valor: "19", tipo: TipoParametro.FLOAT, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Porcentaje de IVA aplicado a los planes pagos" },
        { clave: "pagos.iva.aplica_a", valor: "todos", tipo: TipoParametro.STRING, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Ámbito de aplicación del IVA: todos, solo_colegios, solo_padres, ninguno" },
        { clave: "pagos.recompensa.activa", valor: "true", tipo: TipoParametro.BOOLEAN, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Indica si el programa de recompensas por referidos está activo" },
        { clave: "pagos.recompensa.meses_gratis", valor: "1", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Meses gratis otorgados como recompensa por referido exitoso" },
        { clave: "pagos.recompensa.max_por_año", valor: "5", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Máximo de recompensas por referido al año por cliente" },
        // SPEC-244 (002-PI-147): parámetros del programa de recompensas por pago manual.
        { clave: "pagos.recompensa.cupones_por_pago", valor: "5", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Cupones de recompensa generados por cada pago manual autorizado" },
        { clave: "pagos.recompensa.porcentaje_descuento", valor: "20", tipo: TipoParametro.FLOAT, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "% de descuento de cada cupón de recompensa" },
        { clave: "pagos.recompensa.vigencia_dias", valor: "90", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Días de vigencia de un cupón de recompensa desde su generación" },
        { clave: "pagos.recompensa.tope_max_cop", valor: "", tipo: TipoParametro.STRING, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Tope máximo en COP del descuento de un cupón (vacío = sin tope)" },
    ];

    const clavesNoPisar = new Set([
        "pagos.iva.porcentaje",
        "pagos.iva.aplica_a",
        "pagos.freemium.activo",
        "pagos.freemium.duracion_dias",
        "pagos.recompensa.activa",
        "pagos.recompensa.meses_gratis",
        "pagos.recompensa.max_por_año",
        "pagos.recompensa.cupones_por_pago",
        "pagos.recompensa.porcentaje_descuento",
        "pagos.recompensa.vigencia_dias",
        "pagos.recompensa.tope_max_cop",
    ]);

    for (const p of pagosParams) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: clavesNoPisar.has(p.clave) ? {} : { valor: p.valor, descripcion: p.descripcion },
            create: p,
        });
    }
    console.log(`[SEED] ${pagosParams.length} parámetros pagos.* listos`);
}

// ── SPEC-296 (002-PI-197 · cierra I-152): 19 eventos + plantillas + reglas para
// los emails migrados desde src/lib/email.ts al motor. Cada uno tiene texto
// equivalente al `text:` que hoy vive inline en email.ts (copia literal con
// placeholders {{var}}). `enviarEmailNotificacion` no está aquí — sigue siendo
// el proveedor real del motor (vive en src/lib/notificaciones/enviar-email.ts).
// Idempotente: plantilla con upsert; regla con upsertNotificacionRegla.
async function seedEventosEmailMigrados() {
    const plantillas: Array<{
        clave: string;
        asunto: string;
        cuerpoMarkdown: string;
        variablesSchema?: Record<string, unknown>;
    }> = [
        {
            clave: "auth.codigo_verificacion.email",
            asunto: "Código de verificación",
            cuerpoMarkdown: "Tu código de verificación es: {{codigo}}\n\nVálido por 15 minutos.",
            variablesSchema: { type: "object", properties: { codigo: { type: "string" } } },
        },
        {
            clave: "auth.password_recuperacion.email",
            asunto: "Restablece tu contraseña",
            cuerpoMarkdown:
                "Hola,\n\nRecibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente enlace:\n\n{{url}}\n\nEste enlace expira en 1 hora y solo puede usarse una vez. Si no solicitaste este cambio, ignora este mensaje.",
        },
        {
            // SPEC-338 (I-226): alguien intentó registrarse con un correo que ya
            // tiene cuenta. Anti-enumeración: la pantalla no revela nada; el aviso
            // va SOLO al buzón. Lenguaje de padre (A-62), sin tecnicismos.
            clave: "auth.cuenta_existente.email",
            // SPEC-339 (D-1): pasado a tuteo neutro. Este correo lo recibe el padre
            // DENTRO de la puerta que reconstruye A-67; dejarlo en voseo partiría
            // la voz en mitad del camino.
            asunto: "Ya tienes una cuenta con este correo",
            cuerpoMarkdown:
                "Hola,\n\nAlguien intentó crear una cuenta con este correo, pero tú ya tienes una con nosotros.\n\nPara entrar, usa tu correo y tu clave acá:\n{{urlLogin}}\n\n¿No recuerdas la clave? La recuperas en un minuto acá:\n{{urlRecuperar}}\n\nSi no fuiste tú, no tienes que hacer nada: tu cuenta está segura.",
            variablesSchema: { type: "object", properties: { urlLogin: { type: "string" }, urlRecuperar: { type: "string" } } },
        },
        {
            // SPEC-339 (A-67 §2.1): el padre recibe un ENLACE, no un código que
            // transcribe. Jelkin: "padres adultos que de pronto no son muy cercanos
            // a la tecnología". Tuteo neutro colombiano (decisión CEO D-1).
            clave: "auth.registro_enlace.email",
            asunto: "Crea tu contraseña y empecemos",
            cuerpoMarkdown:
                "Hola,\n\nEstás para cuidarlos. Nosotros, para avisarte.\n\nAbre este enlace y crea tu contraseña:\n{{url}}\n\nEl enlace vence en 24 horas y solo se puede usar una vez.\n\nSi no fuiste tú quien lo pidió, no tienes que hacer nada.",
            variablesSchema: { type: "object", properties: { url: { type: "string" } } },
        },
        {
            // SPEC-339 (A-67 §2.1): confirmación de que la cuenta quedó creada.
            clave: "auth.bienvenida_padre.email",
            asunto: "Tu cuenta está lista",
            cuerpoMarkdown:
                "Hola,\n\nTu cuenta quedó creada. Desde acá te avisamos si alguno de los tuyos aparece en un reporte.\n\nEntra cuando quieras:\n{{urlLogin}}\n\nTe faltan unos pocos pasos para terminar de configurarla. Con calma, toma un minuto.",
            variablesSchema: { type: "object", properties: { urlLogin: { type: "string" } } },
        },
        {
            clave: "usuario.bienvenida.operador.email",
            asunto: "Tu cuenta de operador está lista",
            cuerpoMarkdown:
                "Hola,\n\nSe creó tu cuenta de operador en Protección Infantil.\n\nUsuario: {{email}}\nContraseña temporal: {{tempPassword}}\n\nIngresa en {{urlLogin}} y cambia tu contraseña lo antes posible desde tu perfil o usando \"Olvidé mi contraseña\".\n\nEsta contraseña temporal no se volverá a mostrar.",
        },
        {
            clave: "usuario.bienvenida.comite.email",
            asunto: "Tu cuenta de comité de validación está lista",
            cuerpoMarkdown:
                "Hola,\n\nSe creó tu cuenta de comité de validación en Protección Infantil.\n\nUsuario: {{email}}\nContraseña temporal: {{tempPassword}}\n\nIngresa en {{urlLogin}} y cambia tu contraseña lo antes posible desde tu perfil o usando \"Olvidé mi contraseña\".\n\nEsta contraseña temporal no se volverá a mostrar.",
        },
        {
            clave: "usuario.credenciales.padre.email",
            asunto: "Tu cuenta en Protección Infantil",
            cuerpoMarkdown:
                "Hola,\n\nEl equipo de la plataforma gestionó el acceso a tu cuenta en Protección Infantil.\n\nUsuario: {{email}}\nContraseña temporal: {{tempPassword}}\n\nIngresa en {{urlLogin}} y cambia tu contraseña lo antes posible.\n\nEsta contraseña temporal no se volverá a mostrar.",
        },
        {
            clave: "comite.pendientes.alerta.email",
            asunto: "Tienes {{cantidad}} casos pendientes de revisión",
            cuerpoMarkdown:
                "Tienes {{cantidad}} {{plural}} pendientes de revisión en el comité de validación. Ingresa para revisar:\n\n{{urlBandeja}}",
        },
        {
            clave: "comite.apelaciones.plazo.email",
            asunto: "{{cantidad}} {{plural}} {{pluralVencer}}",
            cuerpoMarkdown:
                "Hay {{cantidad}} {{plural}} sin resolver que se acercan al plazo de respuesta (15 días hábiles, Ley 1581):\n\n{{lineas}}\n\nRevisa la bandeja de apelaciones:\n{{urlBandeja}}",
        },
        {
            clave: "reporte.revision.requerida.email",
            asunto: "Reporte {{numeroSeguimiento}}{{prioridadTag}} requiere revisión manual",
            cuerpoMarkdown:
                "El reporte {{numeroSeguimiento}} ({{identificador}}) requirió revisión manual con estado {{estado}}.{{notaPrioridad}}\n\nVer en el panel de administración: {{urlPanel}}",
        },
        {
            clave: "reporte.score_critico.email",
            asunto: "Score crítico: {{identificador}}",
            cuerpoMarkdown:
                "El identificador {{identificador}} en {{plataforma}} alcanzó un score de {{score}} ({{nivelRiesgo}}).\n\nVer en el panel de administración: {{urlPanel}}",
        },
        {
            clave: "padre.circulo_confianza.pendientes.email",
            asunto: "Tienes {{novedadTexto}} en tu Círculo de Confianza",
            cuerpoMarkdown:
                "Tienes {{novedadTexto}} en tu Círculo de Confianza. Ingresa para revisar:\n\n{{urlPanel}}",
        },
        {
            clave: "padre.circulo_confianza.reporte_enriquecido.email",
            asunto: "{{asunto}}",
            cuerpoMarkdown:
                "{{cuerpo}}\n\nIngresa a tu panel para ver el contexto completo:\n{{urlPanel}}",
        },
        {
            // SPEC-339 (A-67 · punto 4 Calidad): el aviso que hace ÚTIL el Paso 3.
            // Voz del brief §3: calma que tranquiliza, cero alarma, tuteo neutro.
            clave: "padre.hijo.reporte.email",
            asunto: "Sobre {{nombreHijo}} — sin afán, pero míralo",
            cuerpoMarkdown:
                "Hola,\n\nUna cuenta de {{nombreHijo}} ({{identificador}}{{plataformaTexto}}) apareció en un reporte hoy. Entra a ver de qué se trata, con calma:\n\n{{urlPanel}}\n\nEste aviso no incluye el contenido del reporte; todo está en tu panel.",
            variablesSchema: {
                type: "object",
                properties: {
                    nombreHijo: { type: "string" },
                    identificador: { type: "string" },
                    plataformaTexto: { type: "string" },
                    urlPanel: { type: "string" },
                },
            },
        },
        {
            clave: "colegio.reporte_nuevo.email",
            asunto: "Te avisamos: tienes un reporte nuevo para revisar",
            cuerpoMarkdown:
                "Hola,\n\nTe avisamos que llegó un reporte nuevo relacionado con tu colegio. Ingresa a tu panel para revisarlo:\n\n{{urlAlertas}}\n\nEste aviso no incluye datos del reporte; toda la información está en tu panel.",
        },
        {
            clave: "colegio.curso.umbral.email",
            asunto: "Te avisamos: un curso de tu colegio acumula reportes",
            cuerpoMarkdown:
                "Hola,\n\nTe avisamos que un curso de tu colegio acumula {{reportes}} reportes en los últimos {{dias}} días. Ingresa a tu panel para ver el panorama completo:\n\n{{urlPanel}}\n\nEste aviso no incluye nombres ni datos de los reportes; toda la información está en tu panel.",
        },
        {
            clave: "colegio.estudiante.repetido.email",
            asunto: "Te avisamos: un estudiante de tu colegio acumula reportes",
            cuerpoMarkdown:
                "Hola,\n\nTe avisamos que un estudiante de tu colegio acumula {{reportes}} reportes en los últimos {{dias}} días. Ingresa a tu panel para revisar el caso:\n\n{{urlAlertas}}\n\nEste aviso no incluye el nombre del estudiante ni datos de los reportes; toda la información está en tu panel.",
        },
        {
            clave: "colegio.resumen_semanal.email",
            asunto: "Tu resumen de la semana",
            cuerpoMarkdown:
                "Hola,\n\n{{cuerpo}}\n\nIngresa a tu panel para ver el detalle:\n\n{{urlPanel}}\n\nEste resumen solo muestra conteos; toda la información está en tu panel.",
        },
        {
            clave: "colegio.alerta.pendientes.email",
            asunto: "Tiene {{novedadTexto}} para revisar en su panel de colegio",
            cuerpoMarkdown:
                "Tiene {{novedadTexto}} para revisar en su panel de colegio. Ingrese y valide.\n\n{{urlAlertas}}",
        },
        {
            clave: "suscriptores.reporte_publicado.email",
            asunto: "Nuevo reporte en un identificador que sigues",
            cuerpoMarkdown:
                "Hola,\n\nSe registró un nuevo reporte para un identificador que sigues en {{plataforma}}.\n\nTotal de reportes registrados: {{totalReportes}}\n\nIngresa a la plataforma para consultarlo: {{urlHome}}\n\nRecibirás como máximo un email cada 24 horas por este identificador.",
        },
        {
            clave: "infra.alerta.email",
            asunto: "[PI-ALERTA] Infra: {{senal}} en rojo",
            cuerpoMarkdown:
                "Señal en rojo: {{senal}}\nDesde: {{inicio}}\n{{detalle}}\n\nEl sistema reintenta solo; si persiste, revisa el servidor.",
        },
        {
            clave: "infra.rate_limit.email",
            asunto: "[PI-ALERTA] Posible abuso: {{senal}}",
            cuerpoMarkdown:
                "Señal de posible abuso: {{senal}}\nDesde: {{inicio}}\n{{detalle}}\n\nRevisar el tablero Anti-abuso en el panel de administración.",
        },
        {
            clave: "motor.deriva.alerta.email",
            asunto: "[PI-MOTOR] Deriva del motor: {{sobreUmbral}} categorías sobre el umbral",
            cuerpoMarkdown: "{{cuerpo}}",
        },
        // SPEC-322: aviso de seguridad cuando cambia la contraseña (caminos propios del usuario).
        {
            clave: "auth.password_cambiada.email",
            asunto: "Tu contraseña fue cambiada — {{fechaHora}}",
            cuerpoMarkdown:
                "Hola,\n\nTu contraseña en Protección Infantil fue cambiada el **{{fechaHora}}** (hora de Colombia).\n\nSi fuiste tú, no necesitas hacer nada.\n\nSi **no fuiste tú**, recupera tu acceso de inmediato en {{urlRecuperar}} y escribe a soporte.\n\nEste es un mensaje automático de seguridad. No contiene tu contraseña ni enlaces de sesión.",
        },
    ];

    for (const p of plantillas) {
        await prisma.notificacionPlantilla.upsert({
            where: { clave: p.clave },
            update: {},
            create: {
                clave: p.clave,
                canal: "EMAIL",
                asunto: p.asunto,
                cuerpoMarkdown: p.cuerpoMarkdown,
                variablesSchema: (p.variablesSchema ?? { type: "object" }) as Prisma.InputJsonValue,
                activa: true,
            },
        });
    }

    // SPEC-308 (A-50): plantilla IN_APP para la alerta enriquecida del círculo.
    await prisma.notificacionPlantilla.upsert({
        where: { clave: "padre.circulo_confianza.reporte_enriquecido.in_app" },
        update: {},
        create: {
            clave: "padre.circulo_confianza.reporte_enriquecido.in_app",
            canal: "IN_APP",
            asunto: null,
            cuerpoMarkdown:
                "Alerta sobre {{nombreContacto}}: {{textoReportes}} en {{plataforma}}. Toca para ver el expediente.",
            variablesSchema: { type: "object" } as Prisma.InputJsonValue,
            activa: true,
        },
    });

    // Mapeo evento → (plantilla, rol representativo, obligatoria).
    // El `rol` es metadata para el panel admin; el motor no filtra por él en programar().
    // `obligatoria=true`: auth/credenciales/bienvenida/infra/deriva (no se permite opt-out).
    const reglas: Array<{ evento: string; plantillaClave: string; rol: string; obligatoria: boolean }> = [
        { evento: "auth.codigo_verificacion", plantillaClave: "auth.codigo_verificacion.email", rol: "PARENT", obligatoria: true },
        { evento: "auth.password_recuperacion", plantillaClave: "auth.password_recuperacion.email", rol: "PARENT", obligatoria: true },
        // SPEC-338 (I-226): aviso "ya tenés una cuenta". rol "ALL" (como password_cambiada):
        // el destinatario puede ser de cualquier rol; evento de una sola regla → el motor no filtra.
        { evento: "auth.cuenta_existente", plantillaClave: "auth.cuenta_existente.email", rol: "ALL", obligatoria: true },
        // SPEC-339 (A-67): la puerta del padre. Obligatorias — sin ellas no puede
        // entrar, así que no admiten opt-out.
        { evento: "auth.registro_enlace", plantillaClave: "auth.registro_enlace.email", rol: "PARENT", obligatoria: true },
        { evento: "auth.bienvenida_padre", plantillaClave: "auth.bienvenida_padre.email", rol: "PARENT", obligatoria: true },
        { evento: "usuario.bienvenida.operador", plantillaClave: "usuario.bienvenida.operador.email", rol: "OPERADOR", obligatoria: true },
        { evento: "usuario.bienvenida.comite", plantillaClave: "usuario.bienvenida.comite.email", rol: "COMITE_VALIDACION", obligatoria: true },
        { evento: "usuario.credenciales.padre", plantillaClave: "usuario.credenciales.padre.email", rol: "PARENT", obligatoria: true },
        { evento: "comite.pendientes.alerta", plantillaClave: "comite.pendientes.alerta.email", rol: "COMITE_VALIDACION", obligatoria: false },
        { evento: "comite.apelaciones.plazo", plantillaClave: "comite.apelaciones.plazo.email", rol: "COMITE_VALIDACION", obligatoria: false },
        { evento: "reporte.revision.requerida", plantillaClave: "reporte.revision.requerida.email", rol: "ADMIN", obligatoria: false },
        { evento: "reporte.score_critico", plantillaClave: "reporte.score_critico.email", rol: "ADMIN", obligatoria: false },
        { evento: "padre.circulo_confianza.pendientes", plantillaClave: "padre.circulo_confianza.pendientes.email", rol: "PARENT", obligatoria: false },
        // SPEC-339: aviso sobre un hijo. NO obligatoria — el padre tiene SU
        // interruptor (notificacionesHijos), independiente del círculo.
        { evento: "padre.hijo.reporte", plantillaClave: "padre.hijo.reporte.email", rol: "PARENT", obligatoria: false },
        { evento: "padre.circulo_confianza.reporte_enriquecido", plantillaClave: "padre.circulo_confianza.reporte_enriquecido.email", rol: "PARENT", obligatoria: false },
        { evento: "colegio.reporte_nuevo", plantillaClave: "colegio.reporte_nuevo.email", rol: "SCHOOL_ADMIN", obligatoria: false },
        { evento: "colegio.curso.umbral", plantillaClave: "colegio.curso.umbral.email", rol: "SCHOOL_ADMIN", obligatoria: false },
        { evento: "colegio.estudiante.repetido", plantillaClave: "colegio.estudiante.repetido.email", rol: "SCHOOL_ADMIN", obligatoria: false },
        { evento: "colegio.resumen_semanal", plantillaClave: "colegio.resumen_semanal.email", rol: "SCHOOL_ADMIN", obligatoria: false },
        { evento: "colegio.alerta.pendientes", plantillaClave: "colegio.alerta.pendientes.email", rol: "SCHOOL_ADMIN", obligatoria: false },
        { evento: "suscriptores.reporte_publicado", plantillaClave: "suscriptores.reporte_publicado.email", rol: "PARENT", obligatoria: false },
        { evento: "infra.alerta", plantillaClave: "infra.alerta.email", rol: "ADMIN", obligatoria: true },
        { evento: "infra.rate_limit", plantillaClave: "infra.rate_limit.email", rol: "ADMIN", obligatoria: true },
        { evento: "motor.deriva.alerta", plantillaClave: "motor.deriva.alerta.email", rol: "ADMIN", obligatoria: true },
        // SPEC-322: aviso de seguridad — cubre todos los roles (rol:"ALL" es metadata; motor no filtra por rol).
        { evento: "auth.password_cambiada", plantillaClave: "auth.password_cambiada.email", rol: "ALL", obligatoria: true },
    ];

    for (const r of reglas) {
        await upsertNotificacionRegla({
            evento: r.evento,
            rol: r.rol,
            canal: "EMAIL",
            plantillaClave: r.plantillaClave,
            offset: "+0m",
            obligatoria: r.obligatoria,
        });
    }

    // SPEC-308 (A-50): regla IN_APP asociada a la alerta enriquecida del círculo.
    await upsertNotificacionRegla({
        evento: "padre.circulo_confianza.reporte_enriquecido",
        rol: "PARENT",
        canal: "IN_APP",
        plantillaClave: "padre.circulo_confianza.reporte_enriquecido.in_app",
        offset: "+0m",
        obligatoria: false,
    });

    console.log(`[SEED] ${plantillas.length} plantillas + ${reglas.length} reglas de email migradas listas (SPEC-296)`);
}

// ── SPEC-240 (002-PI-143): catálogo Motor Notif de la invitación de activación
// enviada al rector. Idempotente (patrón I-100): plantilla con upsert por clave,
// regla con upsertNotificacionRegla por clave canónica (SPEC-247).
async function seedInvitacionColegio() {
    const evento = "colegio.invitacion.enviada";
    const plantillaClave = `${evento}.email`;
    const asunto = "Activa tu cuenta de Protección Infantil";
    const cuerpoMarkdown =
        "Hola {{nombreRector}},\n\n" +
        "Has sido registrado como rector de **{{nombreColegio}}** en Protección Infantil.\n\n" +
        "Para activar tu cuenta y definir tu contraseña, haz clic en el siguiente link:\n\n" +
        "{{linkActivacion}}\n\n" +
        "Este link es de un solo uso y expira en 48 horas. Si no solicitaste este registro, ignora este mensaje.";

    await prisma.notificacionPlantilla.upsert({
        where: { clave: plantillaClave },
        update: {
            canal: "EMAIL",
            asunto,
            cuerpoMarkdown,
            variablesSchema: {
                type: "object",
                properties: {
                    nombreRector: { type: "string" },
                    nombreColegio: { type: "string" },
                    linkActivacion: { type: "string" },
                },
            },
            activa: true,
        },
        create: {
            clave: plantillaClave,
            canal: "EMAIL",
            asunto,
            cuerpoMarkdown,
            variablesSchema: {
                type: "object",
                properties: {
                    nombreRector: { type: "string" },
                    nombreColegio: { type: "string" },
                    linkActivacion: { type: "string" },
                },
            },
            activa: true,
        },
    });

    await upsertNotificacionRegla({
        evento,
        rol: "SCHOOL_ADMIN",
        canal: "EMAIL",
        plantillaClave,
        obligatoria: true,
        activa: true,
    });
    console.log("[SEED] Catálogo Motor Notif colegio.invitacion.enviada listo (SPEC-240)");
}

// ── SPEC-319 (002-PI-219 §2.2): catálogo Motor Notif de la invitación de la
// cuenta compartida del Comité de Convivencia. Evento PROPIO (no reusa
// `colegio.invitacion.enviada`) porque el motor hace fan-out sobre TODAS las
// reglas de un evento: agregar una regla de comité al evento del rector duplicaría
// el email de ambos. Con evento propio + regla única se evita el fan-out y el texto
// no dice "rector". Reusa el mismo mecanismo: motor + `/activar` + token opaco.
// Idempotente (upsert por clave + upsertNotificacionRegla por clave canónica).
async function seedInvitacionComite() {
    const evento = "comite.invitacion.enviada";
    const plantillaClave = `${evento}.email`;
    const asunto = "Activa la cuenta del Comité de Convivencia";
    const cuerpoMarkdown =
        "Hola,\n\n" +
        "Esta es la invitación para la cuenta compartida del **Comité de Convivencia** de **{{nombreColegio}}** en Protección Infantil.\n\n" +
        "Para activar la cuenta y definir su contraseña, haz clic en el siguiente link:\n\n" +
        "{{linkActivacion}}\n\n" +
        "Este link es de un solo uso y expira en 48 horas. Si no esperabas esta invitación, ignora este mensaje.";

    const variablesSchema = {
        type: "object",
        properties: {
            nombreColegio: { type: "string" },
            linkActivacion: { type: "string" },
        },
    };

    await prisma.notificacionPlantilla.upsert({
        where: { clave: plantillaClave },
        update: { canal: "EMAIL", asunto, cuerpoMarkdown, variablesSchema, activa: true },
        create: { clave: plantillaClave, canal: "EMAIL", asunto, cuerpoMarkdown, variablesSchema, activa: true },
    });

    await upsertNotificacionRegla({
        evento,
        rol: "COMITE_CONVIVENCIA",
        canal: "EMAIL",
        plantillaClave,
        obligatoria: true,
        activa: true,
    });
    console.log("[SEED] Catálogo Motor Notif comite.invitacion.enviada listo (SPEC-319)");
}

// ── SPEC-220 (002-PI-121): parámetros del dominio Análisis dinero-vs-valor ──
// 13 claves `analisis.*` (12 del brief §5.7 + retención de snapshots).
// Idempotente: `update: {}` — el seed nunca pisa el tuning hecho por el admin
// (pesos, umbrales y frecuencias son ajustables sin deploy).
async function seedParametrosAnalisis() {
    const analisisParams = [
        { clave: "analisis.score.peso_reportes", valor: "3", tipo: TipoParametro.FLOAT, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Peso del componente Reportes en el score de valor" },
        { clave: "analisis.score.peso_casos", valor: "5", tipo: TipoParametro.FLOAT, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Peso del componente Casos en el score de valor" },
        { clave: "analisis.score.peso_alertas", valor: "2", tipo: TipoParametro.FLOAT, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Peso del componente Alertas en el score de valor" },
        { clave: "analisis.score.peso_sesiones", valor: "1", tipo: TipoParametro.FLOAT, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Peso del componente Sesiones en el score de valor" },
        { clave: "analisis.score.frecuencia_recalculo_horas", valor: "24", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Horas entre recálculos del score de valor (cron del worker)" },
        { clave: "analisis.score.retencion_meses", valor: "24", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Meses de retención de snapshots de score antes de la purga (Ley 1581)" },
        { clave: "analisis.recomendaciones.frecuencia_evaluacion_min", valor: "60", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Minutos entre evaluaciones del motor de reglas (SPEC-221)" },
        { clave: "analisis.digest.dia_semana", valor: "1", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Día de la semana de envío del digest (1 = lunes)" },
        { clave: "analisis.digest.hora_bogota", valor: "8", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Hora Bogotá de envío del digest semanal" },
        { clave: "analisis.anomalias.crecimiento_pct_umbral", valor: "25", tipo: TipoParametro.FLOAT, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "% de cambio que dispara anomalía de crecimiento (SPEC-225)" },
        { clave: "analisis.anomalias.mora_dias_umbral_alta", valor: "30", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Días de mora para severidad ALTA (SPEC-225)" },
        { clave: "analisis.anomalias.mora_dias_umbral_media", valor: "15", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Días de mora para severidad MEDIA (SPEC-225)" },
    ];

    for (const p of analisisParams) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: {},
            create: p,
        });
    }
    console.log(`[SEED] ${analisisParams.length} parámetros analisis.* listos`);
}

// ── SPEC-225 (002-PI-126): parámetros del detector de anomalías + evento ──
// `analisis.anomalia.detectada` del Motor Notif (alerta inmediata al CEO, D-78).
// Las 3 claves `mora_dias_umbral_*`/`crecimiento_pct_umbral` ya las siembra
// SPEC-220; aquí van las 7 restantes. Idempotente: parámetros con `update: {}`
// (nunca pisan el tuning del admin); regla con upsertNotificacionRegla (patrón
// I-100 de SPEC-201 + SPEC-247); plantillas con upsert por clave.
async function seedAnomalias() {
    const params = [
        { clave: "analisis.anomalias.tick_min", valor: "60", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Minutos entre ticks del worker de anomalías (SPEC-225)" },
        { clave: "analisis.anomalias.uso_caido_pct_umbral", valor: "50", tipo: TipoParametro.FLOAT, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "% de caída de sesiones semanales que dispara USO_CAIDO_ABRUPTO (SPEC-225)" },
        { clave: "analisis.anomalias.caida_recaudo_pct_umbral", valor: "30", tipo: TipoParametro.FLOAT, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "% de caída del recaudo semanal por ciudad que dispara CAIDA_RECAUDO_CIUDAD (SPEC-225)" },
        { clave: "analisis.anomalias.cancelaciones_24h_umbral", valor: "5", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Cancelaciones en 24h que disparan CANCELACIONES_MASIVAS_24H (SPEC-225)" },
        { clave: "analisis.anomalias.colegio_grande_min_reportes", valor: "50", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Reportes históricos mínimos para considerar 'colegio grande' (SPEC-225)" },
        { clave: "analisis.anomalias.base_minima_comparacion", valor: "3", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Volumen mínimo de la semana de referencia para comparativas (SPEC-225)" },
        { clave: "analisis.anomalias.email_inmediato_habilitado", valor: "true", tipo: TipoParametro.BOOLEAN, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Kill-switch del email inmediato al CEO por anomalía ALTA (SPEC-225)" },
    ];
    for (const p of params) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: {},
            create: p,
        });
    }
    console.log(`[SEED] ${params.length} parámetros analisis.anomalias.* listos`);

    const evento = "analisis.anomalia.detectada";
    const plantillas = [
        {
            clave: `${evento}.email`,
            canal: "EMAIL" as const,
            asunto: "Anomalía crítica detectada: {{tipoAnomalia}}",
            cuerpoMarkdown:
                "Se detectó una anomalía de severidad {{severidad}} en la plataforma.\n\n" +
                "**Tipo:** {{tipoAnomalia}}\n" +
                "**Detectada:** {{fechaDeteccion}}\n\n" +
                "{{descripcion}}\n\n" +
                "Ver detalle: {{urlAnomalia}}",
        },
        {
            clave: `${evento}.in_app`,
            canal: "IN_APP" as const,
            asunto: null,
            cuerpoMarkdown: "Anomalía {{severidad}} detectada: {{tipoAnomalia}}. Detalle: {{urlAnomalia}}",
        },
    ];
    for (const pl of plantillas) {
        await prisma.notificacionPlantilla.upsert({
            where: { clave: pl.clave },
            update: {
                canal: pl.canal,
                asunto: pl.asunto,
                cuerpoMarkdown: pl.cuerpoMarkdown,
                variablesSchema: { type: "object", properties: {} },
                activa: true,
            },
            create: {
                clave: pl.clave,
                canal: pl.canal,
                asunto: pl.asunto,
                cuerpoMarkdown: pl.cuerpoMarkdown,
                variablesSchema: { type: "object", properties: {} },
                activa: true,
            },
        });
    }

    for (const canal of ["EMAIL", "IN_APP"] as const) {
        await upsertNotificacionRegla({
            evento,
            rol: "ADMIN",
            canal,
            plantillaClave: `${evento}.${canal.toLowerCase()}`,
            obligatoria: true,
            activa: true,
        });
    }
    console.log("[SEED] Evento analisis.anomalia.detectada (regla + plantillas) listo");
}

// ── SPEC-223 (002-PI-124): digest semanal al CEO — parámetros propios + evento
// `analisis.digest.semanal` del Motor Notif (reglas EMAIL/IN_APP + plantillas).
// `analisis.digest.dia_semana` y `analisis.digest.hora_bogota` ya los siembra
// SPEC-220 (seedParametrosAnalisis); aquí solo `enabled` y `destinatarios_emails`.
// Idempotente: parámetros con `update: {}` (nunca pisan el tuning del admin);
// plantillas con `update: {}` (respeta el editor de plantillas de SPEC-202,
// data-model §5); reglas create-if-missing (si el admin las desactiva, el seed
// no las reactiva — el digest es opt-out, D-70).
async function seedDigestSemanal() {
    const params = [
        { clave: "analisis.digest.enabled", valor: "true", tipo: TipoParametro.BOOLEAN, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Apaga/prende el job del digest semanal sin deploy (SPEC-223)" },
        { clave: "analisis.digest.destinatarios_emails", valor: "", tipo: TipoParametro.STRING, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Correos destinatarios del digest separados por coma; vacío = todos los ADMIN activos (SPEC-223)" },
    ];
    for (const p of params) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: {},
            create: p,
        });
    }
    console.log(`[SEED] ${params.length} parámetros analisis.digest.* listos (SPEC-223)`);

    const evento = "analisis.digest.semanal";
    const variablesSchema = {
        type: "object",
        properties: {
            periodo: { type: "string" },
            fechaInicio: { type: "string" },
            fechaFin: { type: "string" },
            top5Decisiones: { type: "string" },
            tablaKpis: { type: "string" },
            numAnomalias: { type: "string" },
            anomalias: { type: "string" },
            ganadoresPerdedores: { type: "string" },
            recomendacionesSistema: { type: "string" },
            enlacePanel: { type: "string" },
        },
    };
    const plantillas = [
        {
            // El motor envía email en TEXTO PLANO (enviarEmailNotificacion usa
            // solo `text:`): la plantilla es Markdown legible como texto; las
            // listas llegan pre-renderizadas en las variables (sin loops).
            clave: `${evento}.email`,
            canal: "EMAIL" as const,
            asunto: "Resumen semanal PI · {{periodo}} · Top 5 decisiones para esta semana",
            cuerpoMarkdown:
                "# Tu resumen semanal · {{fechaInicio}} – {{fechaFin}}\n\n" +
                "## Top 5 decisiones para esta semana\n" +
                "{{top5Decisiones}}\n\n" +
                "## KPIs de la semana\n" +
                "{{tablaKpis}}\n\n" +
                "## Anomalías detectadas ({{numAnomalias}})\n" +
                "{{anomalias}}\n\n" +
                "## Ganadores y perdedores\n" +
                "{{ganadoresPerdedores}}\n\n" +
                "## Recomendaciones del sistema\n" +
                "{{recomendacionesSistema}}\n\n" +
                "Abrir el panel completo: {{enlacePanel}}\n\n" +
                "Canales oficiales: Línea 141 ICBF · CAI Virtual · Te Protejo.\n" +
                "Puedes desactivar este resumen en tu perfil de notificaciones.",
        },
        {
            clave: `${evento}.in_app`,
            canal: "IN_APP" as const,
            asunto: null,
            cuerpoMarkdown:
                "Resumen semanal {{periodo}} ({{fechaInicio}} – {{fechaFin}}).\n\n" +
                "{{top5Decisiones}}\n\n" +
                "{{tablaKpis}}\n\n" +
                "Panel completo: {{enlacePanel}}",
        },
    ];
    for (const pl of plantillas) {
        await prisma.notificacionPlantilla.upsert({
            where: { clave: pl.clave },
            update: {},
            create: {
                clave: pl.clave,
                canal: pl.canal,
                asunto: pl.asunto,
                cuerpoMarkdown: pl.cuerpoMarkdown,
                variablesSchema,
                activa: true,
            },
        });
    }

    for (const canal of ["EMAIL", "IN_APP"] as const) {
        await upsertNotificacionRegla(
            {
                evento,
                rol: "ADMIN",
                canal,
                plantillaClave: `${evento}.${canal.toLowerCase()}`,
                obligatoria: false,
                activa: true,
            },
            { preservarExistente: true }
        );
    }
    console.log("[SEED] Evento analisis.digest.semanal (reglas + plantillas) listo (SPEC-223)");
}

// ── SPEC-221 (002-PI-122): parámetros y reglas semilla del motor de recomendación ──
// Idempotente: parámetros con `update: {}` (nunca pisan el tuning del admin);
// reglas con upsert por `clave` cuyo `update` solo toca campos descriptivos
// (`nombre`, `descripcion`, `plantillaRecomendacion`) — NUNCA `modo`, `activa`
// ni `sqlQuery` (respeta la promoción manual RECOMIENDA→EJECUTA y el tuning).
// `analisis.recomendaciones.frecuencia_evaluacion_min` ya la siembra SPEC-220.
async function seedReglasRecomendacion(adminEmail: string) {
    const params = [
        { clave: "analisis.recomendaciones.expiracion_dias", valor: "7", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Días hasta que una recomendación PENDIENTE expira (SPEC-221)" },
        { clave: "analisis.recomendaciones.statement_timeout_ms", valor: "5000", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Timeout del sandbox SQL por regla (SPEC-221)" },
    ];
    for (const p of params) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: {},
            create: p,
        });
    }

    const admin = await prisma.usuario.findUnique({ where: { email: adminEmail } });
    if (!admin) {
        console.log("[SEED] Reglas de recomendación omitidas: no existe admin inicial.");
        return;
    }

    for (const regla of REGLAS_SEMILLA) {
        await prisma.reglaRecomendacion.upsert({
            where: { clave: regla.clave },
            update: {
                nombre: regla.nombre,
                descripcion: regla.descripcion,
                plantillaRecomendacion: regla.plantillaRecomendacion,
            },
            create: {
                clave: regla.clave,
                nombre: regla.nombre,
                descripcion: regla.descripcion,
                categoria: regla.categoria,
                sqlQuery: regla.sqlQuery,
                plantillaRecomendacion: regla.plantillaRecomendacion,
                modo: "RECOMIENDA",
                accionEjecutable: regla.accionEjecutable ?? null,
                prioridad: regla.prioridad,
                umbralMinimo: regla.umbralMinimo ?? null,
                frecuenciaMin: regla.frecuenciaMin,
                activa: true,
                creadaPorAdminId: admin.id,
            },
        });
    }
    console.log(`[SEED] ${REGLAS_SEMILLA.length} reglas de recomendación listas (modo RECOMIENDA)`);
}

// ── SPEC-222 (002-PI-123): umbrales opcionales del panel Dinero vs Valor ──
// Idempotente: `update: {}` — el seed nunca pisa el tuning del admin. Los
// umbrales vacíos significan "corte por mediana del dataset" (FR-008).
async function seedParametrosPanelAnalisis() {
    const params = [
        { clave: "analisis.panel.umbral_monto_usd", valor: "", tipo: TipoParametro.FLOAT, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Corte fijo del eje X de cuadrantes (vacío = mediana del dataset)" },
        { clave: "analisis.panel.umbral_score", valor: "", tipo: TipoParametro.FLOAT, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Corte fijo del eje Y de cuadrantes (vacío = mediana del dataset)" },
        { clave: "analisis.panel.dispersion_max_puntos", valor: "500", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Límite de puntos de la dispersión antes de truncar (SPEC-222)" },
    ];
    for (const p of params) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: {},
            create: p,
        });
    }
    console.log(`[SEED] ${params.length} parámetros analisis.panel.* listos`);
}

// ── SPEC-213 (002-PI-113): parámetro del motor de vigencia de pagos ──
// Idempotente: `update: {}` — el seed nunca pisa la hora ajustada por el admin.
// `pagos.vigencia.ultima_corrida` NO se siembra: la escribe el worker.
async function seedParametrosVigenciaPagos() {
    await prisma.parametroSistema.upsert({
        where: { clave: "pagos.vigencia.hora_corrida" },
        update: {},
        create: {
            clave: "pagos.vigencia.hora_corrida",
            valor: "01:00",
            tipo: TipoParametro.STRING,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            esSecreto: false,
            descripcion: "Hora diaria (HH:mm, America/Bogota) de la corrida del worker de vigencia de pagos",
        },
    });
    console.log("[SEED] parámetro pagos.vigencia.hora_corrida listo");
}

// ── SPEC-218 (002-PI-118): TTL de la caché por widget de la analítica dinero-vs-valor ──
// Idempotente: `update: {}` — el seed nunca pisa el ajuste hecho por el admin.
async function seedParametrosAnaliticaPagos() {
    await prisma.parametroSistema.upsert({
        where: { clave: "pagos.analitica.cache_segundos" },
        update: {},
        create: {
            clave: "pagos.analitica.cache_segundos",
            valor: "60",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            esSecreto: false,
            descripcion: "TTL en segundos de la caché en memoria por widget del dashboard dinero-vs-valor",
        },
    });
    console.log("[SEED] parámetro pagos.analitica.cache_segundos listo");
}

// ── SPEC-227 (002-PI-128): parámetros del historial de recomendaciones ──
// Idempotente: `update: {}` — el seed nunca pisa el tuning hecho por el admin.
async function seedParametrosHistorialRecomendaciones() {
    const params = [
        { clave: "analisis.recomendaciones.tasa_ignorada_alerta_pct", valor: "70", tipo: TipoParametro.FLOAT, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Tasa de ignorada (%) sobre resueltas que marca la regla con \"revisar umbral\" en el historial (SPEC-227)" },
        { clave: "analisis.recomendaciones.export_max_filas", valor: "5000", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Tope de filas del export CSV del historial de recomendaciones; 413 si se excede (SPEC-227)" },
    ];
    for (const p of params) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: {},
            create: p,
        });
    }
    console.log("[SEED] 2 parámetros analisis.recomendaciones.* del historial listos (SPEC-227)");
}

// ── SPEC-224 (002-PI-125): parámetros del test SQL del panel de reglas ──
// Idempotente: `update: {}` — el seed nunca pisa el tuning hecho por el admin.
// El permiso de módulo `analisis_admin` para ADMIN lo cubre syncModulosYGrants
// (backfill del catálogo: ADMIN recibe todos los módulos).
async function seedParametrosReglasAdmin() {
    const params = [
        { clave: "analisis.reglas.test_timeout_ms", valor: "5000", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "statement_timeout (ms) del test SQL del panel de reglas; se aplica acotado 1000..30000 (SPEC-224)" },
        { clave: "analisis.reglas.test_max_filas", valor: "50", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Máximo de filas de la muestra del test SQL; se aplica acotado 1..200 (SPEC-224)" },
    ];
    for (const p of params) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: {},
            create: p,
        });
    }
    console.log("[SEED] 2 parámetros analisis.reglas.* del panel de reglas listos (SPEC-224)");
}

// ── SPEC-239 (002-PI-mega-cola): catálogo Motor Notif del evento
// `expediente.emergencia.activada` (FR-009/FR-011). Aditivo e idempotente
// (patrón I-100). Notas:
// - El parámetro `padre.comite.sla_horas_gravedad_roja = 12` YA lo siembra
//   SPEC-230 (seedParametrosPadre); no se duplica aquí.
// - Canal EMAIL únicamente: Motor Notif solo soporta EMAIL/IN_APP (no existe
//   canal SMS) y el contacto de emergencia no es un Usuario (sin IN_APP).
//   La notificación admin/CEO al subir a ROJO reutiliza la plantilla
//   `expediente.gravedad.subio_a_rojo` sembrada por SPEC-236.
async function seedEmergenciaExpediente() {
    const evento = "expediente.emergencia.activada";
    const plantillaClave = `${evento}.email`;
    const asunto = "Aviso urgente sobre un caso de protección";
    const cuerpoMarkdown =
        "Hola {{contactoNombre}},\n\n" +
        "Te contactamos como contacto de emergencia (relación: {{relacion}}, teléfono registrado: {{telefono}}) " +
        "registrado por {{padreNombre}}.\n\n" +
        "El comité de validación activó el protocolo de emergencia del caso {{expedienteNumero}}. " +
        "Por favor comunícate con la línea oficial de atención lo antes posible.\n\n" +
        "Este mensaje es un aviso de contacto; no contiene detalles del caso.";

    await prisma.notificacionPlantilla.upsert({
        where: { clave: plantillaClave },
        update: {
            canal: "EMAIL",
            asunto,
            cuerpoMarkdown,
            variablesSchema: {
                type: "object",
                properties: {
                    contactoNombre: { type: "string" },
                    relacion: { type: "string" },
                    telefono: { type: "string" },
                    expedienteNumero: { type: "string" },
                    padreNombre: { type: "string" },
                },
            },
            activa: true,
        },
        create: {
            clave: plantillaClave,
            canal: "EMAIL",
            asunto,
            cuerpoMarkdown,
            variablesSchema: {
                type: "object",
                properties: {
                    contactoNombre: { type: "string" },
                    relacion: { type: "string" },
                    telefono: { type: "string" },
                    expedienteNumero: { type: "string" },
                    padreNombre: { type: "string" },
                },
            },
            activa: true,
        },
    });

    await upsertNotificacionRegla({
        evento,
        rol: "CONTACTO_EMERGENCIA",
        canal: "EMAIL",
        plantillaClave,
        obligatoria: true,
        activa: true,
    });
    console.log("[SEED] Catálogo Motor Notif expediente.emergencia.activada listo (SPEC-239)");
}

// ── SPEC-226 (002-PI-mega-cola): parámetros del ejecutor de acciones automáticas
// (rate-limit por regla, scope `analisis_accion`) + catálogo Motor Notif de los
// eventos `analisis.alerta.admin` y `analisis.operador.asignacion` (FR-014).
// Idempotente: parámetros con `update: {}` (nunca pisan el tuning del admin);
// plantillas con upsert por clave; reglas con upsertNotificacionRegla (I-100 + SPEC-247).
async function seedEjecucionAcciones() {
    const params = [
        { clave: "ratelimit.analisis_accion.window_seconds", valor: "3600", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Ventana (s) del rate-limit por regla del ejecutor de acciones (SPEC-226)" },
        { clave: "ratelimit.analisis_accion.max_requests", valor: "20", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "Máx. ejecuciones de acciones por regla por ventana (SPEC-226)" },
        { clave: "analisis.acciones.alertas_destinatarios", valor: "[]", tipo: TipoParametro.JSON, categoria: CategoriaParametro.SYSTEM, esPublico: false, esSecreto: false, descripcion: "usuarioIds admin destinatarios de crear_alerta; vacío = todos los ADMIN activos (SPEC-226)" },
    ];
    for (const p of params) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: {},
            create: p,
        });
    }
    console.log(`[SEED] ${params.length} parámetros del ejecutor de acciones listos (SPEC-226)`);

    // Evento 1: alerta al admin (acción crear_alerta). Canal EMAIL obligatorio.
    const eventoAlerta = "analisis.alerta.admin";
    const variablesAlerta = {
        type: "object",
        properties: {
            severidad: { type: "string" },
            mensaje: { type: "string" },
            reglaClave: { type: "string" },
            urlPanel: { type: "string" },
        },
    };
    await prisma.notificacionPlantilla.upsert({
        where: { clave: `${eventoAlerta}.email` },
        update: {
            canal: "EMAIL",
            asunto: "Alerta {{severidad}} · {{reglaClave}}",
            cuerpoMarkdown:
                "Se generó una alerta automática de severidad {{severidad}}.\n\n" +
                "**Regla:** {{reglaClave}}\n\n" +
                "{{mensaje}}\n\n" +
                "Ver el panel de análisis: {{urlPanel}}",
            variablesSchema: variablesAlerta,
            activa: true,
        },
        create: {
            clave: `${eventoAlerta}.email`,
            canal: "EMAIL",
            asunto: "Alerta {{severidad}} · {{reglaClave}}",
            cuerpoMarkdown:
                "Se generó una alerta automática de severidad {{severidad}}.\n\n" +
                "**Regla:** {{reglaClave}}\n\n" +
                "{{mensaje}}\n\n" +
                "Ver el panel de análisis: {{urlPanel}}",
            variablesSchema: variablesAlerta,
            activa: true,
        },
    });
    await upsertNotificacionRegla({
        evento: eventoAlerta,
        rol: "ADMIN",
        canal: "EMAIL",
        plantillaClave: `${eventoAlerta}.email`,
        obligatoria: true,
        activa: true,
    });

    // Evento 2: asignación de una recomendación a un operador (acción asignar_operador).
    const eventoOperador = "analisis.operador.asignacion";
    const variablesOperador = {
        type: "object",
        properties: {
            tituloRecomendacion: { type: "string" },
            descripcionRecomendacion: { type: "string" },
            urlPanel: { type: "string" },
        },
    };
    const plantillasOperador = [
        {
            clave: `${eventoOperador}.email`,
            canal: "EMAIL" as const,
            asunto: "Caso asignado: {{tituloRecomendacion}}",
            cuerpoMarkdown:
                "Se te asignó un caso del panel de análisis.\n\n" +
                "**{{tituloRecomendacion}}**\n\n" +
                "{{descripcionRecomendacion}}\n\n" +
                "Abrir el panel: {{urlPanel}}",
        },
        {
            clave: `${eventoOperador}.in_app`,
            canal: "IN_APP" as const,
            asunto: null,
            cuerpoMarkdown: "Caso asignado: {{tituloRecomendacion}}. Panel: {{urlPanel}}",
        },
    ];
    for (const pl of plantillasOperador) {
        await prisma.notificacionPlantilla.upsert({
            where: { clave: pl.clave },
            update: {
                canal: pl.canal,
                asunto: pl.asunto,
                cuerpoMarkdown: pl.cuerpoMarkdown,
                variablesSchema: variablesOperador,
                activa: true,
            },
            create: {
                clave: pl.clave,
                canal: pl.canal,
                asunto: pl.asunto,
                cuerpoMarkdown: pl.cuerpoMarkdown,
                variablesSchema: variablesOperador,
                activa: true,
            },
        });
    }
    for (const canal of ["EMAIL", "IN_APP"] as const) {
        await upsertNotificacionRegla({
            evento: eventoOperador,
            rol: "OPERADOR",
            canal,
            plantillaClave: `${eventoOperador}.${canal.toLowerCase()}`,
            obligatoria: false,
            activa: true,
        });
    }
    console.log("[SEED] Eventos analisis.alerta.admin y analisis.operador.asignacion listos (SPEC-226)");
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
                        // SPEC-248 (002-PI-151): Ley 2564 de 2026 art. 6. Solo aplica en
                        // instalaciones nuevas (idempotente-respetuoso, `update: {}` abajo);
                        // si el CEO ya editó este parámetro en un ambiente vivo, esta
                        // agrupación NO se aplica ahí — ver plan.md Decisión 3.
                        clave: "acoso_digital",
                        nombre: "Acoso digital",
                        orden: 5,
                        categorias: ["CIBERACOSO", "HAPPY_SLAPPING", "STALKING"],
                    },
                    {
                        clave: "otro",
                        nombre: "Otro",
                        orden: 6,
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

    // SPEC-251 (002-PI-154 · I-49): frecuencia del guardián de índices en pi-monitor.
    // Patrón anti-I-100: update:{} para no pisar la configuración del CEO.
    await prisma.parametroSistema.upsert({
        where: { clave: "monitoreo.indices.frecuencia_horas" },
        create: {
            clave: "monitoreo.indices.frecuencia_horas",
            valor: "24",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Cada cuántas horas pi-monitor verifica los 5 índices críticos (SPEC-251 · I-49)",
        },
        update: {},
    });

    // SPEC-291 (002-PI-191): antigüedad máxima aceptada del tick-vida antes de marcar rojo.
    // Debe alinearse con el `< 90s` del healthcheck docker de los 7 workers.
    // Patrón anti-I-100: update:{} para no pisar la configuración del CEO.
    await prisma.parametroSistema.upsert({
        where: { clave: "monitoreo.tickVida.maxAntiguedadSeg" },
        create: {
            clave: "monitoreo.tickVida.maxAntiguedadSeg",
            valor: "90",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Segundos máximos aceptados desde el último tick-vida de un worker antes de marcar señal en rojo (SPEC-291)",
        },
        update: {},
    });

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

    // SPEC-264 (002-PI-164): SLA configurable para POSIBLE_SPAM.
    // update: {} — candado anti-I-100: nunca pisamos lo que el ADMIN haya editado en producción.
    await prisma.parametroSistema.upsert({
        where: { clave: "spam.sla_horas" },
        update: {},
        create: {
            clave: "spam.sla_horas",
            valor: "48",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Horas máximas para resolver un POSIBLE_SPAM antes de alertar al admin (revisarSlaSpam, monitor cada 15 min)",
        },
    });

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
        // SPEC-303 (002-PI-209): 3 umbrales adicionales del semáforo del listado admin (I-104).
        { clave: "analytics.colegios.casos_abiertos_alto", valor: "5", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Umbral: si un colegio supera este número de casos abiertos, el semáforo tira a rojo" },
        { clave: "analytics.colegios.casos_sin_movimiento_dias", valor: "14", tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Umbral: alertas del colegio sin cambio de estado en más de N días disparan hallazgo negativo" },
        { clave: "analytics.colegios.porcentaje_procesado_min", valor: "0.7", tipo: TipoParametro.FLOAT, categoria: CategoriaParametro.SYSTEM, esPublico: false, descripcion: "Umbral: si el porcentaje de reportes procesados cae bajo este ratio, el semáforo tira a amarillo/rojo (0.7 = 70%)" },
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

    // SPEC-244 (002-PI-147): eventos/plantillas del ciclo de vida de suscripción.
    await seedEventosSuscripcion();

    // SPEC-246 (002-PI-149): eventos/plantillas de cupones de recompensa.
    await seedEventosRecompensa();

    // SPEC-240 (002-PI-143): evento/plantilla de invitación al rector.
    await seedInvitacionColegio();

    // SPEC-319 (002-PI-219 §2.2): evento/plantilla de invitación de la cuenta del comité.
    await seedInvitacionComite();

    // SPEC-296 (002-PI-197 · cierra I-152): eventos + plantillas + reglas de los
    // 19 emails migrados desde src/lib/email.ts al motor de notificaciones.
    await seedEventosEmailMigrados();

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
        // SPEC-248 (002-PI-151): Ley 2564 de 2026 art. 6.
        ["CIBERACOSO", 60],
        ["HAPPY_SLAPPING", 75],
        ["STALKING", 70],
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

    // ── Definiciones legales de rúbrica (SPEC-248 / 002-PI-151) ────────────
    // Idempotente-respetuosa (`update: {}`): a diferencia de ia.rubrica.preguntas,
    // este parámetro SÍ se edita desde admin (ADMIN → RubricaTab) y esas ediciones
    // NO deben perderse en cada deploy. Solo se siembra si el parámetro aún no existe.
    await prisma.parametroSistema.upsert({
        where: { clave: "ia.rubrica.definiciones" },
        update: {},
        create: {
            clave: "ia.rubrica.definiciones",
            valor: JSON.stringify(DEFINICIONES_CATEGORIA),
            tipo: TipoParametro.JSON,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Fundamento legal (conducta, referencia normativa, texto literal) editable por categoría",
        },
    });
    console.log("Definiciones legales de rúbrica (spec 248) listas");

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

    // ── SPEC-201: parámetros del motor de notificaciones (BRIEF §5.6) ────────
    // AJUSTE OBLIGATORIO CEO (E): estos parámetros son estructurales del motor.
    // Cuando cambien de default entre versiones, el upsert debe usar update
    // explícito, no update: {}. Primer seed es INSERT limpio; versiones futuras
    // del seed propagan cambios de estructura con update: { valor, descripcion }.
    const notificacionesParams = [
        {
            clave: "notificaciones.worker.intervalo_segundos",
            valor: "10",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Intervalo entre polls del worker de notificaciones (segundos)",
        },
        {
            clave: "notificaciones.worker.max_intentos",
            valor: "4",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Máximo de intentos de envío de una notificación",
        },
        {
            clave: "notificaciones.worker.backoff_segundos",
            valor: "[60,300,1800,7200]",
            tipo: TipoParametro.STRING,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Backoff entre reintentos de envío en segundos (JSON array)",
        },
        {
            clave: "notificaciones.worker.lote_size",
            valor: "20",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Tamaño del lote de envío del worker de notificaciones",
        },
        {
            clave: "notificaciones.retencion_meses",
            valor: "24",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Meses de retención de notificaciones enviadas/canceladas",
        },
        {
            clave: "notificaciones.horario.silencio",
            valor: "20:00-07:00",
            tipo: TipoParametro.STRING,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: true,
            descripcion: "Ventana de silencio del motor de notificaciones (Bogotá, HH:MM-HH:MM)",
        },
        {
            clave: "notificaciones.bounces.umbral_bloqueo",
            valor: "3",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: false,
            descripcion: "Bounces acumulados para bloquear un destino de email",
        },
    ];
    for (const p of notificacionesParams) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: { valor: p.valor, descripcion: p.descripcion },
            create: p,
        });
    }
    console.log("Parámetros del motor de notificaciones (SPEC-201) creados");

    // ── SPEC-201: plantillas y reglas semilla del motor (BRIEF §5.2-§6) ──────
    // AJUSTE OBLIGATORIO CEO (E): el upsert de plantillas y reglas usa update
    // explícito para propagar cambios de estructura entre versiones (patrón I-100).
    type PlantillaSeed = {
        clave: string;
        canal: "EMAIL" | "IN_APP";
        asunto?: string;
        cuerpoMarkdown: string;
    };

    const plantillasSeed: PlantillaSeed[] = [
        // suscripcion.por_vencer
        {
            clave: "suscripcion.por_vencer.email",
            canal: "EMAIL",
            asunto: "Tu suscripción vence pronto",
            cuerpoMarkdown:
                "Hola {{nombre}},\n\nTu suscripción vence el {{fecha}}. Renueva a tiempo para no perder la protección activa.",
        },
        {
            clave: "suscripcion.por_vencer.in_app",
            canal: "IN_APP",
            cuerpoMarkdown: "Tu suscripción vence el {{fecha}}. Renueva a tiempo.",
        },
        // suscripcion.en_gracia
        {
            clave: "suscripcion.en_gracia.email",
            canal: "EMAIL",
            asunto: "Tu suscripción está en período de gracia",
            cuerpoMarkdown:
                "Hola {{nombre}},\n\nTu suscripción venció el {{fecha}}. Tienes un período de gracia para regularizar el pago.",
        },
        {
            clave: "suscripcion.en_gracia.in_app",
            canal: "IN_APP",
            cuerpoMarkdown: "Tu suscripción venció el {{fecha}}. Regulariza el pago durante el período de gracia.",
        },
        // suscripcion.cortada
        {
            clave: "suscripcion.cortada.email",
            canal: "EMAIL",
            asunto: "Tu suscripción ha sido suspendida",
            cuerpoMarkdown:
                "Hola {{nombre}},\n\nTu suscripción fue suspendida el {{fecha}}. Contacta soporte para reactivarla.",
        },
        {
            clave: "suscripcion.cortada.in_app",
            canal: "IN_APP",
            cuerpoMarkdown: "Tu suscripción fue suspendida el {{fecha}}. Contacta soporte.",
        },
        // reporte.circulo_confianza.aparece_menor
        {
            clave: "reporte.circulo_confianza.aparece_menor.email",
            canal: "EMAIL",
            asunto: "Novedad en tu Círculo de Confianza",
            cuerpoMarkdown:
                "Hola {{nombre}},\n\nApareció una nueva alerta relacionada con tu Círculo de Confianza. Ingresa al panel para revisarla.",
        },
        {
            clave: "reporte.circulo_confianza.aparece_menor.in_app",
            canal: "IN_APP",
            cuerpoMarkdown: "Nueva alerta en tu Círculo de Confianza. Revisa el panel.",
        },
        // reporte.resuelto
        {
            clave: "reporte.resuelto.email",
            canal: "EMAIL",
            asunto: "Tu reporte fue resuelto",
            cuerpoMarkdown:
                "Hola {{nombre}},\n\nTu reporte fue resuelto. Ingresa al panel para ver el resultado.",
        },
        {
            clave: "reporte.resuelto.in_app",
            canal: "IN_APP",
            cuerpoMarkdown: "Tu reporte fue resuelto. Revisa el panel.",
        },
        // caso.asignado
        {
            clave: "caso.asignado.email",
            canal: "EMAIL",
            asunto: "Se te asignó un caso",
            cuerpoMarkdown:
                "Hola {{nombre}},\n\nSe te asignó un caso para revisión. Ingresa al panel de administración.",
        },
        {
            clave: "caso.asignado.in_app",
            canal: "IN_APP",
            cuerpoMarkdown: "Se te asignó un caso. Revisa la bandeja.",
        },
        // admin.contacto_bloqueado (evento interno)
        {
            clave: "admin.contacto_bloqueado.email",
            canal: "EMAIL",
            asunto: "Destino de email bloqueado por bounces",
            cuerpoMarkdown:
                "El email {{email}} fue bloqueado tras {{bounceCount}} bounces (motivo: {{motivo}}).",
        },
        // SPEC-204: bienvenida al admin de un colegio nuevo (piloto migración motor)
        {
            clave: "colegio.bienvenida.email",
            canal: "EMAIL",
            asunto: "Tu cuenta institucional está lista",
            cuerpoMarkdown:
                "Hola {{nombreColegio}},\n\nSe creó la cuenta institucional de tu colegio en Protección Infantil.\n\nUsuario: {{emailAdmin}}\nContraseña temporal: {{passwordTemporal}}\n\nIngresa en {{urlLogin}} y cambia tu contraseña lo antes posible.\n\nEsta contraseña temporal no se volverá a mostrar.",
        },
        // ── SPEC-215: programa de referidos del módulo de pagos ──
        {
            clave: "referido.registrado.email",
            canal: "EMAIL",
            asunto: "Alguien usó tu código de referido",
            cuerpoMarkdown:
                "Hola {{nombre}},\n\nUn nuevo cliente registró tu código de referido {{codigoReferido}}. Cuando su primer pago sea autorizado, recibirás tu recompensa.",
        },
        {
            clave: "referido.registrado.in_app",
            canal: "IN_APP",
            cuerpoMarkdown: "Un nuevo cliente registró tu código de referido {{codigoReferido}}.",
        },
        {
            clave: "referido.recompensa.otorgada.email",
            canal: "EMAIL",
            asunto: "Tu recompensa por referido fue otorgada",
            cuerpoMarkdown:
                "Hola {{nombre}},\n\nEl primer pago de tu referido fue autorizado. Se otorgó 1 mes gratis a tu suscripción (código {{codigoReferido}}).",
        },
        {
            clave: "referido.recompensa.otorgada.in_app",
            canal: "IN_APP",
            cuerpoMarkdown: "Se otorgó 1 mes gratis a tu suscripción por tu referido (código {{codigoReferido}}).",
        },
        {
            clave: "referido.tope_anual.email",
            canal: "EMAIL",
            asunto: "Tu código de referido se acerca a su tope anual",
            cuerpoMarkdown:
                "Hola {{nombre}},\n\nTu código de referido {{codigoReferido}} ya tiene {{usosAnio}} referidos activados este año: uno más y llegas al tope anual.",
        },
        {
            clave: "referido.tope_anual.in_app",
            canal: "IN_APP",
            cuerpoMarkdown:
                "Tu código {{codigoReferido}} tiene {{usosAnio}} referidos activados este año: uno más y llegas al tope anual.",
        },
    ];

    for (const pl of plantillasSeed) {
        await prisma.notificacionPlantilla.upsert({
            where: { clave: pl.clave },
            update: {
                canal: pl.canal,
                asunto: pl.asunto ?? null,
                cuerpoMarkdown: pl.cuerpoMarkdown,
                variablesSchema: { type: "object", properties: {} },
                activa: true,
            },
            create: {
                clave: pl.clave,
                canal: pl.canal,
                asunto: pl.asunto ?? null,
                cuerpoMarkdown: pl.cuerpoMarkdown,
                variablesSchema: { type: "object", properties: {} },
                activa: true,
            },
        });
    }
    console.log("Plantillas del motor de notificaciones (SPEC-201) creadas");

    // SPEC-258 (002-PI-157): plantilla de onboarding que faltaba para colegio.creado.
    // La regla ya existía (seed SPEC-204, línea ~2990) pero apuntaba a una plantilla
    // inexistente → el email nunca se enviaba. Anti-I-100 (update:{}) porque el admin
    // puede editar el cuerpo desde /dashboard/admin/notificaciones después del deploy.
    // Variables reales que envía api/admin/colegios/route.ts:
    //   {{nombreColegio}}, {{emailAdmin}}, {{passwordTemporal}}, {{urlLogin}}
    await prisma.notificacionPlantilla.upsert({
        where: { clave: "colegio.creado.email" },
        update: {},
        create: {
            clave: "colegio.creado.email",
            canal: "EMAIL",
            asunto: "Tu cuenta institucional en Protección Infantil está lista",
            cuerpoMarkdown:
                "Hola {{nombreColegio}},\n\n" +
                "Se registró tu institución en Protección Infantil.\n\n" +
                "**Acceso inicial**\n" +
                "- Usuario: {{emailAdmin}}\n" +
                "- Contraseña temporal: {{passwordTemporal}}\n\n" +
                "Ingresa en {{urlLogin}} y cambia tu contraseña lo antes posible.\n\n" +
                "Si no solicitaste este registro, contáctanos de inmediato.",
            variablesSchema: {
                type: "object",
                properties: {
                    nombreColegio: { type: "string" },
                    emailAdmin: { type: "string" },
                    passwordTemporal: { type: "string" },
                    urlLogin: { type: "string" },
                },
            },
            activa: true,
        },
    });
    console.log("[SEED] Plantilla colegio.creado.email (SPEC-258) lista");

    type ReglaSeed = {
        evento: string;
        rol: string;
        offset: string;
        canal: "EMAIL" | "IN_APP";
        obligatoria: boolean;
    };

    const reglasSeed: ReglaSeed[] = [
        // suscripcion.por_vencer
        { evento: "suscripcion.por_vencer", rol: "SCHOOL_ADMIN", offset: "-5d", canal: "EMAIL", obligatoria: true },
        { evento: "suscripcion.por_vencer", rol: "SCHOOL_ADMIN", offset: "-5d", canal: "IN_APP", obligatoria: true },
        { evento: "suscripcion.por_vencer", rol: "PARENT", offset: "-1d", canal: "EMAIL", obligatoria: true },
        { evento: "suscripcion.por_vencer", rol: "PARENT", offset: "-1d", canal: "IN_APP", obligatoria: true },
        // suscripcion.en_gracia
        { evento: "suscripcion.en_gracia", rol: "SCHOOL_ADMIN", offset: "+2d", canal: "EMAIL", obligatoria: true },
        { evento: "suscripcion.en_gracia", rol: "SCHOOL_ADMIN", offset: "+2d", canal: "IN_APP", obligatoria: true },
        { evento: "suscripcion.en_gracia", rol: "PARENT", offset: "+2d", canal: "EMAIL", obligatoria: true },
        { evento: "suscripcion.en_gracia", rol: "PARENT", offset: "+2d", canal: "IN_APP", obligatoria: true },
        // suscripcion.cortada
        { evento: "suscripcion.cortada", rol: "SCHOOL_ADMIN", offset: "+3d", canal: "EMAIL", obligatoria: true },
        { evento: "suscripcion.cortada", rol: "SCHOOL_ADMIN", offset: "+3d", canal: "IN_APP", obligatoria: true },
        { evento: "suscripcion.cortada", rol: "PARENT", offset: "+3d", canal: "EMAIL", obligatoria: true },
        { evento: "suscripcion.cortada", rol: "PARENT", offset: "+3d", canal: "IN_APP", obligatoria: true },
        // reporte.circulo_confianza.aparece_menor
        { evento: "reporte.circulo_confianza.aparece_menor", rol: "PARENT", offset: "+0m", canal: "EMAIL", obligatoria: false },
        { evento: "reporte.circulo_confianza.aparece_menor", rol: "PARENT", offset: "+0m", canal: "IN_APP", obligatoria: false },
        // reporte.resuelto
        { evento: "reporte.resuelto", rol: "PARENT", offset: "+0m", canal: "EMAIL", obligatoria: false },
        { evento: "reporte.resuelto", rol: "PARENT", offset: "+0m", canal: "IN_APP", obligatoria: false },
        // caso.asignado
        { evento: "caso.asignado", rol: "COMITE_CONVIVENCIA", offset: "+0m", canal: "EMAIL", obligatoria: false },
        { evento: "caso.asignado", rol: "COMITE_CONVIVENCIA", offset: "+0m", canal: "IN_APP", obligatoria: false },
        { evento: "caso.asignado", rol: "OPERADOR", offset: "+0m", canal: "EMAIL", obligatoria: false },
        { evento: "caso.asignado", rol: "OPERADOR", offset: "+0m", canal: "IN_APP", obligatoria: false },
        { evento: "caso.asignado", rol: "COMITE_VALIDACION", offset: "+0m", canal: "EMAIL", obligatoria: false },
        { evento: "caso.asignado", rol: "COMITE_VALIDACION", offset: "+0m", canal: "IN_APP", obligatoria: false },
        // SPEC-204: bienvenida al admin de un colegio nuevo (piloto migración motor)
        { evento: "colegio.creado", rol: "SCHOOL_ADMIN", offset: "+0m", canal: "EMAIL", obligatoria: true },
        // ── SPEC-215: programa de referidos (titulares colegio/padre + aviso a admin) ──
        { evento: "referido.registrado", rol: "SCHOOL_ADMIN", offset: "+0m", canal: "EMAIL", obligatoria: false },
        { evento: "referido.registrado", rol: "SCHOOL_ADMIN", offset: "+0m", canal: "IN_APP", obligatoria: false },
        { evento: "referido.registrado", rol: "PARENT", offset: "+0m", canal: "EMAIL", obligatoria: false },
        { evento: "referido.registrado", rol: "PARENT", offset: "+0m", canal: "IN_APP", obligatoria: false },
        { evento: "referido.recompensa.otorgada", rol: "SCHOOL_ADMIN", offset: "+0m", canal: "EMAIL", obligatoria: true },
        { evento: "referido.recompensa.otorgada", rol: "SCHOOL_ADMIN", offset: "+0m", canal: "IN_APP", obligatoria: true },
        { evento: "referido.recompensa.otorgada", rol: "PARENT", offset: "+0m", canal: "EMAIL", obligatoria: true },
        { evento: "referido.recompensa.otorgada", rol: "PARENT", offset: "+0m", canal: "IN_APP", obligatoria: true },
        { evento: "referido.tope_anual", rol: "SCHOOL_ADMIN", offset: "+0m", canal: "EMAIL", obligatoria: false },
        { evento: "referido.tope_anual", rol: "PARENT", offset: "+0m", canal: "EMAIL", obligatoria: false },
        { evento: "referido.tope_anual", rol: "ADMIN", offset: "+0m", canal: "EMAIL", obligatoria: true },
    ];

    for (const r of reglasSeed) {
        const plantillaClave = `${r.evento}.${r.canal.toLowerCase()}`;
        await upsertNotificacionRegla({
            evento: r.evento,
            rol: r.rol,
            canal: r.canal,
            plantillaClave,
            offset: r.offset,
            obligatoria: r.obligatoria,
            activa: true,
        });
    }
    console.log("Reglas semilla del motor de notificaciones (SPEC-201) creadas");

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

    // SPEC-320 (§2.3): catálogo único de tipos de documento (norma colombiana).
    // Idempotente: upsert por clave, update:{} para no pisar ediciones del admin.
    // Las claves CC/CE unifican el vocabulario del comité (CEDULA_CIUDADANIA /
    // CEDULA_EXTRANJERIA) con el de estudiante. No preguntar a Jelkin qué sembrar.
    // Claves alineadas al vocabulario que ya usa el estudiante (RC/TI/CC/CE/PASAPORTE/
    // OTRO) para no migrar sus datos; CC/CE unifican el vocabulario del comité
    // (CEDULA_CIUDADANIA/CEDULA_EXTRANJERIA). PEP/NIT se agregan de la norma.
    const tiposDocumento = [
        { clave: "RC", nombre: "Registro civil" },
        { clave: "TI", nombre: "Tarjeta de identidad" },
        { clave: "CC", nombre: "Cédula de ciudadanía" },
        { clave: "CE", nombre: "Cédula de extranjería" },
        { clave: "PASAPORTE", nombre: "Pasaporte" },
        { clave: "PEP", nombre: "PEP / PPT" },
        { clave: "NIT", nombre: "NIT" },
        { clave: "OTRO", nombre: "Otro" },
    ];

    for (const td of tiposDocumento) {
        await prisma.tipoDocumento.upsert({
            where: { clave: td.clave },
            update: {},
            create: td,
        });
    }
    console.log("Tipos de documento (catálogo §2.3) creados");

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

    // ── Parámetros y evento de consentimiento informado (SPEC-241) ─────────
    await seedConsentimiento();

    // ── Parámetros de señal comunitaria (SPEC-234) ─────────────────────────
    await seedParametrosSenalComunitaria();

    // ── SPEC-220: parámetros del dominio Análisis (score, reglas, digest, anomalías) ──
    await seedParametrosAnalisis();

    // ── SPEC-225: parámetros del detector + evento/plantillas de anomalías ──
    await seedAnomalias();

    // ── SPEC-223: parámetros propios + evento/reglas/plantillas del digest ──
    await seedDigestSemanal();

    // ── SPEC-221: parámetros + 7 reglas semilla del motor de recomendación ──
    await seedReglasRecomendacion(adminEmail);

    // ── SPEC-222: umbrales opcionales del panel Dinero vs Valor ──
    await seedParametrosPanelAnalisis();

    // ── SPEC-213: hora de corrida del motor de vigencia de pagos ──
    await seedParametrosVigenciaPagos();

    // ── Guías de acción v1 (SPEC-235) ──────────────────────────────────────
    await seedGuiasAccion(adminEmail);

    // ── SPEC-236: parámetros + eventos/plantillas del motor de expediente ──
    await seedMotorExpediente();

    // ── SPEC-237: SLA de consolidación de la bandeja del comité ──
    await seedParametrosComiteConsolidacion();

    // ── SPEC-218: TTL de caché de la analítica dinero-vs-valor ──
    await seedParametrosAnaliticaPagos();

    // ── SPEC-227: parámetros del historial de recomendaciones ──
    await seedParametrosHistorialRecomendaciones();

    // ── SPEC-239: catálogo Motor Notif de expediente.emergencia.activada ──
    await seedEmergenciaExpediente();

    // ── SPEC-226: parámetros del ejecutor + eventos Motor Notif de acciones ──
    await seedEjecucionAcciones();

    // ── SPEC-224: parámetros del test SQL del panel de reglas ──
    await seedParametrosReglasAdmin();

    // Cerramos el cliente interno para no dejar conexiones/locks colgando entre
    // llamadas en tests (evita deadlocks con TRUNCATE de resetDatabase).
    await prisma.$disconnect();
    prismaInstance = null;
}

export { main, seedParametrosPadre, seedParametrosSenalComunitaria, seedConsentimiento, seedGuiasAccion, seedParametrosAnalisis, seedAnomalias, seedDigestSemanal, seedMotorExpediente, seedParametrosComiteConsolidacion, seedReglasRecomendacion, seedParametrosPanelAnalisis, seedParametrosHistorialRecomendaciones, seedEmergenciaExpediente, seedParametrosReglasAdmin, seedEjecucionAcciones, seedInvitacionColegio, seedInvitacionComite, seedEventosSuscripcion, seedEventosRecompensa };

// ── SPEC-244 (002-PI-147): catálogo Motor Notif del ciclo de vida de suscripción ──
// Idempotente: plantillas con upsert por clave; reglas con upsertNotificacionRegla
// por la clave @@unique([evento, canal, plantillaClave]) de SPEC-247.
async function seedEventosSuscripcion() {
    const variablesSchemaSolicitada = {
        type: "object",
        properties: {
            nombre: { type: "string" },
            email: { type: "string" },
            planNombre: { type: "string" },
            totalCOP: { type: "string" },
            suscripcionId: { type: "string" },
        },
    };
    const variablesSchemaActivada = {
        type: "object",
        properties: {
            nombre: { type: "string" },
            suscripcionId: { type: "string" },
            plan: { type: "string" },
            monto: { type: "number" },
            fechaInicio: { type: "string" },
            fechaFin: { type: "string" },
        },
    };

    const plantillas = [
        {
            clave: "suscripcion.solicitada.in_app",
            canal: "IN_APP" as const,
            asunto: null,
            cuerpoMarkdown: "Nueva solicitud de suscripción: {{planNombre}} por {{nombre}} ({{email}}). Total: ${{totalCOP}}.",
            variablesSchema: variablesSchemaSolicitada,
        },
        {
            clave: "suscripcion.solicitada.email",
            canal: "EMAIL" as const,
            asunto: "Solicitud de suscripción recibida · {{planNombre}}",
            cuerpoMarkdown:
                "Hola {{nombre}},\n\n" +
                "Recibimos tu solicitud de suscripción al plan **{{planNombre}}**.\n\n" +
                "Total estimado: ${{totalCOP}} COP.\n\n" +
                "Un administrador revisará y autorizará tu pago. Te avisaremos por este medio.",
            variablesSchema: variablesSchemaSolicitada,
        },
        {
            clave: "suscripcion.solicitada.email.colegio",
            canal: "EMAIL" as const,
            asunto: "Solicitud de suscripción recibida · {{planNombre}}",
            cuerpoMarkdown:
                "Hola {{nombre}},\n\n" +
                "Recibimos la solicitud de suscripción institucional al plan **{{planNombre}}**.\n\n" +
                "Total estimado: ${{totalCOP}} COP.\n\n" +
                "Un administrador revisará y autorizará el pago. Te avisaremos por este medio.",
            variablesSchema: variablesSchemaSolicitada,
        },
        {
            clave: "suscripcion.activada.in_app",
            canal: "IN_APP" as const,
            asunto: null,
            cuerpoMarkdown: "Tu suscripción al plan {{plan}} está activa ({{fechaInicio}} – {{fechaFin}}).",
            variablesSchema: variablesSchemaActivada,
        },
        {
            clave: "suscripcion.activada.email",
            canal: "EMAIL" as const,
            asunto: "Tu suscripción está activa · {{plan}}",
            cuerpoMarkdown:
                "Hola {{nombre}},\n\n" +
                "Tu suscripción al plan **{{plan}}** está activa.\n\n" +
                "Inicia: {{fechaInicio}}\n" +
                "Finaliza: {{fechaFin}}\n" +
                "Monto pagado: ${{monto}} COP.\n\n" +
                "Gracias por confiar en Protección Infantil.",
            variablesSchema: variablesSchemaActivada,
        },
        {
            clave: "suscripcion.activada.email.colegio",
            canal: "EMAIL" as const,
            asunto: "Suscripción activada para tu colegio · {{plan}}",
            cuerpoMarkdown:
                "Hola {{nombre}},\n\n" +
                "La suscripción institucional al plan **{{plan}}** está activa.\n\n" +
                "Inicia: {{fechaInicio}}\n" +
                "Finaliza: {{fechaFin}}\n" +
                "Monto pagado: ${{monto}} COP.\n\n" +
                "Gracias por confiar en Protección Infantil.",
            variablesSchema: variablesSchemaActivada,
        },
    ];

    for (const pl of plantillas) {
        await prisma.notificacionPlantilla.upsert({
            where: { clave: pl.clave },
            update: {
                canal: pl.canal,
                asunto: pl.asunto,
                cuerpoMarkdown: pl.cuerpoMarkdown,
                variablesSchema: pl.variablesSchema,
                activa: true,
            },
            create: {
                clave: pl.clave,
                canal: pl.canal,
                asunto: pl.asunto,
                cuerpoMarkdown: pl.cuerpoMarkdown,
                variablesSchema: pl.variablesSchema,
                activa: true,
            },
        });
    }

    const reglas: Array<{
        evento: string;
        rol: string;
        canal: "EMAIL" | "IN_APP";
        plantillaClave: string;
        obligatoria: boolean;
    }> = [
        { evento: "suscripcion.solicitada", rol: "ADMIN", canal: "IN_APP", plantillaClave: "suscripcion.solicitada.in_app", obligatoria: false },
        { evento: "suscripcion.solicitada", rol: "PARENT", canal: "EMAIL", plantillaClave: "suscripcion.solicitada.email", obligatoria: true },
        { evento: "suscripcion.solicitada", rol: "SCHOOL_ADMIN", canal: "EMAIL", plantillaClave: "suscripcion.solicitada.email.colegio", obligatoria: true },
        { evento: "suscripcion.activada", rol: "PARENT", canal: "IN_APP", plantillaClave: "suscripcion.activada.in_app", obligatoria: false },
        { evento: "suscripcion.activada", rol: "PARENT", canal: "EMAIL", plantillaClave: "suscripcion.activada.email", obligatoria: true },
        { evento: "suscripcion.activada", rol: "SCHOOL_ADMIN", canal: "IN_APP", plantillaClave: "suscripcion.activada.in_app", obligatoria: false },
        { evento: "suscripcion.activada", rol: "SCHOOL_ADMIN", canal: "EMAIL", plantillaClave: "suscripcion.activada.email.colegio", obligatoria: true },
    ];

    for (const regla of reglas) {
        await upsertNotificacionRegla({
            evento: regla.evento,
            rol: regla.rol,
            canal: regla.canal,
            plantillaClave: regla.plantillaClave,
            obligatoria: regla.obligatoria,
            activa: true,
        });
    }
    console.log("[SEED] Catálogo Motor Notif suscripcion.solicitada/activada listo (SPEC-244)");
}

// ── SPEC-246 (002-PI-149): catálogo Motor Notif de cupones de recompensa ──
async function seedEventosRecompensa() {
    const variablesSchema = {
        type: "object",
        properties: {
            nombre: { type: "string" },
            codigos: { type: "string" },
            porcentaje: { type: "number" },
            vigenciaHasta: { type: "string" },
        },
    };

    const plantillas = [
        {
            clave: "bono.entregado_recompensa.email",
            canal: "EMAIL" as const,
            asunto: "Tus cupones de recompensa llegaron 🎁",
            cuerpoMarkdown:
                "Hola {{nombre}},\n\n" +
                "Gracias por tu suscripción. Recibiste estos cupones de descuento para compartir:\n\n" +
                "{{codigos}}\n\n" +
                "Cada uno aplica un {{porcentaje}}% de descuento y es válido hasta {{vigenciaHasta}}.",
            variablesSchema,
        },
        {
            clave: "bono.entregado_recompensa.in_app",
            canal: "IN_APP" as const,
            asunto: null,
            cuerpoMarkdown: "Recibiste cupones de recompensa: {{codigos}}. Válidos hasta {{vigenciaHasta}}.",
            variablesSchema,
        },
    ];

    for (const pl of plantillas) {
        await prisma.notificacionPlantilla.upsert({
            where: { clave: pl.clave },
            update: {
                canal: pl.canal,
                asunto: pl.asunto,
                cuerpoMarkdown: pl.cuerpoMarkdown,
                variablesSchema: pl.variablesSchema,
                activa: true,
            },
            create: {
                clave: pl.clave,
                canal: pl.canal,
                asunto: pl.asunto,
                cuerpoMarkdown: pl.cuerpoMarkdown,
                variablesSchema: pl.variablesSchema,
                activa: true,
            },
        });
    }

    const reglas: Array<{
        evento: string;
        rol: string;
        canal: "EMAIL" | "IN_APP";
        plantillaClave: string;
        obligatoria: boolean;
    }> = [
        { evento: "bono.entregado_recompensa", rol: "PARENT", canal: "EMAIL", plantillaClave: "bono.entregado_recompensa.email", obligatoria: true },
        { evento: "bono.entregado_recompensa", rol: "PARENT", canal: "IN_APP", plantillaClave: "bono.entregado_recompensa.in_app", obligatoria: false },
    ];

    for (const regla of reglas) {
        await upsertNotificacionRegla({
            evento: regla.evento,
            rol: regla.rol,
            canal: regla.canal,
            plantillaClave: regla.plantillaClave,
            obligatoria: regla.obligatoria,
            activa: true,
        });
    }
    console.log("[SEED] Catálogo Motor Notif bono.entregado_recompensa listo (SPEC-246)");
}

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