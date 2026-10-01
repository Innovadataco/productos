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
 * CTAs bajo el estado — SOLO afordances con destino REAL. `pedirOtraCita` → directorio.
 * `escribenos`/`revisarPago` → `mailto:` al soporte de la plataforma (destino real; puente
 * hasta la PQR de SPEC-752). El `reprogramar` de §14 se OMITE: su endpoint existe pero no hay
 * UI de selección de nueva franja (SPEC-395) — no se pinta un botón sin destino.
 */
export interface AccionesEspera {
    pedirOtraCita?: boolean;
    escribenos?: boolean;
    revisarPago?: boolean;
    /**
     * SPEC-792 C4 · cuando el servicio NO se entregó (el acceso nunca se publicó), «pedir otra cita»
     * HEREDA el pago (`?heredarDe={citaId}`) — el padre no paga de nuevo por una falla nuestra. Sin él,
     * «pedir otra cita» es una cita nueva paga (la cita se consumió). La presencia decide el destino.
     */
    heredarDeCitaId?: string;
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
    // SPEC-792 · señales derivadas que refinan el «ya pasó» de una CONFIRMADA:
    //  · `enlaceNuncaPublicado` (C4) → el acceso jamás llegó (falla nuestra, no del padre).
    //  · `citaId` → para que «pedir otra cita» herede el pago cuando el servicio no se entregó.
    opts: { enlaceNuncaPublicado?: boolean; citaId?: string } = {},
): VistaEspera | null {
    const franjaYaPaso = estadoEfectivoDeCita("CONFIRMADA", franjaInicio, franjaFin, ahora) === "PASADA";
    if (!franjaYaPaso) return null;

    if (estado === "CONFIRMADA") {
        // SPEC-792 C4: el enlace NUNCA se publicó al pasar la hora → el padre esperó siguiendo nuestra
        // instrucción y el acceso jamás llegó. Lo reconocemos SIN culpar al operador («no alcanzó a
        // publicarse» es un hecho) y SIN prometer qué habría pasado; «Esto no dependió de ti». El pago
        // se HEREDA (servicio no entregado). Copy verbatim de Diseño (FORMA-SPEC792 C4).
        if (opts.enlaceNuncaPublicado) {
            return {
                titulo: "El acceso a tu reunión no llegó a estar disponible.",
                detalle: `La hora de tu cita con ${nombreProfesional} ya pasó y el enlace para entrar no alcanzó a publicarse. Esto no dependió de ti. No perdiste tu cupo: puedes pedir otra cita, y si quieres que revisemos qué pasó, escríbenos.`,
                tono: "gris",
                acciones: { pedirOtraCita: true, escribenos: true, ...(opts.citaId ? { heredarDeCitaId: opts.citaId } : {}) },
            };
        }
        // SPEC-792 C2 (la grave): «ya pasó» NO eclipsa la encuesta. La tarjeta de la encuesta va ARRIBA
        // (su copy ya existe) y es el PRIMER camino: «Cuéntanos qué pasó». Acá NO se ofrece [Pedir otra
        // cita] en paralelo —era una vía de escape del motor de contradicciones: reprogramar sin responder
        // nunca—; reprogramar se llega DESPUÉS, por el desenlace «no» de la encuesta. Queda [Escríbenos].
        return {
            titulo: "Esta cita ya pasó",
            detalle: `La hora que tenías con ${nombreProfesional} ya pasó. Si algo no salió como esperabas, escríbenos.`,
            tono: "gris",
            acciones: { escribenos: true },
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
