/**
 * SPEC-574 (I-354) — capacidades de acción del operador sobre un reporte, en UNA sola fuente pura.
 *
 * Extraído de los flags inline de `AccionesReporte` para poder afirmar la CONDUCTA (qué acción hay,
 * según el estado del reporte) sin depender de cómo se vea — la forma la define Diseño, esto no.
 *
 * La regla que cierra SPEC-574: `puedeClasificar` es el COMPLEMENTO de corregir/confirmar. Un reporte
 * que cae a REVISION_MANUAL antes de que el motor lo clasifique no tiene `ClasificacionIA`, y las dos
 * vías existentes la exigen — el operador quedaba sin acción principal. Clasificar aparece SOLO ahí, y
 * desaparece en cuanto hay clasificación (donde el endpoint responde 409 y remite a corrección): así
 * el cliente respeta el 409 en vez de esquivarlo.
 */

/** Subconjunto estructural que basta para derivar las capacidades (un `DetalleReporte` lo satisface). */
export interface ReporteParaCapacidades {
    eliminado: boolean;
    estado: string;
    clasificacion?: { correccion?: unknown } | null;
}

export interface CapacidadesAcciones {
    puedeAnonimizar: boolean;
    puedeClasificar: boolean;
    puedeCorregir: boolean;
    puedeConfirmar: boolean;
    puedeBaja: boolean;
    puedeReactivar: boolean;
}

/**
 * SPEC-574 · el gate anti-reflejo de «Asignar clasificación»: el botón está listo SOLO con categoría
 * elegida Y nota con ≥10 caracteres (trim). Diseño lo fijó como el candado anti-reflejo — con el botón
 * deshabilitado, un Enter reflejo no dispara una acción que puede volver PÚBLICO el reporte de un menor
 * (más fuerte que el orden-DOM de SPEC-562). Pura para poder afirmarla sin render.
 */
export function asignacionListaParaEnviar(categoria: string, nota: string): boolean {
    return categoria.trim().length > 0 && nota.trim().length >= 10;
}

export function capacidadesAccionesReporte(reporte: ReporteParaCapacidades): CapacidadesAcciones {
    const estaEliminado = reporte.eliminado;
    const tieneClasificacion = !!reporte.clasificacion;
    const tieneCorreccion = !!reporte.clasificacion?.correccion;
    return {
        puedeAnonimizar: !estaEliminado && reporte.estado === "REQUIERE_ANONIMIZACION",
        puedeClasificar: !estaEliminado && reporte.estado === "REVISION_MANUAL" && !tieneClasificacion,
        puedeCorregir: !estaEliminado && tieneClasificacion && reporte.estado !== "CORREGIDO" && !tieneCorreccion,
        puedeConfirmar:
            !estaEliminado && reporte.estado === "REVISION_MANUAL" && tieneClasificacion && !tieneCorreccion,
        puedeBaja: !estaEliminado,
        puedeReactivar: estaEliminado,
    };
}
