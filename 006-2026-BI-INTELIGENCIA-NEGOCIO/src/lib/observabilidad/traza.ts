// src/lib/observabilidad/traza.ts · Reloj de pasos del pipeline NL→SQL
// Producto 006 · BI v2 · Observabilidad del chat (SPEC-006 · AGENTE A)
// El motor crea UNA traza por consulta y marca cada hito del pipeline con
// los ms transcurridos desde el inicio. Al cerrar, el array se persiste en
// BIConsultaLog.pasosJson y el chat lo muestra como auditoría ("Ver traza").
// Puro y sin dependencias: testeable sin BD, sin red, sin Ollama.

/** Un hito del pipeline: nombre, detalle libre y ms desde el inicio. */
export interface PasoTraza {
    paso: string;
    detalle?: string;
    ms: number;
}

export interface Traza {
    /** Registra un hito con su detalle (ms = ahora - inicio). */
    paso: (nombre: string, detalle?: string) => void;
    /** Copia inmutable de los pasos registrados hasta ahora. */
    pasos: () => PasoTraza[];
}

/**
 * Crea la traza de una consulta. El reloj arranca en este momento
 * (Date.now: el motor ya mide su latencia total con ese mismo reloj).
 */
export function crearTraza(): Traza {
    const t0 = Date.now();
    const registrados: PasoTraza[] = [];
    return {
        paso(nombre: string, detalle?: string) {
            const paso: PasoTraza = { paso: nombre, ms: Date.now() - t0 };
            if (detalle !== undefined) paso.detalle = detalle;
            registrados.push(paso);
        },
        pasos() {
            return registrados.map((p) => ({ ...p }));
        },
    };
}
