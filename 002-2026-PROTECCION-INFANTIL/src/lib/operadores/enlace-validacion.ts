/**
 * SPEC-750 + SPEC-793 · Reglas PURAS del enlace de la reunión (sin dependencias de infra, para que
 * el candado las pruebe como unit). La publicación y el registro del hecho viven en `enlace-sesion.ts`.
 *
 * SPEC-793 · ¿EN QUÉ SALA ocurre la sesión de un menor? Antes se aceptaba CUALQUIER URL `https`. Ahora
 * el host debe pertenecer a un proveedor de la ALLOWLIST. El porqué de que la lista viva en CÓDIGO y no
 * en configuración: agregar un proveedor es una decisión con PESO LEGAL —acuerdo de tratamiento de
 * datos, dónde viven los datos, transferencia internacional (Ley 1581 art. 26)—, no una conveniencia
 * operativa. En código, agregar uno exige un PR que ALGUIEN REVISA; como parámetro, un admin lo agrega
 * un martes y nadie se entera. **La fricción es el control.**
 */
export type ValidacionEnlace = { ok: true; url: string } | { ok: false; razon: string };

/** Un proveedor de video permitido para las sesiones. El CONTENIDO de la lista lo aprueba Jelkin con el abogado. */
export interface ProveedorEnlace {
    readonly nombre: string;
    /** Dominios base aprobados. Se acepta el host EXACTO o un SUBDOMINIO propio (nunca «contiene»). */
    readonly dominios: readonly string[];
    /** POR QUÉ está aprobado: quién es, dónde trata los datos, qué se revisó. Una lista sin razones se copia sin pensar. */
    readonly porque: string;
    /** Aprobado por Jelkin + [ABOGADO]. HOY todos `false`: la lista es una PROPUESTA pendiente (ver abajo). */
    readonly aprobado: boolean;
}

/**
 * PROPUESTA MÍNIMA de proveedores — **PENDIENTE de aprobación de Jelkin con el abogado**. Estrategia
 * prepara la propuesta comercial; el mecanismo ya está. TODOS con `aprobado: false` A PROPÓSITO: hasta
 * que Jelkin apruebe uno (en un PR que alguien revisa), NINGÚN enlace pasa la validación — fail-closed,
 * que es la precondición correcta para el PRIMER enlace real (hoy hay CERO publicados). NO cambies
 * `aprobado` a `true` sin ese PR, y NO muevas esta lista a `ParametroSistema`: la fricción es el control.
 */
export const PROVEEDORES_APROBADOS: readonly ProveedorEnlace[] = [
    {
        nombre: "Google Meet",
        dominios: ["meet.google.com"],
        porque:
            "PROPUESTA · PENDIENTE [ABOGADO]/Jelkin. Sala sin instalación ni cuenta obligatoria. Falta: acuerdo de tratamiento de datos y confirmar dónde se procesan (Google → transferencia internacional, Ley 1581 art. 26).",
        aprobado: false,
    },
    {
        nombre: "Jitsi Meet (meet.jit.si)",
        dominios: ["meet.jit.si"],
        porque:
            "PROPUESTA · PENDIENTE [ABOGADO]/Jelkin. Open source, sin cuenta. Falta: confirmar quién opera el servidor público y su tratamiento de datos.",
        aprobado: false,
    },
];

/**
 * ¿`hostname` es el host EXACTO o un SUBDOMINIO propio de `dominio`? NO es «contiene»: eso dejaría pasar
 * `meet.google.com.atacante.co` (un subdominio de `atacante.co` que sólo CONTIENE el nombre aprobado).
 */
export function hostPerteneceADominio(hostname: string, dominio: string): boolean {
    const h = hostname.toLowerCase().replace(/\.$/, ""); // sin punto final (FQDN)
    const d = dominio.toLowerCase();
    return h === d || h.endsWith("." + d);
}

/** ¿El host pertenece a algún proveedor APROBADO? Un proveedor `aprobado:false` (pendiente) NO cuenta. */
export function esProveedorAprobado(
    hostname: string,
    proveedores: readonly ProveedorEnlace[] = PROVEEDORES_APROBADOS,
): boolean {
    return proveedores.some((p) => p.aprobado && p.dominios.some((d) => hostPerteneceADominio(hostname, d)));
}

/**
 * Valida el enlace EN SERVIDOR: `https:`, sin marcado HTML, y de un proveedor de la ALLOWLIST. `proveedores`
 * es inyectable para que el candado pruebe el MECANISMO con entradas de PRUEBA — así el día que Jelkin
 * apruebe o quite un proveedor, el candado NO se pone rojo por eso (vigila el mecanismo, no el contenido).
 */
export function validarEnlaceReunion(
    raw: string,
    proveedores: readonly ProveedorEnlace[] = PROVEEDORES_APROBADOS,
): ValidacionEnlace {
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
    if (!esProveedorAprobado(parsed.hostname, proveedores)) {
        return {
            ok: false,
            razon:
                "El proveedor del enlace no está en la lista de proveedores aprobados. Solo se permiten salas de proveedores con acuerdo de tratamiento de datos (agregar uno es una decisión legal, no operativa).",
        };
    }
    return { ok: true, url: valor };
}

// SPEC-778: `enlaceVisibleParaCita` se ELIMINÓ. Era la frontera temporal placeholder de
// 750 para estas pantallas (sin llamadores de producción, solo su propio test). La noción
// de «pasó la hora» es UNA sola en el producto: `estadoEfectivoDeCita` (SPEC-746). La
// visibilidad del enlace se deriva de ahí en `enlace-derivado.ts`, no acá. Dejar una segunda
// frontera daba cobertura falsa (mismo animal que `grupoDeCita`, borrado en 749 FR-3).
