/**
 * SPEC-371 · poblador demo v3 — la capa de GESTIÓN humana para BI.
 *
 * La v2 dejó volumen; ahora el tablero de gestión tiene que moverse:
 *  · operarios del COLEGIO con alertas asignadas (reparto desigual a propósito,
 *    para que el semáforo de capacidad de BI muestre los tres estados);
 *  · el ciclo de vida transitado de verdad (TransicionReporte con tiempos
 *    escalonados y creíbles) y SolicitudComite abiertas y resueltas.
 *
 * ⚠️ Matiz: `AlertaColegio.asignadoAId` (dentro del colegio) NO es
 * `Reporte.operadorId` (moderación del admin). Esta capa es la del COLEGIO.
 *
 * Reversibilidad, por construcción:
 *  · Las filas NUEVAS (transiciones, solicitudes) llevan ids `demo3-` — prefijo
 *    disjunto de `demo-` (v1) y `demo2-` (v2), probado en las tres direcciones.
 *  · Las ASIGNACIONES se hacen sobre alertas `demo-al-` de colegios `demo-c-` y
 *    solo a comités `demo-u-cvi-` (v1 nunca asigna; en prod está 100% NULL), así
 *    que revertir = volver a NULL donde el asignado empiece por `demo-u-cvi-`.
 *  · Ninguna escritura toca una fila cuyo id no lleve marca demo.
 */
import type { EstadoReporte, ResponsableTransicion } from "@prisma/client";

export const DEMO3 = {
    prefix: "demo3-",
    /** Cuántos comités demo actúan de operarios (uno por colegio: `comiteColegioId` es único). */
    nOperarios: 5,
    /**
     * Fracción de las alertas ACTIVAS (estado ≠ cerrada) de cada colegio que se
     * asigna a su comité. DESIGUAL a propósito: uno casi al tope, otro a la mitad,
     * otro casi libre. Promedio ≈ 0,7 → ~70 % asignadas, ~30 % en la cola visible.
     */
    fraccionesAsignacion: [0.95, 0.9, 0.8, 0.65, 0.2] as const,
    /** De las alertas ESCALADAS, cuántas quedan con solicitud aún PENDIENTE. */
    fraccionSolicitudesPendientes: 0.4,
} as const;

/** IDs deterministas: idempotente por skipDuplicates y borrable por prefijo. */
export const id3 = {
    transicion: (reporteId: string, paso: number) => `demo3-tr-${reporteId}-${paso}`,
    solicitud: (alertaId: string) => `demo3-sol-${alertaId}`,
    /** Número visible. Un `SOL-` real es `SOL-XXXXXXXX` (8 hex): el `D3-` lo hace imposible de chocar. */
    numeroSolicitud: (n: number) => `SOL-D3-${String(n).padStart(6, "0")}`,
} as const;

/** Un paso de la cadena de vida de un reporte, tal como lo escribe el flujo real. */
export type PasoTransicion = {
    estadoAnterior: EstadoReporte;
    estadoNuevo: EstadoReporte;
    responsableTipo: ResponsableTransicion;
    motivo: string;
    /** Horas después del paso anterior (o del creadoEn para el primero). */
    horasDespues: number;
};

const H = (min: number, max: number, r: () => number) => min + r() * (max - min);

/**
 * La cadena que lleva a un reporte desde PENDIENTE hasta SU estado actual.
 * Se termina exactamente en el estado que el reporte YA tiene en BD, así el
 * `Reporte` no se toca y la historia queda coherente con el presente.
 *
 * Los motivos/responsables copian los del pipeline real:
 *  · PENDIENTE → PROCESANDO: WORKER, "Inicio de procesamiento por worker".
 *  · → CLASIFICADO / POSIBLE_SPAM: IA, "Clasificación automática completada".
 *  · → REVISION_MANUAL: IA, "Requiere revisión humana".
 *  · REVISION_MANUAL → CLASIFICADO (una parte): OPERADOR, resuelto a mano.
 */
export function cadenaParaEstado(estadoActual: EstadoReporte, r: () => number): PasoTransicion[] {
    const inicio: PasoTransicion = {
        estadoAnterior: "PENDIENTE",
        estadoNuevo: "PROCESANDO",
        responsableTipo: "WORKER",
        motivo: "Inicio de procesamiento por worker",
        horasDespues: H(0.05, 2, r), // minutos a un par de horas en cola
    };
    switch (estadoActual) {
        case "CLASIFICADO": {
            // Una parte pasó por revisión humana antes de quedar clasificado.
            if (r() < 0.25) {
                return [
                    inicio,
                    { estadoAnterior: "PROCESANDO", estadoNuevo: "REVISION_MANUAL", responsableTipo: "IA", motivo: "Requiere revisión humana", horasDespues: H(0.02, 0.5, r) },
                    { estadoAnterior: "REVISION_MANUAL", estadoNuevo: "CLASIFICADO", responsableTipo: "OPERADOR", motivo: "Revisión humana: clasificación confirmada", horasDespues: H(4, 72, r) },
                ];
            }
            return [
                inicio,
                { estadoAnterior: "PROCESANDO", estadoNuevo: "CLASIFICADO", responsableTipo: "IA", motivo: "Clasificación automática completada", horasDespues: H(0.02, 0.5, r) },
            ];
        }
        case "REVISION_MANUAL":
            return [
                inicio,
                { estadoAnterior: "PROCESANDO", estadoNuevo: "REVISION_MANUAL", responsableTipo: "IA", motivo: "Requiere revisión humana", horasDespues: H(0.02, 0.5, r) },
            ];
        case "POSIBLE_SPAM":
            return [
                inicio,
                { estadoAnterior: "PROCESANDO", estadoNuevo: "POSIBLE_SPAM", responsableTipo: "IA", motivo: "Clasificación automática completada", horasDespues: H(0.02, 0.5, r) },
            ];
        default:
            // Estados que el demo no produce (DUPLICADO, CORREGIDO…): no se inventa historia.
            return [];
    }
}

/**
 * Fechas de cada paso: escalonadas a partir del `creadoEn` del reporte y nunca
 * en el futuro. Si un paso cayera después de "ahora", se recorta a "ahora" (y
 * los siguientes también), antes que fabricar un dato imposible para BI.
 */
export function fechasEscalonadas(creadoEn: Date, pasos: PasoTransicion[], ahora: Date): Date[] {
    const fechas: Date[] = [];
    let t = creadoEn.getTime();
    for (const p of pasos) {
        t = Math.min(t + p.horasDespues * 3_600_000, ahora.getTime());
        fechas.push(new Date(t));
    }
    return fechas;
}

/** Reparto desigual: la fracción del colegio i-ésimo, cíclica si hay más colegios que fracciones. */
export function fraccionDe(indice: number): number {
    const f = DEMO3.fraccionesAsignacion;
    return f[indice % f.length] as number;
}
