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
