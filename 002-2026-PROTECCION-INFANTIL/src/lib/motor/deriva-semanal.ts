/**
 * SPEC-172 (Pilar D.5) — Job semanal de deriva del motor (lunes 07:00
 * America/Bogota, cola pg-boss "motor-deriva-semanal"). Módulo importable para
 * que scripts/worker-reportes.mjs quede delgado y la lógica sea testeable.
 *
 * Mide la semana operativa anterior (lunes-domingo), persiste el snapshot y
 * avisa por email solo si hay categorías sobre el umbral (o si
 * motor.deriva.email.siempre=true) y hay destinatarios configurados.
 */
import { calcularDeriva, leerParametrosDeriva, semanaAnteriorBogota } from "./deriva";
import { enviarAlertaDerivaMotor } from "../email";
import { logger } from "../logger";

export interface ResultadoDerivaSemanal {
    ejecutada: boolean;
    motivo?: string;
    categorias?: number;
    alertadas?: number;
    emailEnviado?: boolean;
}

export async function ejecutarDerivaSemanal(): Promise<ResultadoDerivaSemanal> {
    const params = await leerParametrosDeriva();
    if (!params.enabled) {
        logger.info("[MotorDeriva] Job semanal: omitido — motor.deriva.enabled=false");
        return { ejecutada: false, motivo: "deshabilitada" };
    }

    const { desde, hasta, semanaInicio } = semanaAnteriorBogota();
    const filas = await calcularDeriva(desde, hasta, semanaInicio);
    const alertadas = filas.filter((f) => f.alertada);

    // Sin alertas el correo solo sale si email.siempre=true; sin destinatarios
    // configurados nunca se envía (el snapshot queda igualmente persistido).
    const debeEnviar =
        params.destinatarios.length > 0 && (alertadas.length > 0 || (params.emailSiempre && filas.length > 0));
    let emailEnviado = false;
    if (debeEnviar) {
        const filasEmail = alertadas.length > 0 ? alertadas : filas;
        await enviarAlertaDerivaMotor({ destinatarios: params.destinatarios, filas: filasEmail, desde, hasta });
        emailEnviado = true;
    }

    logger.info(
        `[MotorDeriva] Job semanal: ok — ${filas.length} categorías, ${alertadas.length} sobre el umbral, email=${emailEnviado}`
    );
    return { ejecutada: true, categorias: filas.length, alertadas: alertadas.length, emailEnviado };
}
