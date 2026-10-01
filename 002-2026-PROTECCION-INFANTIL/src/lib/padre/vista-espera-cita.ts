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
import type { EnlaceParaCita } from "@/lib/profesional/cita/enlace-derivado";

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
    // SPEC-792 · señales que refinan el «ya pasó» de una CONFIRMADA:
    //  · `enlace` (C4 · RIESGO) → el ESTADO del enlace de la reunión TAL CUAL lo derivó la fuente única
    //    (`enlace-derivado`), no un booleano ya colapsado. La decisión se toma ACÁ, no en el llamador,
    //    para que el `undefined` no sea un default silencioso: solo `estado === "PASADA"` (publicado y la
    //    hora pasó) prueba que el acceso estuvo; todo lo demás cae del lado que no acusa (ver abajo).
    //  · `citaId` → para que «pedir otra cita» herede el pago cuando el servicio no se entregó.
    // `enlace` admite `undefined` EXPLÍCITO a propósito: el bloque ausente es un caso con significado
    // (cita confirmada cuya hora pasó, sin estado de enlace → C4), no un descuido. Verlo obliga a tratarlo.
    opts: { enlace?: EnlaceParaCita | undefined; citaId?: string } = {},
): VistaEspera | null {
    const franjaYaPaso = estadoEfectivoDeCita("CONFIRMADA", franjaInicio, franjaFin, ahora) === "PASADA";
    if (!franjaYaPaso) return null;

    if (estado === "CONFIRMADA") {
        // SPEC-792 C4 (RIESGO): AMBOS copys exigen PRUEBA POSITIVA del estado del enlace — ninguno es el
        // "default por descarte" del otro. «Esta cita ya pasó» (C2) da por hecho que el acceso ESTUVO y la
        // hora se perdió (roza la culpa); «no dependió de ti» (C4) da por hecho que falló NUESTRO lado. Un
        // estado de cita VIVA (`SIN_PUBLICAR`/`PUBLICADO`: el reloj autoritativo del server —fuente única
        // 746— aún NO la da por pasada) NO es un sub-caso de «pasada» y no debe recibir ninguno de los dos:
        // cae al copy genérico de estado. Acá solo se LEE el estado ya derivado; no se cuenta el tiempo otra vez.
        const enlaceEstado = opts.enlace?.estado;
        if (enlaceEstado === "PASADA") {
            // C2 (la grave): el enlace se publicó y la hora pasó (prueba positiva). «ya pasó» NO eclipsa la
            // encuesta (tarjeta arriba, PRIMER camino: «Cuéntanos qué pasó»). NO se ofrece [Pedir otra cita]
            // en paralelo —era la vía de escape del motor de contradicciones (reprogramar sin responder
            // nunca)—; reprogramar se llega DESPUÉS por el desenlace «no» de la encuesta. Queda [Escríbenos].
            return {
                titulo: "Esta cita ya pasó",
                detalle: `La hora que tenías con ${nombreProfesional} ya pasó. Si algo no salió como esperabas, escríbenos.`,
                tono: "gris",
                acciones: { escribenos: true },
            };
        }
        if (enlaceEstado === "PASADA_SIN_PUBLICAR" || enlaceEstado === undefined || enlaceEstado === "INDETERMINADO") {
            // C4: falla NUESTRA probada (el enlace nunca se publicó al pasar la hora), O no sabemos el estado
            // del enlace DENTRO de una cita CONFIRMADA cuya hora ya pasó (`undefined` = bloque ausente;
            // `INDETERMINADO` = reloj no confiable) — no acusamos de algo que no consta. El pago se HEREDA
            // (servicio no consta entregado). Copy verbatim de Diseño (FORMA-SPEC792 C4).
            return {
                titulo: "El acceso a tu reunión no llegó a estar disponible.",
                detalle: `La hora de tu cita con ${nombreProfesional} ya pasó y el enlace para entrar no alcanzó a publicarse. Esto no dependió de ti. No perdiste tu cupo: puedes pedir otra cita, y si quieres que revisemos qué pasó, escríbenos.`,
                tono: "gris",
                acciones: { pedirOtraCita: true, escribenos: true, ...(opts.citaId ? { heredarDeCitaId: opts.citaId } : {}) },
            };
        }
        // `SIN_PUBLICAR`/`PUBLICADO`: una cita VIVA (no pasada según el reloj autoritativo). No es «pasada»
        // → se devuelve `null` y manda el copy de estado crudo, sin afirmar ni «ya pasó» ni «no dependió de ti».
        return null;
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
