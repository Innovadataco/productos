/**
 * SPEC-234 (002-PI-134): lógica de refresco de la caché de señal comunitaria.
 * Usada por el worker `scripts/worker-senal-comunitaria.mjs` y testeable en
 * aislamiento sin advisory lock.
 */
import { SenalComunitariaRepository } from "@/lib/dal/repositories/senal-comunitaria-repository";
import { obtenerSenalComunitaria } from "@/lib/expediente/compilacion/queries/senal-comunitaria";

/**
 * Refresca las filas de `SenalComunitariaCache` que estén marcadas como
 * inválidas o cuyo `actualizadoEn` supere `refreshMin` minutos.
 *
 * Para las filas vencidas (pero no inválidas) se fuerza la invalidación antes
 * de recalcular, porque `obtenerSenalComunitaria` devuelve la caché vigente si
 * `invalidado = false`.
 */
export async function refrescarSenalComunitariaPendientes(
    refreshMin: number,
    limite = 100
): Promise<number> {
    const repo = new SenalComunitariaRepository();
    const pendientes = await repo.obtenerPendientesDeRefresco(refreshMin, limite);

    for (const { identificadorReportado } of pendientes) {
        await repo.invalidar(identificadorReportado);
        await obtenerSenalComunitaria(identificadorReportado);
    }

    return pendientes.length;
}
