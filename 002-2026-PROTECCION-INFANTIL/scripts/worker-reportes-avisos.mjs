/**
 * SPEC-671 (I-397) — Orquestación de los avisos de COINCIDENCIA del worker de
 * reportes, en un módulo PURO (cero deps de pg-boss/Prisma/fetch) para poder
 * testear el CABLEADO sin base de datos.
 *
 * El defecto de I-397 no estaba en las funciones de aviso —tienen sus 11 pruebas
 * y pasan— sino en DÓNDE se las llamaba: colgaban solo de la rama de ÉXITO de la
 * clasificación (`worker-reportes.mjs`, tras el `throw` del fallo de `/procesar`).
 * Con el motor caído, la clasificación lanza, el reporte se rescata a
 * REVISION_MANUAL… y los tres avisos nunca corrían. Un padre no se enteraba de que
 * reportaron la cuenta de su hijo; un colegio, de que reportaron a un alumno.
 *
 * Dos verdades del arreglo viven acá:
 *   1. Los tres avisos de COINCIDENCIA (comparan un identificador; NO miran la
 *      categoría) se disparan en la ruta de éxito Y tras un rescate exitoso.
 *      Inferencia (patrón, match) NO entra: usa embeddings/score y se queda en éxito.
 *   2. Errores AISLADOS por aviso: si el del colegio falla, el del padre sale igual.
 *      Nada de `await` secuencial que encadene un fallo con el siguiente.
 *
 * Las funciones de aviso entran por parámetro (no se importan acá) para que el
 * candado inyecte dobles y mida el cableado sin tocar la BD.
 */

function avisoPorDefectoEnError(rol, reporteId, err) {
    console.error(`[WORKER] Error notificando ${rol} reporte=${reporteId}:`, err?.message ?? err);
}

/**
 * Dispara los TRES avisos de coincidencia, cada uno aislado con su propio
 * `.catch`. Devuelve la promesa del aviso de COLEGIO para que la ruta de ÉXITO
 * pueda encadenar la agregación de patrones (F6, inferencia) DESPUÉS de las
 * alertas; la ruta de rescate ignora el retorno.
 *
 * @param {string} reporteId
 * @param {{ circulo: (id:string)=>Promise, hijos: (id:string)=>Promise, colegio: (id:string)=>Promise }} avisos
 * @param {(rol:string, reporteId:string, err:unknown)=>void} [onError]
 */
export function dispararAvisosDeCoincidencia(reporteId, avisos, onError = avisoPorDefectoEnError) {
    avisos.circulo(reporteId).catch((err) => onError("círculo", reporteId, err));
    avisos.hijos(reporteId).catch((err) => onError("hijos", reporteId, err));
    return avisos.colegio(reporteId).catch((err) => onError("colegio", reporteId, err));
}

/**
 * Rescata un reporte que no se pudo clasificar (lo pasa a REVISION_MANUAL vía
 * `llamarFallback`, que lo deja en un estado VISIBLE) y, SOLO si el rescate tuvo
 * éxito, dispara los avisos de coincidencia. Si `llamarFallback` lanza (p. ej.
 * 404: el reporte no existe), NO avisa — y es correcto: no hay a quién avisar.
 *
 * Esta es la costura que I-397 dejaba abierta: antes el rescate salvaba el reporte
 * y abandonaba el aviso.
 *
 * @param {string} reporteId
 * @param {string} error
 * @param {{ llamarFallback: (id:string, err:string)=>Promise, avisos: object, onError?: Function }} deps
 */
export async function rescatarYAvisar(reporteId, error, { llamarFallback, avisos, onError }) {
    await llamarFallback(reporteId, error);
    dispararAvisosDeCoincidencia(reporteId, avisos, onError);
}
