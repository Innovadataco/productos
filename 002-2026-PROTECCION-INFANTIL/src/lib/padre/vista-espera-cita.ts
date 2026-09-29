/**
 * SPEC-749 · FR-2 — la pantalla del padre dice la VERDAD después de la hora, derivando
 * de (estado + franja vs `now`) en vez del estado crudo. Tres estados-pasados:
 *
 *  · `CONFIRMADA` + franja pasada → el 78 % que mide Jelkin (105/135). El estado NO
 *    avanza con el tiempo, así que la pantalla decía «Cita confirmada» en verde sobre
 *    una hora de ayer. Copy: FORMA-CITA-CONFIRMADA-HORA-PASADA-INTERIM v1.2 (Diseño).
 *  · `PAGADA_PENDIENTE` / `SIN_CONFIRMAR` + franja pasada → los dos que la fuente única
 *    `estadoEfectivoDeCita` (SPEC-746) deja pasar POR DISEÑO (los gobierna el reloj de
 *    48 h del pago, no la franja). Copy: FORMA-FLUJO-REUNION-OPERADOR-ENLACE §14.
 *
 * FRONTERA ÚNICA: se reusa la FUENTE como ORÁCULO — «¿ya pasó la franja?» es
 * `estadoEfectivoDeCita("CONFIRMADA", …) === "PASADA"` (frontera now≥FIN). No se
 * reintroduce una segunda comparación de tiempo a mano (lo que SPEC-749 combate) y se
 * hereda el fallo CONSERVADOR: franja/now ausente o basura → PASADA (decir «ya pasó»
 * nunca miente hacia el lado optimista, FR-4).
 *
 * MUNDO DE HOY (interino): no hay enlace ni operador. Por eso el copy NO promete un
 * mecanismo («aparecerá aquí») NI culpa a un operador inexistente («atrasada»). Cuando
 * entre la SPEC del operador, CONFIRMADA-pasada pasa a Esperando/Lista/Atrasada (§7/§10).
 */
import type { EstadoSolicitudCita } from "@prisma/client";
import { estadoEfectivoDeCita, type EntradaTiempo } from "@/lib/profesional/cita/estado-efectivo";

export type TonoEspera = "espera" | "verde" | "gris" | "rojo";

/**
 * CTAs bajo el estado — SOLO afordances con destino REAL. `pedirOtraCita` → directorio
 * (existe). `escribenos`/`revisarPago` → guía de soporte en TEXTO: no hay ruta de soporte
 * para el padre hoy, y un botón sin destino promete conducta que no entregamos. El
 * `reprogramar` de §14 se OMITE por lo mismo (endpoint sí, UI de nueva franja no — SPEC-395).
 */
export interface AccionesEspera {
    pedirOtraCita?: boolean;
    escribenos?: boolean;
    revisarPago?: boolean;
}

export interface VistaEspera {
    titulo: string;
    detalle: string;
    tono: TonoEspera;
    acciones?: AccionesEspera;
}

/**
 * La vista de «franja pasada» para los tres estados soportados, o `null` si no aplica
 * (franja aún no pasó, o estado terminal/otro que la fuente devuelve tal cual).
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

    if (estado === "CONFIRMADA") {
        // FORMA-CITA-CONFIRMADA-HORA-PASADA-INTERIM §1: factual, sin promesa, sin culpa,
        // sin «Cita confirmada» a secas. Tono TINTA neutro (pasado/cerrado) — el verde
        // era parte de la mentira (SPEC-730: estado final neutro = tinta). Salida real:
        // el padre pagó → «pedir otra cita» (seguir) o «escríbenos» (algo salió mal).
        return {
            titulo: "Esta cita ya pasó",
            detalle: `La hora que tenías con ${nombreProfesional} ya pasó. Si quieres continuar, puedes pedir otra cita; y si algo no salió como esperabas, escríbenos.`,
            tono: "gris",
            acciones: { pedirOtraCita: true, escribenos: true },
        };
    }

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
            acciones: { revisarPago: true },
        };
    }

    if (estado === "SIN_CONFIRMAR") {
        return {
            titulo: "Esta solicitud no llegó a confirmarse y la hora ya pasó.",
            detalle: "No se aprobó el pago a tiempo. Puedes pedir otra cita cuando quieras.",
            tono: "gris",
            acciones: { pedirOtraCita: true },
        };
    }

    // Estados terminales/otros (CUMPLIDA, NO_ASISTIO_*, VENCIDA, REEMBOLSADA, REPROGRAMADA):
    // ya son verdaderos por sí mismos; la fuente los devuelve tal cual → no se tocan aquí.
    return null;
}
