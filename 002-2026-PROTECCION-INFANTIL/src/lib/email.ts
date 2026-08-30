/**
 * SPEC-296 (002-PI-197 · cierra I-152): thin wrappers del Motor de Notificaciones.
 *
 * Cada función pública de este archivo pasa a llamar `programar()` del motor con
 * el evento y variables correspondientes. Las plantillas + reglas viven en el
 * seed (`seedEventosEmailMigrados` en `prisma/seed.ts`) — si falta una regla,
 * `programar()` retorna `{programadas:0}` con warning; el test de cobertura
 * (`src/lib/email.migracion.test.ts`) protege contra ese hueco.
 *
 * La única función que hace envío REAL de email (Resend directo) es
 * `enviarEmailNotificacion`, movida a `src/lib/notificaciones/enviar-email.ts`
 * porque el propio motor la usa internamente (worker `worker-notificaciones.mjs`).
 *
 * Las 16 firmas exportadas de este archivo se conservan idénticas: los 15+
 * callsites externos no cambian.
 */
import { prisma } from "./prisma.ts";
import { getParametroSistema } from "./parametros.ts";
import { programar } from "./notificaciones/motor.ts";
import { renderizarEmailReporteCirculo } from "./notificaciones/plantillas/reporte-circulo.ts";
import type { FilaDeriva } from "./motor/deriva.ts";

async function getAdminEmails(): Promise<string[]> {
    const admins = await prisma.usuario.findMany({
        where: { rol: "ADMIN", estado: "activo" },
        select: { email: true },
    });
    return admins.map((a) => a.email);
}

async function alertasHabilitadas(clave: string): Promise<boolean> {
    const param = await getParametroSistema(clave);
    return param ? param.valor === "true" : true;
}

function baseUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005";
}

export async function enviarCodigoVerificacion(email: string, codigo: string): Promise<void> {
    const result = await programar({
        evento: "auth.codigo_verificacion",
        destinatarios: [{ email, variables: { codigo } }],
    });
    // SPEC-296: fail-closed si el motor no encuentra reglas (0 filas encoladas).
    // BL-3 (auth): en prod la ruta cae en catch y responde 202 con emailSent=false
    // (sin devCode); en dev/CI la misma ruta expone devCode para el journey.
    // En prod real siempre habrá regla activa (verificado por email.migracion.test.ts).
    if (result.programadas === 0) {
        throw new Error("Sin reglas activas para auth.codigo_verificacion");
    }
}

export async function enviarTokenRecuperacion(email: string, token: string): Promise<void> {
    const url = `${baseUrl()}/recuperar/${token}`;
    const result = await programar({
        evento: "auth.password_recuperacion",
        destinatarios: [{ email, variables: { url } }],
    });
    if (result.programadas === 0) {
        throw new Error("Sin reglas activas para auth.password_recuperacion");
    }
}

export async function enviarEmailBienvenidaOperador(email: string, tempPassword: string): Promise<void> {
    await programar({
        evento: "usuario.bienvenida.operador",
        destinatarios: [{ email, variables: { email, tempPassword, urlLogin: `${baseUrl()}/login` } }],
    });
}

export async function enviarEmailBienvenidaComite(email: string, tempPassword: string): Promise<void> {
    await programar({
        evento: "usuario.bienvenida.comite",
        destinatarios: [{ email, variables: { email, tempPassword, urlLogin: `${baseUrl()}/login` } }],
    });
}

/**
 * 002-PI-051 (B3) — Credenciales de un padre enviadas por el admin (alta o
 * restablecimiento). Mismo patrón que el colegio: la temporal solo viaja por
 * email; si el envío falla, la ruta la muestra una sola vez al admin.
 */
export async function enviarEmailCredencialesPadre(email: string, tempPassword: string): Promise<void> {
    await programar({
        evento: "usuario.credenciales.padre",
        destinatarios: [{ email, variables: { email, tempPassword, urlLogin: `${baseUrl()}/login` } }],
    });
}

export async function enviarAlertaComitePendientes(email: string, cantidad: number): Promise<void> {
    await programar({
        evento: "comite.pendientes.alerta",
        destinatarios: [
            {
                email,
                variables: {
                    cantidad,
                    plural: cantidad === 1 ? "caso" : "casos",
                    urlBandeja: `${baseUrl()}/dashboard/admin/comite`,
                },
            },
        ],
    });
}

/**
 * SPEC-110 — Aviso de plazo de apelaciones al comité de validación.
 * Digest diario: un solo email por miembro del comité con los casos sin resolver que
 * ya superaron apelacion.aviso_previo_dias días hábiles. Sin contenido sensible: solo
 * el número del caso y los días hábiles transcurridos.
 */
export async function enviarAvisoPlazoApelaciones(
    email: string,
    casos: { numero: string; diasHabiles: number }[]
): Promise<void> {
    const lineas = casos
        .map((c) => `- ${c.numero}: ${c.diasHabiles} días hábiles sin resolver`)
        .join("\n");
    await programar({
        evento: "comite.apelaciones.plazo",
        destinatarios: [
            {
                email,
                variables: {
                    cantidad: casos.length,
                    plural: casos.length === 1 ? "apelación" : "apelaciones",
                    pluralVencer: casos.length === 1 ? "próxima a vencer" : "próximas a vencer",
                    lineas,
                    urlBandeja: `${baseUrl()}/dashboard/admin/comite/apelaciones`,
                },
            },
        ],
    });
}

export async function enviarAlertaRevision(reporte: {
    id: string;
    numeroSeguimiento: string | null;
    identificador: string;
    estado: string;
    prioridadAlta?: boolean;
}): Promise<void> {
    if (!(await alertasHabilitadas("alerts.admin.enabled"))) return;

    const admins = await getAdminEmails();
    if (admins.length === 0) return;

    const prioridadTag = reporte.prioridadAlta ? " [PRIORIDAD ALTA]" : "";
    const notaPrioridad = reporte.prioridadAlta ? "\n\nMarcado como prioridad alta." : "";

    await programar({
        evento: "reporte.revision.requerida",
        sujetoTipo: "Reporte",
        sujetoId: reporte.id,
        destinatarios: admins.map((email) => ({
            email,
            variables: {
                numeroSeguimiento: reporte.numeroSeguimiento ?? reporte.id,
                identificador: reporte.identificador,
                estado: reporte.estado,
                prioridadTag,
                notaPrioridad,
                urlPanel: `${baseUrl()}/dashboard/admin`,
            },
        })),
    });
}

export async function enviarAlertaScoreCritico(reporte: {
    id: string;
    identificador: string;
    plataformaId: string;
    score: number;
    nivelRiesgo: string;
}): Promise<void> {
    if (!(await alertasHabilitadas("alerts.critical_score.enabled"))) return;

    const admins = await getAdminEmails();
    if (admins.length === 0) return;

    const plataforma = await prisma.plataforma.findUnique({
        where: { id: reporte.plataformaId },
        select: { nombre: true },
    });

    await programar({
        evento: "reporte.score_critico",
        sujetoTipo: "Reporte",
        sujetoId: reporte.id,
        destinatarios: admins.map((email) => ({
            email,
            variables: {
                identificador: reporte.identificador,
                plataforma: plataforma?.nombre ?? reporte.plataformaId,
                score: reporte.score,
                nivelRiesgo: reporte.nivelRiesgo,
                urlPanel: `${baseUrl()}/dashboard/admin`,
            },
        })),
    });
}

export async function enviarAlertaCirculoConfianza(email: string, cantidad: number): Promise<void> {
    const novedadTexto = cantidad === 1 ? "1 novedad" : `${cantidad} novedades`;
    await programar({
        evento: "padre.circulo_confianza.pendientes",
        destinatarios: [
            {
                email,
                variables: {
                    novedadTexto,
                    urlPanel: `${baseUrl()}/dashboard/circulo-confianza`,
                },
            },
        ],
    });
}

/**
 * SPEC-308 (A-50): alerta enriquecida del Círculo de Confianza con contexto real
 * (contacto, identificador, plataforma, categoría, total reportes, link al
 * expediente). El renderizado vive en `reporte-circulo.ts`; aquí solo se coordina
 * con `programar()` del motor. Fail-closed si no hay reglas activas.
 */
export async function enviarAlertaCirculoConfianzaEnriquecida(payload: {
    destinatario: { usuarioId?: string; email?: string };
    reporteId: string;
    nombreContacto: string;
    identificador: string;
    plataforma: string;
    categoria: string;
    totalReportes: number;
    expedienteId?: string | null;
}): Promise<void> {
    if (!(await alertasHabilitadas("circulo.notificaciones.enabled"))) return;

    const urlExpediente = payload.expedienteId
        ? `${baseUrl()}/dashboard/padre/expedientes/${payload.expedienteId}`
        : `${baseUrl()}/dashboard/circulo-confianza`;

    const { asunto, cuerpo } = renderizarEmailReporteCirculo({
        nombreContacto: payload.nombreContacto,
        identificador: payload.identificador,
        plataforma: payload.plataforma,
        categoria: payload.categoria,
        totalReportes: payload.totalReportes,
        urlExpediente,
    });

    const totalReportes =
        Number.isFinite(payload.totalReportes) && payload.totalReportes >= 0
            ? Math.floor(payload.totalReportes)
            : 0;

    const result = await programar({
        evento: "padre.circulo_confianza.reporte_enriquecido",
        sujetoTipo: "Reporte",
        sujetoId: payload.reporteId,
        destinatarios: [
            {
                ...payload.destinatario,
                variables: {
                    asunto,
                    cuerpo,
                    nombreContacto: payload.nombreContacto,
                    identificador: payload.identificador,
                    plataforma: payload.plataforma,
                    categoria: payload.categoria,
                    totalReportes,
                    textoReportes: totalReportes === 1 ? "1 reporte registrado" : `${totalReportes} reportes registrados`,
                    urlExpediente,
                    urlPanel: `${baseUrl()}/dashboard/circulo-confianza`,
                },
            },
        ],
    });

    if (result.programadas === 0) {
        throw new Error("Sin reglas activas para padre.circulo_confianza.reporte_enriquecido");
    }
}

/**
 * SPEC-149 (FR-006) — Avisos del colegio. Copy ciego humano en español con la
 * terminología §3 ("aviso"/"te avisamos", jamás "notificación"). CERO PII:
 * nunca texto del reporte, identificadores, nombres de estudiantes ni scores
 * (I-28/I-29) — el detalle se revisa en el panel.
 */
export async function enviarAvisoReporteNuevoColegio(email: string): Promise<void> {
    await programar({
        evento: "colegio.reporte_nuevo",
        destinatarios: [
            {
                email,
                variables: { urlAlertas: `${baseUrl()}/dashboard/colegio/alertas` },
            },
        ],
    });
}

export async function enviarAvisoUmbralCursoColegio(
    email: string,
    params: { reportes: number; dias: number }
): Promise<void> {
    await programar({
        evento: "colegio.curso.umbral",
        destinatarios: [
            {
                email,
                variables: {
                    reportes: params.reportes,
                    dias: params.dias,
                    urlPanel: `${baseUrl()}/dashboard/colegio`,
                },
            },
        ],
    });
}

export async function enviarAvisoEstudianteRepetidoColegio(
    email: string,
    params: { reportes: number; dias: number }
): Promise<void> {
    await programar({
        evento: "colegio.estudiante.repetido",
        destinatarios: [
            {
                email,
                variables: {
                    reportes: params.reportes,
                    dias: params.dias,
                    urlAlertas: `${baseUrl()}/dashboard/colegio/alertas`,
                },
            },
        ],
    });
}

/**
 * Resumen del lunes (§4.0.1: la calma se muestra como trabajo). En semana sin
 * actividad el copy es positivo. Solo conteos agregados; cero PII.
 */
export async function enviarResumenSemanalColegio(
    email: string,
    params: { reportesSemana: number; teEsperan: number; pendientesDigest: number }
): Promise<void> {
    const { reportesSemana, teEsperan, pendientesDigest } = params;
    const semanaTranquila = reportesSemana === 0 && teEsperan === 0 && pendientesDigest === 0;

    const lineas: string[] = [];
    if (semanaTranquila) {
        lineas.push("Semana tranquila: no llegaron reportes nuevos sobre tu colegio y la vigilancia siguió activa todos los días.");
    } else {
        lineas.push(
            reportesSemana === 1
                ? "Esta semana llegó 1 reporte nuevo sobre tu colegio."
                : `Esta semana llegaron ${reportesSemana} reportes nuevos sobre tu colegio.`
        );
        if (teEsperan > 0) {
            lineas.push(teEsperan === 1 ? "Hay 1 reporte que te espera para revisar." : `Hay ${teEsperan} reportes que te esperan para revisar.`);
        }
        if (pendientesDigest > 0) {
            lineas.push(
                pendientesDigest === 1
                    ? "Además, 1 aviso quedó guardado para este resumen."
                    : `Además, ${pendientesDigest} avisos quedaron guardados para este resumen.`
            );
        }
    }

    await programar({
        evento: "colegio.resumen_semanal",
        destinatarios: [
            {
                email,
                variables: {
                    cuerpo: lineas.join("\n"),
                    urlPanel: `${baseUrl()}/dashboard/colegio`,
                },
            },
        ],
    });
}

export async function enviarAlertaColegio(email: string, cantidad: number): Promise<void> {
    const novedadTexto = cantidad === 1 ? "1 novedad" : `${cantidad} novedades`;
    await programar({
        evento: "colegio.alerta.pendientes",
        destinatarios: [
            {
                email,
                variables: {
                    novedadTexto,
                    urlAlertas: `${baseUrl()}/dashboard/colegio/alertas`,
                },
            },
        ],
    });
}

const COOLDOWN_ALERTA_MS = 24 * 60 * 60 * 1000;

export async function enviarAlertasSuscriptores(payload: {
    identificador: string;
    plataformaId: string;
    totalReportes: number;
}): Promise<void> {
    if (!(await alertasHabilitadas("alerts.subscriptions.enabled"))) return;

    const ahora = new Date();
    const ventana = new Date(ahora.getTime() - COOLDOWN_ALERTA_MS);

    const suscripciones = await prisma.alertaSuscripcion.findMany({
        where: {
            identificador: payload.identificador,
            plataformaId: payload.plataformaId,
            activa: true,
            OR: [{ ultimoEmailEn: { lt: ventana } }, { ultimoEmailEn: null }],
        },
        include: { usuario: { select: { email: true } }, plataforma: { select: { nombre: true } } },
    });

    if (suscripciones.length === 0) return;

    // S-2 (002-PI-052): el email a suscriptores NUNCA lleva el identificador
    // (ni en el asunto ni en URLs — la consulta es por POST, spec 091) ni la
    // palabra "score" (presunción de inocencia, §1.3). El identificador solo
    // se usa para la query de suscripciones, nunca sale del servidor.
    await programar({
        evento: "suscriptores.reporte_publicado",
        destinatarios: suscripciones.map((s) => ({
            email: s.usuario.email,
            variables: {
                plataforma: s.plataforma.nombre,
                totalReportes: payload.totalReportes,
                urlHome: `${baseUrl()}/`,
            },
        })),
    });

    // Se marca `ultimoEmailEn` optimistamente para todas: el motor decide
    // el envío real (respetando reglas + preferencias); el cooldown de 24h
    // se aplica igual en el próximo tick.
    await prisma.alertaSuscripcion.updateMany({
        where: { id: { in: suscripciones.map((s) => s.id) } },
        data: { ultimoEmailEn: ahora },
    });
}

/**
 * SPEC-171 (Pilar B, I-51) — Alerta de infraestructura en rojo. Texto plano,
 * cero datos de reportes: solo la señal, desde cuándo y el detalle técnico.
 * El throttle y la lista de destinatarios los resuelve el caller.
 */
export async function enviarAlertaInfra(params: {
    senal: string;
    inicio: Date;
    detalle?: string | null;
    destinatarios: string[];
}): Promise<void> {
    const { senal, inicio, detalle, destinatarios } = params;
    await programar({
        evento: "infra.alerta",
        destinatarios: destinatarios.map((email) => ({
            email,
            variables: {
                senal,
                inicio: inicio.toISOString(),
                detalle: detalle ?? "",
            },
        })),
    });
}

/**
 * SPEC-184 (002-PI-079) — Alerta de abuso por rate-limit. Mismo patrón
 * throttled que SPEC-171, pero la señal describe un posible ataque desde una
 * IP (hash) contra un scope.
 */
export async function enviarAlertaRateLimit(params: {
    senal: string;
    inicio: Date;
    detalle?: string | null;
    destinatarios: string[];
}): Promise<void> {
    const { senal, inicio, detalle, destinatarios } = params;
    await programar({
        evento: "infra.rate_limit",
        destinatarios: destinatarios.map((email) => ({
            email,
            variables: {
                senal,
                inicio: inicio.toISOString(),
                detalle: detalle ?? "",
            },
        })),
    });
}

/**
 * SPEC-296 (002-PI-197): re-export desde el nuevo lugar canónico
 * (`src/lib/notificaciones/enviar-email.ts`) para preservar los imports
 * externos que siguen apuntando a `@/lib/email` durante la migración.
 * El único envío directo por Resend vive en el motor; este archivo no lo hace.
 */
export { enviarEmailNotificacion } from "./notificaciones/enviar-email.ts";

/**
 * SPEC-172 (Pilar D.5) — Aviso semanal de deriva del motor en producción.
 * A diferencia de las demás enviar*: NO lanza si Resend falla — el snapshot ya
 * quedó persistido; aquí solo se registra el error.
 */
export async function enviarAlertaDerivaMotor(params: {
    destinatarios: string[];
    filas: FilaDeriva[];
    desde: Date;
    hasta: Date;
}): Promise<void> {
    const { destinatarios, filas, desde, hasta } = params;
    const sobreUmbral = filas.filter((f) => f.alertada).length;

    const filaTexto = (f: FilaDeriva): string => {
        const tasa = (f.tasaCorreccion * 100).toFixed(1);
        const banco = f.accuracyBanco !== null ? (f.accuracyBanco * 100).toFixed(1) : "s/d";
        const brecha = f.brechaPp !== null ? f.brechaPp.toFixed(1) : "s/d";
        const nota = f.muestraInsuficiente ? "  (muestra insuficiente)" : "";
        return `${f.categoria} | ${f.total} | ${f.correcciones} | ${tasa}% | ${banco}% | ${brecha} pp${nota}`;
    };

    const cuerpo = [
        "Deriva del motor de clasificación en producción: tasa de corrección humana confirmada sobre lo revisado,",
        "comparada con el error del banco curado (brecha en puntos porcentuales).",
        `Semana medida: ${desde.toISOString().slice(0, 10)} a ${hasta.toISOString().slice(0, 10)} (America/Bogota).`,
        "",
        "categoria | total | correcciones | tasa% | banco% | brecha pp",
        ...filas.map(filaTexto),
        "",
        "Afina la rúbrica en Simulación: /dashboard/admin/ia?tab=simulacion",
    ].join("\n");

    await programar({
        evento: "motor.deriva.alerta",
        destinatarios: destinatarios.map((email) => ({
            email,
            variables: {
                categorias: filas.length,
                sobreUmbral,
                cuerpo,
            },
        })),
    });
}
