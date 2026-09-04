/**
 * SPEC-425 (A-75 · L5) · El desglose de la tarifa, en un solo lugar.
 *
 * Antes el porcentaje vivía como `const PORCENTAJE_SERVICIO_DEFAULT = 15`
 * dentro de `api/padre/citas/route.ts`, invisible para cualquier otro
 * consumidor. El panel del profesional necesita mostrarle **exactamente** lo
 * que se le va a cobrar, y dos copias del número es la forma más barata de
 * que un día digan cosas distintas.
 *
 * ⚠️ **El mockup aprobado dibuja «Servicio de la red (10%)» y el producto cobra
 * 15%.** Se usa el del producto, que es el que el padre paga de verdad;
 * la diferencia quedó reportada al CEO — es decisión de negocio, no de código.
 */

/**
 * Porcentaje que la red cobra sobre la tarifa del profesional. Es el que
 * aplica `api/padre/citas` al crear la solicitud.
 *
 * Cada `SolicitudCita` guarda el suyo en `porcentajeServicio`: una solicitud
 * ya creada conserva el porcentaje con el que se cobró aunque este cambie.
 * Por eso el panel prefiere el de la última solicitud del profesional y solo
 * cae a esta constante cuando todavía no tiene ninguna.
 */
export const PORCENTAJE_SERVICIO_DEFAULT = 15;

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
 * Mismo cálculo que `cita.service.ts:93` (`round(consulta * pct / 100)`), para
 * que la pantalla no prometa un número y el cobro haga otro.
 */
export function desglosarTarifa(
    tarifaProfesional: number,
    porcentajeServicio: number = PORCENTAJE_SERVICIO_DEFAULT,
): DesgloseTarifa {
    const servicioRed = Math.round((tarifaProfesional * porcentajeServicio) / 100);
    return {
        tarifaProfesional,
        pagaElPadre: tarifaProfesional + servicioRed,
        servicioRed,
        porcentajeServicio,
    };
}
