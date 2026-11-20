/**
 * SPEC-344 (A-69 · C1) — los correos del camino guiado del colegio.
 *
 * Espejo temático de `email-padre.ts`: el registro por enlace y la bienvenida
 * del rector viven en su propio módulo para respetar el corte por dominio.
 * `email.ts` los re-exporta cuando se importan desde el motor de notificaciones.
 *
 * Voz: `usted` formal Colombia (brief §0). Cero voseo, cero alarma, cero rojo.
 */
import { programar } from "./notificaciones/motor.ts";
import { baseUrl } from "./email";
import { prisma } from "./prisma";
import { logger } from "./logger";
import { safeErrorMessage } from "./errors";

/**
 * SPEC-344 · caso "correo Y NIT nuevos": enlace para crear la clave del rector.
 * El correo del enlace propiamente dicho.
 */
export async function enviarEnlaceRegistroColegio(
    email: string,
    token: string,
    nombreColegio: string,
): Promise<void> {
    const url = `${baseUrl()}/registro-colegio/crear-clave/${token}`;
    const result = await programar({
        evento: "colegio.registro_enlace",
        destinatarios: [{ email, variables: { url, nombreColegio } }],
    });
    if (result.programadas === 0) {
        throw new Error("Sin reglas activas para colegio.registro_enlace");
    }
}

/**
 * SPEC-344 · caso "el correo YA tiene cuenta": aviso al buzón registrado,
 * sin confirmar existencia en pantalla (anti-enumeración por correo — SPEC-338).
 */
export async function enviarCuentaExistenteColegio(
    email: string,
    nombreColegio: string,
): Promise<void> {
    const result = await programar({
        evento: "colegio.registro_enlace.cuenta_existente",
        destinatarios: [
            {
                email,
                variables: {
                    nombreColegio,
                    urlRecuperar: `${baseUrl()}/recuperar`,
                    urlLogin: `${baseUrl()}/login`,
                },
            },
        ],
    });
    if (result.programadas === 0) {
        throw new Error("Sin reglas activas para colegio.registro_enlace.cuenta_existente");
    }
}

/**
 * SPEC-344 · caso "el NIT YA está registrado (con otro correo)": aviso al
 * buzón del colegio dueño del NIT, sin confirmar existencia en pantalla
 * (anti-enumeración por NIT — matiz CEO 03:18).
 */
export async function enviarNitYaRegistradoColegio(
    email: string,
    nit: string,
): Promise<void> {
    const result = await programar({
        evento: "colegio.registro_enlace.nit_ya_registrado",
        destinatarios: [
            {
                email,
                variables: {
                    nit,
                    urlSoporte: "mailto:gerencia@innovadataco.com",
                },
            },
        ],
    });
    if (result.programadas === 0) {
        throw new Error("Sin reglas activas para colegio.registro_enlace.nit_ya_registrado");
    }
}

/**
 * SPEC-380 (PR A · C4) — El comité recomienda al rector emitir el informe del
 * caso. Se llama SIEMPRE con el `usuarioId` del rector para que el motor
 * (SPEC-201) le respete sus preferencias por canal (in-app / correo) y las
 * quiet hours. Correo va SOLO si sus reglas lo permiten. El caller debe
 * envolver esta llamada en try/catch — un fallo no debe romper la acción de
 * recomendar (regla dura CEO: aviso vs. acción de negocio).
 */
export async function enviarRecomendacionInformeAlRector(
    rectores: Array<{ id: string; email: string }>,
    variables: { nombreColegio: string; numeroCaso: string; solicitudId: string },
): Promise<void> {
    if (rectores.length === 0) return;
    const urlCaso = `${baseUrl()}/dashboard/colegio/comite/casos/${variables.solicitudId}`;
    await programar({
        evento: "colegio.comite.recomendacion_informe",
        sujetoTipo: "SolicitudComite",
        sujetoId: variables.solicitudId,
        destinatarios: rectores.map((r) => ({
            usuarioId: r.id,
            email: r.email,
            variables: {
                nombreColegio: variables.nombreColegio,
                numeroCaso: variables.numeroCaso,
                urlCaso,
            },
        })),
    });
}

/**
 * SPEC-344 · confirmación de cuenta creada, tras completar el enlace.
 */
export async function enviarBienvenidaRector(email: string, nombreColegio: string): Promise<void> {
    const result = await programar({
        evento: "colegio.bienvenida_rector",
        destinatarios: [
            {
                email,
                variables: {
                    nombreColegio,
                    urlLogin: `${baseUrl()}/login`,
                },
            },
        ],
    });
    if (result.programadas === 0) {
        throw new Error("Sin reglas activas para colegio.bienvenida_rector");
    }
}

/**
 * SPEC-955 · Dispara la bienvenida del rector SOLO tras su PRIMERA aceptación de
 * consentimiento (cuenta de colegio recién creada). Antes se enviaba al CREAR la
 * contraseña (registro-colegio/completar), antes de que el rector aceptara la
 * Política; Jelkin la quiere DESPUÉS del clic en «Acepto».
 *
 * El flujo de aceptar (ConsentimientoService/aceptar) es genérico para TODOS los
 * titulares, así que este acote vive acá, en el borde:
 *  - SOLO SCHOOL_ADMIN (no mandar «cuenta del colegio lista» a un padre que acepta
 *    la política).
 *  - SOLO la PRIMERA aceptación: exactamente una AuditConsentimiento (la que el
 *    aceptar que acaba de correr creó). 0 = aún no aceptó; >1 = re-aceptación o
 *    bump de versión → NO reenvía.
 *
 * Best-effort (cortesía): nunca lanza — un fallo no debe tumbar la aceptación.
 * Debe invocarse DESPUÉS de persistir la aceptación y NUNCA en el camino
 * idempotente (versión ya vigente), para no contar una fila preexistente como «1».
 */
export async function enviarBienvenidaRectorSiPrimeraAceptacion(usuario: {
    id: string;
    rol: string;
    email: string;
    colegioId: string | null;
}): Promise<void> {
    if (usuario.rol !== "SCHOOL_ADMIN") return;
    try {
        const aceptaciones = await prisma.auditConsentimiento.count({ where: { usuarioId: usuario.id } });
        if (aceptaciones !== 1) return;

        const colegio = usuario.colegioId
            ? await prisma.colegio.findUnique({ where: { id: usuario.colegioId }, select: { nombre: true } })
            : null;
        await enviarBienvenidaRector(usuario.email, colegio?.nombre ?? "su colegio");
    } catch (err) {
        logger.error(
            `[BIENVENIDA-COL] envío tras 1.ª aceptación fallido — usuario=${usuario.id}: ${safeErrorMessage(err)}`,
        );
    }
}
