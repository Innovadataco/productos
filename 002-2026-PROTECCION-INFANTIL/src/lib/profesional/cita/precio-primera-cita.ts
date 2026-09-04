/**
 * SPEC-428 (A-75 · brief §9 M4 §4) · Lector puro del precio estándar de la
 * primera cita del padre con un profesional.
 *
 * Regla: **la primera cita se paga al precio estándar** definido por el admin
 * (parámetro `profesional.cita.precio_estandar_primera_cita_cop`). La tarifa
 * que declara el profesional aplica desde la 2ª cita en adelante y se muestra
 * en su perfil como informativa. Sin este parámetro no hay precio válido para
 * cobrar — el reader tira antes de crear la solicitud.
 */
import { getParametroSistemaValor, type ParametroClient } from "@/lib/parametros";
import { AppError, ERROR_CODES } from "@/lib/errors";

const CLAVE = "profesional.cita.precio_estandar_primera_cita_cop";

export async function leerPrecioEstandarPrimeraCita(client?: ParametroClient): Promise<number> {
    const raw = await getParametroSistemaValor(CLAVE, client);
    if (!raw) {
        throw new AppError(
            `Parámetro '${CLAVE}' ausente — el admin debe fijarlo antes de cobrar la primera cita`,
            ERROR_CODES.INTERNAL_ERROR,
            500,
        );
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
        throw new AppError(
            `Parámetro '${CLAVE}' inválido: '${raw}' — debe ser entero positivo (COP)`,
            ERROR_CODES.INTERNAL_ERROR,
            500,
        );
    }
    return Math.round(n);
}
