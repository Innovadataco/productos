/**
 * SPEC-750 + SPEC-854 · Reglas PURAS del enlace de la reunión (sin dependencias de infra, para que el
 * candado las pruebe como unit). La publicación y el registro del hecho viven en `enlace-sesion.ts`.
 *
 * SPEC-854 (decisión Jelkin 01-10-2026): se QUITA la allowlist de proveedores (SPEC-793). Jelkin NUNCA
 * pidió esa validación — igual que REPS, era scope no conciliado. Todos los proveedores reales (Meet,
 * Zoom, Teams, Jitsi) son enlaces `https` normales, y exigir «proveedor aprobado» (todos `aprobado:false`)
 * devolvía 400 a CUALQUIER enlace. El campo acepta cualquier `https` válido. Queda solo la seguridad
 * básica del campo (no restricción de proveedor): no-vacío + no-HTML (`[<>]`) + `https:` + URL parseable.
 */
export type ValidacionEnlace = { ok: true; url: string } | { ok: false; razon: string };

/**
 * Valida el enlace EN SERVIDOR: no-vacío, sin marcado HTML, `https:` y URL parseable. Cualquier `https`
 * válido pasa (SPEC-854 quitó la restricción de proveedor).
 */
export function validarEnlaceReunion(raw: string): ValidacionEnlace {
    const valor = raw.trim();
    if (!valor) return { ok: false, razon: "El enlace no puede estar vacío" };
    if (/[<>]/.test(valor)) return { ok: false, razon: "El enlace no puede contener HTML" };
    let parsed: URL;
    try {
        parsed = new URL(valor);
    } catch {
        return { ok: false, razon: "El enlace no es una URL válida" };
    }
    if (parsed.protocol !== "https:") return { ok: false, razon: "El enlace debe empezar con https://" };
    return { ok: true, url: valor };
}

// SPEC-778: `enlaceVisibleParaCita` se ELIMINÓ. Era la frontera temporal placeholder de
// 750 para estas pantallas (sin llamadores de producción, solo su propio test). La noción
// de «pasó la hora» es UNA sola en el producto: `estadoEfectivoDeCita` (SPEC-746). La
// visibilidad del enlace se deriva de ahí en `enlace-derivado.ts`, no acá. Dejar una segunda
// frontera daba cobertura falsa (mismo animal que `grupoDeCita`, borrado en 749 FR-3).
