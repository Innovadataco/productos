/**
 * SPEC-750 · Reglas PURAS del enlace de la reunión (sin dependencias de infra, para que
 * el candado las pruebe como unit). La publicación y el registro del hecho viven en
 * `enlace-sesion.ts` (que reusa estas funciones).
 */
export type ValidacionEnlace = { ok: true; url: string } | { ok: false; razon: string };

/**
 * Valida el enlace EN SERVIDOR: solo `https:`, sin marcado HTML. El valor se guarda como
 * texto y el render lo escapa; acá además se rechaza cualquier `<`/`>` para que jamás
 * pueda leerse como HTML.
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
