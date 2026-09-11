/**
 * SPEC-657 (I-389) · cadencia del barrido de citas.
 *
 * Los barredores de `worker.ts` (aviso 48h + plazo de pago) corren cada 15 min
 * por defecto (decisión CEO: los plazos no son al minuto, pero un padre que ya
 * pagó y esperó 48 h no debe esperar una hora más para enterarse, y la franja
 * liberada rápido es otro profesional que la toma). La cadencia se SIEMBRA como
 * `ParametroSistema` `cita.barrido.cron`, así que se ajusta sin desplegar.
 *
 * Un valor mal tipeado NO debe tumbar el worker: cae al default. NO comparte el
 * parámetro con ningún otro reloj (atar dos dominios al mismo parámetro mueve
 * uno al mover el otro — lección de SPEC-449).
 */
export const CLAVE_CRON_BARRIDO_CITAS = "cita.barrido.cron";
export const CRON_BARRIDO_CITAS_DEFAULT = "*/15 * * * *";

/** Cron de 5 campos con caracteres válidos (dígitos, `* , - /`). No pretende
 *  validar rangos semánticos: pg-boss rechaza lo imposible; acá evitamos pasar
 *  basura y garantizamos un fallback vivo. */
export function cronBarridoCitas(valor: string | null | undefined): string {
    if (typeof valor !== "string") return CRON_BARRIDO_CITAS_DEFAULT;
    const v = valor.trim();
    const campos = v.split(/\s+/);
    if (campos.length !== 5) return CRON_BARRIDO_CITAS_DEFAULT;
    if (!campos.every((c) => /^[0-9*,\-/]+$/.test(c))) return CRON_BARRIDO_CITAS_DEFAULT;
    return v;
}
