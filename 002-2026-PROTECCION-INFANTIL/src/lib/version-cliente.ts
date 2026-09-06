/**
 * SPEC-548 (I-337) · Motor de detección de versión, lado cliente.
 *
 * Una sesión abierta puede cruzar un despliegue: el servidor pasa a correr un
 * build nuevo mientras el padre sigue con el viejo cargado. Este módulo es la
 * pieza PURA del motor — la comparación — para poder vigilarla sin navegador.
 *
 * El sello viene de `/api/version` (que lee `getBuildSha()` en el servidor). Se
 * compara el sello con el que cargó ESTA sesión contra el que el servidor
 * reporta AHORA.
 */
export type SelloVersion = { version: string; sha: string | null };

/**
 * ¿El servidor corre una versión distinta a la que cargó esta sesión?
 *
 * Solo dispara con evidencia POSITIVA de cambio: los dos sellos presentes, con
 * sha real, y distintos. Si a cualquiera le falta el sha (dev sin
 * `APP_BUILD_SHA`) no hay forma de saberlo → `false`: en dev nunca molesta, y
 * un sello a medias jamás se interpreta como «hay versión nueva».
 */
export function hayVersionNueva(
    cargada: SelloVersion | null,
    actual: SelloVersion | null,
): boolean {
    if (!cargada || !actual) return false;
    if (!cargada.sha || !actual.sha) return false;
    return cargada.sha !== actual.sha;
}
