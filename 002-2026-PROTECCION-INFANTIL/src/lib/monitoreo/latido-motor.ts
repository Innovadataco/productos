/**
 * SPEC-670 / I-396 — Latido del MOTOR de clasificación (no del worker).
 *
 * El hueco que cierra: la franja del rector decía «revisado hace un momento»
 * mientras el motor (Ollama) estaba caído, porque su fuente era el LATIDO DEL
 * WORKER (`worker.heartbeat`) — que late aunque cada job falle. Un pulso que
 * responde «¿el worker respira?», no «¿el sistema clasificó?». El 11-09 el
 * worker latía y Ollama estaba caído: la pantalla mintió frescura.
 *
 * La señal HONESTA ya la produce el vigilante, de forma ACTIVA:
 *  · `senalesConIncidentesAbiertos()` → si hay un IncidenteInfra ABIERTO de
 *    `ollama_ping` / `ollama_smoke` / `tailscale`, el motor NO está clasificando
 *    (doble-rojo confirmado por el monitor). El estado lo dispara el probe, no
 *    la antigüedad.
 *  · `ultimoProbeExitosoDe("ollama_smoke")` → última verificación ACTIVA exitosa:
 *    para `ollama_smoke` incluye el piggyback (una clasificación real) y el smoke
 *    real (una generación real). Es el dato honesto detrás de un «última
 *    clasificación: hace X»; NUNCA el latido del worker ni un «hace un momento» fijo.
 *
 * Frescura: aunque no haya incidente abierto, un último éxito demasiado viejo
 * (p. ej. el monitor entero se detuvo → no abre incidentes ni registra probes)
 * NO puede leerse como «vivo». Por eso `motorVivo` exige un éxito reciente,
 * dentro de `monitoreo.motor.frescura_seg` (default 1h; parametrizable — sembrar
 * la fila para tunearla desde el panel es un seguimiento).
 *
 * Este módulo NO lee `worker-heartbeat` a propósito: esa es exactamente la
 * fuente equivocada. El candado lo vigila estructural y conductualmente.
 */
import { MonitoreoRepository } from "../dal/repositories/monitoreo.ts";
import { getParametroSistema } from "../parametros.ts";

/**
 * Señales del vigilante que prueban que el MOTOR funciona de verdad (no solo
 * que el worker respira). Un incidente abierto de cualquiera de ellas = motor
 * caído.
 */
export const SENALES_MOTOR = ["ollama_ping", "ollama_smoke", "tailscale"] as const;

/** Fuente de la última verificación ACTIVA exitosa (piggyback o smoke real). */
export const SENAL_ULTIMA_VERIFICACION = "ollama_smoke";

const FRESCURA_DEFECTO_SEG = 3600;

export interface LatidoMotor {
    /**
     * El motor VERIFICÓ que clasifica: sin incidente abierto de las señales del
     * motor Y con una verificación activa exitosa reciente. No mira el latido
     * del worker.
     */
    motorVivo: boolean;
    /**
     * Cuándo se verificó por última vez de forma ACTIVA (último `ollama_smoke`
     * verde: piggyback o smoke real). `null` si nunca — y entonces NO se muestra
     * reloj: mejor sin dato que con un dato inventado.
     */
    ultimaVerificacionEn: Date | null;
}

export async function leerLatidoMotor(
    repo: MonitoreoRepository = new MonitoreoRepository(),
    ahora: number = Date.now(),
): Promise<LatidoMotor> {
    const [senalesEnRojo, ultimoExito, frescuraParam] = await Promise.all([
        repo.senalesConIncidentesAbiertos(),
        repo.ultimoProbeExitosoDe(SENAL_ULTIMA_VERIFICACION),
        getParametroSistema("monitoreo.motor.frescura_seg"),
    ]);

    const incidenteMotorAbierto = SENALES_MOTOR.some((senal) => senalesEnRojo.includes(senal));
    const ultimaVerificacionEn = ultimoExito ? ultimoExito.creadoEn : null;

    const frescuraNum = Number(frescuraParam?.valor);
    const frescuraSeg = Number.isFinite(frescuraNum) && frescuraNum > 0 ? frescuraNum : FRESCURA_DEFECTO_SEG;
    const fresca =
        ultimaVerificacionEn !== null && (ahora - ultimaVerificacionEn.getTime()) / 1000 <= frescuraSeg;

    return {
        motorVivo: !incidenteMotorAbierto && fresca,
        ultimaVerificacionEn,
    };
}
