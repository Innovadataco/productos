/**
 * SPEC-391 (A-75 · L1b) — los correos del registro del profesional.
 *
 * Mismo patrón que `email-padre.ts` (SPEC-339): un enlace para crear la clave y
 * un correo de bienvenida cuando la cuenta queda creada. La bienvenida además
 * dirige al profesional a completar su perfil y subir la autorización — sin ese
 * paso su cuenta queda en `BORRADOR` y no llega a la cola de IDC.
 */
import { programar } from "./notificaciones/motor";
import { baseUrl } from "./email";

export async function enviarEnlaceRegistroProfesional(email: string, token: string): Promise<void> {
    const url = `${baseUrl()}/registro-profesional/crear-clave/${token}`;
    const result = await programar({
        evento: "auth.registro_enlace_profesional",
        destinatarios: [{ email, variables: { url } }],
    });
    if (result.programadas === 0) {
        throw new Error("Sin reglas activas para auth.registro_enlace_profesional");
    }
}

export async function enviarBienvenidaProfesional(email: string): Promise<void> {
    const result = await programar({
        evento: "auth.bienvenida_profesional",
        destinatarios: [
            {
                email,
                variables: {
                    urlLogin: `${baseUrl()}/login`,
                    urlCompletarPerfil: `${baseUrl()}/perfil-profesional/completar`,
                },
            },
        ],
    });
    if (result.programadas === 0) {
        throw new Error("Sin reglas activas para auth.bienvenida_profesional");
    }
}
