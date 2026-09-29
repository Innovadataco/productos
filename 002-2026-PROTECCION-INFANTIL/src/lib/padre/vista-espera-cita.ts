/**
 * SPEC-749 · FR-2 (parcial) — la pantalla de espera del padre dice la VERDAD
 * después de la hora, para los dos estados que la fuente única
 * `estadoEfectivoDeCita` (SPEC-746) deja pasar POR DISEÑO: `PAGADA_PENDIENTE` y
 * `SIN_CONFIRMAR`. A esos los gobierna OTRO reloj (la ventana de 48 h del pago /
 * el plazo de confirmación), no la franja, así que la fuente no les superpone una
 * fase temporal (superponerla inventaría una transición de negocio que no existe).
 * Pero la PANTALLA sí debe dejar de decir «esperando» sobre una hora ya ida —
 * ese es el «texto que miente». La verdad se DERIVA de (estado + franja vs ahora).
 *
 * Copy aprobado: FORMA-FLUJO-REUNION-OPERADOR-ENLACE §14 (2026-09-29, Diseño).
 *
 * FRONTERA ÚNICA: se reusa la FUENTE como ORÁCULO — «¿ya pasó la franja?» es
 * `estadoEfectivoDeCita("CONFIRMADA", …) === "PASADA"` (frontera now≥FIN). Así no
 * se reintroduce una segunda comparación de tiempo a mano (lo que SPEC-749 combate)
 * y se hereda el fallo CONSERVADOR: franja/now ausente o basura → se trata como
 * PASADA (decir «ya pasó» nunca miente hacia el lado optimista, FR-4).
 *
 * CONFIRMADA con franja pasada NO se resuelve aquí: su copy es **[NEEDS CLARIFICATION]**
 * (lo baja el CEO con Diseño). No se inventa ni como placeholder — se devuelve `null`
 * y el llamador cae a la conducta actual por estado crudo (diferida).
 */
import type { EstadoSolicitudCita } from "@prisma/client";
import { estadoEfectivoDeCita, type EntradaTiempo } from "@/lib/profesional/cita/estado-efectivo";

export type TonoEspera = "espera" | "verde" | "gris" | "rojo";

export interface VistaEspera {
    titulo: string;
    detalle: string;
    tono: TonoEspera;
    /**
     * CTA a mostrar bajo el estado — SOLO las que tienen destino real hoy.
     * `pedir_otra_cita` → directorio (existe). `revisar_pago` → guía de soporte en
     * texto (el flujo de incidencia de pago, SPEC-658/D-137, aún no existe: no se
     * pinta un botón sin destino). `reprogramar` de §14 se OMITE: su endpoint existe
     * pero no hay UI de selección de nueva franja (es trabajo de SPEC-395).
     */
    accion?: "pedir_otra_cita" | "revisar_pago";
}

/**
 * La vista de «franja pasada» para los dos estados soportados, o `null` si no aplica
 * (franja aún no pasó, o estado que no se cablea aquí — incluida CONFIRMADA, diferida).
 */
export function derivarVistaFranjaPasada(
    estado: EstadoSolicitudCita,
    franjaInicio: EntradaTiempo,
    franjaFin: EntradaTiempo,
    venceEn: EntradaTiempo,
    nombreProfesional: string,
    ahora: EntradaTiempo,
): VistaEspera | null {
    const franjaYaPaso = estadoEfectivoDeCita("CONFIRMADA", franjaInicio, franjaFin, ahora) === "PASADA";
    if (!franjaYaPaso) return null;

    if (estado === "PAGADA_PENDIENTE") {
        // §14: «< 48 h del pago: aún puede responder · ≥ 48 h: no respondió». El
        // vencimiento reusa la MISMA frontera-oráculo (instante único → inicio==fin):
        // PASADA = ya venció el plazo. Falla a «vencido» ante `venceEn` ausente/basura.
        const plazoVencido = estadoEfectivoDeCita("CONFIRMADA", venceEn, venceEn, ahora) === "PASADA";
        return {
            titulo: `La hora que reservaste ya pasó y ${nombreProfesional} no alcanzó a confirmar.`,
            detalle: plazoVencido
                ? "Ya pasaron las 48 h desde tu pago y no respondió a tiempo."
                : "Todavía puede responder dentro de las 48 h desde tu pago.",
            tono: plazoVencido ? "rojo" : "espera",
            accion: "revisar_pago",
        };
    }

    if (estado === "SIN_CONFIRMAR") {
        return {
            titulo: "Esta solicitud no llegó a confirmarse y la hora ya pasó.",
            detalle: "No se aprobó el pago a tiempo. Puedes pedir otra cita cuando quieras.",
            tono: "gris",
            accion: "pedir_otra_cita",
        };
    }

    // CONFIRMADA-pasada (el 78% que mide Jelkin) y cualquier otro estado: no aquí.
    // CONFIRMADA espera el copy de Diseño [NEEDS CLARIFICATION]; el resto es passthrough.
    return null;
}
