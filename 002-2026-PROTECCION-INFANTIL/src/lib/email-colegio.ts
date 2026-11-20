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
import { ColegioRepository } from "./dal/repositories/colegio";

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
 * SPEC-955 · correo FUSIONADO del colegio = bienvenida + recibo de aceptación.
 * Lo dispara la PRIMERA aceptación de la Política del rector (FORMA-ONBOARDING-
 * COLEGIO-CORREOS §A, Gestión 399ddc0a). Reemplaza a la vieja «bienvenida al
 * crear la contraseña» (SPEC-344), que salía ANTES de aceptar.
 *
 * - Voz usted; botón «Entrar a mi panel» → /dashboard (en este momento el rector
 *   YA está autenticado, por eso va al panel y no a un login).
 * - La constancia [NORMA] (versión + fecha) viaja en el cuerpo; la autoritativa
 *   es el AuditConsentimiento que el servicio ya escribió (no el correo).
 * - VENTANA pre-2.ª-ola: la plantilla VIVA sigue siendo la de SPEC-922 (usa
 *   {{urlLogin}}). Se manda `urlLogin = urlPanel` para que el botón NO salga roto
 *   hasta que el corrector de la 2.ª ola aplique el cuerpo fusionado canónico
 *   (FORMA A.3.4). El renderer deja vacío todo {{var}} ausente → sin este alias
 *   el botón vivo quedaría con href vacío en la ventana.
 */
export async function enviarBienvenidaRectorFusionada(params: {
    usuarioId: string;
    colegioId: string | null;
    version: string;
    fechaAceptacion: string;
}): Promise<void> {
    const colegio = params.colegioId ? await new ColegioRepository().obtenerResumen(params.colegioId) : null;
    const nombreColegio = colegio?.nombre ?? "su colegio";
    const urlPanel = `${baseUrl()}/dashboard`;

    const result = await programar({
        evento: "colegio.bienvenida_rector",
        sujetoTipo: "usuario",
        sujetoId: params.usuarioId,
        destinatarios: [
            {
                usuarioId: params.usuarioId,
                variables: {
                    nombreColegio,
                    version: params.version,
                    fechaAceptacion: params.fechaAceptacion,
                    urlPanel,
                    urlLogin: urlPanel, // alias de ventana pre-2.ª-ola (ver doc arriba)
                },
            },
        ],
    });
    if (result.programadas === 0) {
        throw new Error("Sin reglas activas para colegio.bienvenida_rector");
    }
}
