import { AppError, ERROR_CODES } from "@/lib/errors";

/**
 * SPEC-673 (I-398) · Invariante de ESTADO: un perfil profesional que NO está en
 * BORRADOR debe tener al menos una modalidad (`atiendeVirtual || atiendePresencial`),
 * se llegue por donde se llegue — reenvío desde BORRADOR/VENCIDO, edición de un
 * ACTIVO, o un camino que todavía no existe.
 *
 * `perfilCompletoParaRevision` exigía la modalidad SOLO en la transición
 * BORRADOR→EN_REVISION del PUT/subida; `reenviarParaVerificacion` y la edición de
 * un perfil ya ACTIVO la saltaban → un profesional aprobado, listado e inservible
 * (invisible a búsquedas filtradas + sin poder crear franjas). El candado va sobre
 * el ESTADO, no sobre un endpoint.
 *
 * Esta función es la compuerta de código en los caminos conocidos; el refuerzo de
 * fondo es un CHECK NOT VALID en la BD (radicado aparte) que cubre los que no
 * conocemos.
 */
export function faltaModalidad(m: { atiendeVirtual: boolean; atiendePresencial: boolean }): boolean {
    return !m.atiendeVirtual && !m.atiendePresencial;
}

// Copy FINAL de Diseño (FORMA-SPEC673-I398, voz usted): dice la CONSECUENCIA real
// —cómo lo encuentran las familias—, no un requisito burocrático. El TEXTO es de
// Diseño; el CÓDIGO (`MODALIDAD_REQUERIDA`) es el contrato con el cliente.
export const MENSAJE_MODALIDAD_REQUERIDA =
    "Falta elegir cómo atiende —virtual, presencial o ambas—. Es lo que permite que las familias lo encuentren, así que su perfil no puede pasar a revisión sin eso.";

/**
 * Lanza si `estado` no es BORRADOR y no hay ninguna modalidad. BORRADOR se exime
 * a propósito: un borrador puede estar incompleto; lo que no puede es SALIR de
 * BORRADOR (o quedarse fuera de él) sin modalidad.
 *
 * El 400 lleva `code: MODALIDAD_REQUERIDA` para que el cliente señale el CAMPO
 * (modalidad) sin parsear el texto — el borde de Diseño se engancha ahí.
 */
export function exigirModalidadParaEstado(
    estado: string,
    m: { atiendeVirtual: boolean; atiendePresencial: boolean },
): void {
    if (estado !== "BORRADOR" && faltaModalidad(m)) {
        throw new AppError(MENSAJE_MODALIDAD_REQUERIDA, ERROR_CODES.MODALIDAD_REQUERIDA, 400);
    }
}
