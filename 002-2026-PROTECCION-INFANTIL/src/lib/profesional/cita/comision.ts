/**
 * SPEC-403 (I-288 · brief A-75 §4) · La comisión de la red es un PARÁMETRO.
 *
 * Historia corta de este archivo, porque explica su forma:
 *
 *  1. El porcentaje vivía como `const PORCENTAJE_SERVICIO_DEFAULT = 15` **dentro
 *     de** `api/padre/citas/route.ts`, invisible para cualquier otro consumidor.
 *  2. SPEC-425 lo sacó acá porque el panel del profesional tiene que mostrar
 *     exactamente lo que se cobra, y dos copias del número es la forma más
 *     barata de que un día digan cosas distintas.
 *  3. SPEC-403 lo saca también del código: el número correcto es **10 %** y
 *     Jelkin lo cambia sin desplegar. Vive en `ParametroSistema`
 *     `comision.porcentaje`, sembrado idempotente y editable desde admin.
 *
 * **Falla en cerrado si el parámetro no está.** Es dinero: cobrar un porcentaje
 * inventado porque el seed no corrió es peor que no dejar crear la solicitud.
 * Mismo criterio que `verificacion.requisitos` y que SPEC-418, aprobado por el
 * CEO. El seed lo garantiza y `deploy-prod.sh` corre el seed.
 */
import { getParametroSistemaValor, type ParametroClient } from "@/lib/parametros";
import { AppError, ERROR_CODES } from "@/lib/errors";

/** La clave del parámetro. Única fuente del nombre — nadie la escribe a mano. */
export const CLAVE_COMISION = "comision.porcentaje";

export interface DesgloseTarifa {
    /** Lo que el profesional fijó en su perfil. */
    tarifaProfesional: number;
    /** Lo que sale del bolsillo del padre. */
    pagaElPadre: number;
    /** Lo que se queda la red. */
    servicioRed: number;
    porcentajeServicio: number;
}

/**
 * El porcentaje vigente. Lo lee de `ParametroSistema` en cada llamada: el admin
 * lo cambia y la próxima solicitud ya cobra distinto, sin desplegar.
 *
 * Una `SolicitudCita` ya creada **conserva el suyo** en `porcentajeServicio`:
 * cambiar el parámetro no reescribe lo que ya se cobró.
 */
export async function obtenerPorcentajeServicio(client?: ParametroClient): Promise<number> {
    const crudo = await getParametroSistemaValor(CLAVE_COMISION, client);
    if (crudo === null) {
        throw new AppError(
            `[${CLAVE_COMISION}] parámetro ausente — corré el seed (\`npm run db:seed\`) o creá la fila en admin. ` +
            "No se cobra con un porcentaje inventado.",
            ERROR_CODES.INTERNAL_ERROR,
            500,
        );
    }
    const valor = Number.parseInt(crudo, 10);
    if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
        throw new AppError(
            `[${CLAVE_COMISION}] valor inválido: "${crudo}". Debe ser un entero entre 0 y 100.`,
            ERROR_CODES.INTERNAL_ERROR,
            500,
        );
    }
    return valor;
}

/**
 * Mismo cálculo que `cita.service.ts` (`round(consulta * pct / 100)`), para que
 * la pantalla no prometa un número y el cobro haga otro.
 */
export function desglosarTarifa(tarifaProfesional: number, porcentajeServicio: number): DesgloseTarifa {
    const servicioRed = Math.round((tarifaProfesional * porcentajeServicio) / 100);
    return {
        tarifaProfesional,
        pagaElPadre: tarifaProfesional + servicioRed,
        servicioRed,
        porcentajeServicio,
    };
}
