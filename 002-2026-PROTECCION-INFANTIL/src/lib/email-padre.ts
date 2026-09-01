/**
 * SPEC-339 (A-67) — los correos del camino guiado del padre.
 *
 * Separados de `email.ts` cuando ese adaptador tocó el techo de 500 líneas
 * (max-lines): corte temático — estas tres piezas nacieron juntas en A-67 y
 * comparten la voz del brief §3 (tuteo neutro, cero alarma).
 *
 * `email.ts` los re-exporta: los consumidores no cambian, y la cadena del
 * worker (SPEC-197) sigue entrando por el mismo módulo de siempre.
 */
import { programar } from "./notificaciones/motor.ts";
import { alertasHabilitadas, baseUrl } from "./email";

/**
 * SPEC-339 (A-67 §2.1): el enlace de registro del padre. Reemplaza al código de
 * 6 dígitos SOLO para el padre — el registro de colegio sigue con el código.
 * Jelkin: "padres adultos que de pronto no son muy cercanos a la tecnología";
 * un enlace que se abre pide menos que un código que se transcribe.
 */
export async function enviarEnlaceRegistro(email: string, token: string): Promise<void> {
    const url = `${baseUrl()}/registro/crear-clave/${token}`;
    const result = await programar({
        evento: "auth.registro_enlace",
        destinatarios: [{ email, variables: { url } }],
    });
    if (result.programadas === 0) {
        throw new Error("Sin reglas activas para auth.registro_enlace");
    }
}

/**
 * SPEC-339 (A-67 §2.1): confirmación de que la cuenta del padre quedó creada.
 */
export async function enviarBienvenidaPadre(email: string): Promise<void> {
    const result = await programar({
        evento: "auth.bienvenida_padre",
        destinatarios: [{ email, variables: { urlLogin: `${baseUrl()}/login` } }],
    });
    if (result.programadas === 0) {
        throw new Error("Sin reglas activas para auth.bienvenida_padre");
    }
}

/**
 * SPEC-339 (A-67 · punto 4 Calidad): aviso al padre cuando una cuenta de SU
 * hijo aparece en un reporte visible. Presentación propia — al padre no se le
 * habla igual de «Carlos · tío» que de su hijo. Gate por parámetro compartido
 * del mecanismo de monitoreo (circulo.notificaciones.enabled: un solo apagador
 * global de emergencia), interruptor y enfriamiento POR PADRE aparte.
 */
export async function enviarAlertaHijoReporte(payload: {
    destinatario: { usuarioId?: string; email?: string };
    reporteId: string;
    nombreHijo: string;
    identificador: string;
    plataforma: string | null;
}): Promise<void> {
    if (!(await alertasHabilitadas("circulo.notificaciones.enabled"))) return;
    const result = await programar({
        evento: "padre.hijo.reporte",
        sujetoTipo: "Reporte",
        sujetoId: payload.reporteId,
        destinatarios: [
            {
                ...payload.destinatario,
                variables: {
                    nombreHijo: payload.nombreHijo,
                    identificador: payload.identificador,
                    plataformaTexto: payload.plataforma ? ` en ${payload.plataforma}` : "",
                    urlPanel: `${baseUrl()}/dashboard/padre/hijos`,
                },
            },
        ],
    });
    if (result.programadas === 0) {
        throw new Error("Sin reglas activas para padre.hijo.reporte");
    }
}
