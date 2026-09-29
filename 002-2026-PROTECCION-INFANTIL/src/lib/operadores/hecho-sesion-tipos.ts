/**
 * SPEC-750 (D-121, condición de Datos) · El HECHO de la sesión es EVIDENCIA que alguien
 * va a interpretar a años vista. Por eso su `metadatos` es una forma TIPADA y documentada
 * —no JSON libre— y viaja a `bi_replica` (la columna `AuditLog.metadatos` se replica
 * ENTERA). El tipo NO tiene campo de URL/enlace ni de contenido: es imposible-por-
 * construcción meter la URL de la sesión de un menor en el registro del hecho.
 *
 * Módulo puro (solo tipos + builder) para que el candado lo use sin arrastrar infra.
 */

/** Los hechos registrables del ciclo de la sesión (discriminador `metadatos.tipo`). */
export type TipoHechoSesion =
    | "cita_asignada" // un operador quedó asignado a la cita (evento append-only; sobrevive al SetNull).
    | "sesion_convocada"; // el operador publicó el enlace y convocó la reunión.

/**
 * Forma del `metadatos` del HECHO. **Prohibido** por tipo: enlace/url y cualquier
 * contenido del encuentro. Sin index signature: el compilador rechaza campos extra.
 */
// `type` (no `interface`) a propósito: así es asignable a `Record<string, unknown>` (el
// parámetro de `logAudit`) sin cast, conservando la forma estricta (sin campo url/contenido).
export type HechoSesionMetadatos = {
    tipo: TipoHechoSesion;
    /** Versión del protocolo del guion (parámetro sembrado `operador.guion.version`). */
    protocoloVersion?: string;
};

/** Construye el metadatos del HECHO. Único punto que arma esa forma → un solo lugar que revisar. */
export function metadatosHecho(
    tipo: TipoHechoSesion,
    extra?: Omit<HechoSesionMetadatos, "tipo">,
): HechoSesionMetadatos {
    return { tipo, ...extra };
}
