/**
 * SPEC-395 (L4) · workers de la cita profesional.
 *
 * Dos barredores + una regla del profesional:
 *
 *  1) `barrerAvisoVencimiento48h(now)` — el reloj del profesional.
 *     Toma solicitudes PAGADA_PENDIENTE con `pagoAprobadoEn + 48h` pasado, las
 *     marca VENCIDA_SIN_RESPUESTA (vencida POR el profesional: tuvo 48 h y no
 *     respondió) y libera la franja para que otro padre la tome. Registra el
 *     audit `CITA_PROFESIONAL_VENCIDA_PROFESIONAL` —el hecho que SÍ ocurre—,
 *     simétrico con `PAGO_EXPIRADA` del otro barredor. Después de vencer,
 *     evalúa suspensión y alarma del profesional.
 *
 *     Idempotencia (SPEC-657): NO por audit, sino por la transición one-way de
 *     estado. `listarVencidasSinAvisar48h` filtra por `estado: PAGADA_PENDIENTE`;
 *     al marcar VENCIDA la solicitud sale del conjunto de candidatas para
 *     siempre, así que una segunda corrida no la reprocesa. (Antes había un skip
 *     por el audit `AVISO_48H_ENVIADO`; defendía una transición que la máquina de
 *     estados ya hace imposible — se quitó con su lógica, decisión CEO SPEC-657.)
 *
 *     NOTA (I-385): este barredor todavía NO avisa al padre. El aviso queda en
 *     espera de la política de reembolso (decisión de Jelkin); hasta entonces no
 *     se escribe copy ni variables de aviso. El padre ya ve la cita como
 *     cancelada en "Mis citas". El nombre `Aviso…` es aspiracional: cuando el
 *     aviso exista, vive acá.
 *
 *  2) `barrerPlazoPagoDelPadre(now)` — el plazo del padre.
 *     Toma solicitudes SIN_CONFIRMAR con `venceEn` pasado (sin pago aprobado),
 *     las marca VENCIDA_SIN_RESPUESTA y **libera la franja** — si no, cualquiera
 *     bloquea la agenda de un profesional sin poner un peso (aviso CEO 09:50).
 *     Registra `CITA_PROFESIONAL_PAGO_EXPIRADA`.
 */
import { logAudit } from "@/lib/audit";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { FranjaDisponibleRepository } from "@/lib/dal/repositories/franja-disponible";
import { evaluarSuspensionYAlarma } from "./cita.service";

export interface ResumenBarridoAviso48h {
    encontradas: number;
    vencidas: number;
    profesionalesEvaluados: number;
}

export async function barrerAvisoVencimiento48h(
    now: Date = new Date()
): Promise<ResumenBarridoAviso48h> {
    const repo = new SolicitudCitaRepository();
    const candidatas = await repo.listarVencidasSinAvisar48h(now);
    const resumen: ResumenBarridoAviso48h = {
        encontradas: candidatas.length,
        vencidas: 0,
        profesionalesEvaluados: 0,
    };
    const profesionalesTocados = new Set<string>();
    for (const solicitud of candidatas) {
        // Mueve el estado y libera la franja, atómico. La transición one-way a
        // VENCIDA saca a la solicitud del conjunto PAGADA_PENDIENTE para
        // siempre: eso es lo que da idempotencia, no un audit (SPEC-657).
        await withUnitOfWork(async (tx) => {
            await new SolicitudCitaRepository(tx).marcarVencida48h(solicitud.id);
            await new FranjaDisponibleRepository(tx).liberar(solicitud.franjaId);
        });
        // Audit VERAZ del hecho que ocurre: la cita venció por el profesional.
        // NO es un aviso — nada se le envía al padre todavía (ver NOTA I-385).
        await logAudit({
            accion: "CITA_PROFESIONAL_VENCIDA_PROFESIONAL",
            tipoRecurso: "SolicitudCita",
            recursoId: solicitud.id,
            ipAddress: "worker",
            userAgent: "cita/vencimiento-48h",
        });
        resumen.vencidas += 1;
        profesionalesTocados.add(solicitud.profesionalId);
    }
    // Después de cada barrido, evalúa suspensión y alarma por profesional
    // que quedó con al menos una vencida nueva (evita evaluar a todos).
    for (const profesionalId of profesionalesTocados) {
        await evaluarSuspensionYAlarma(profesionalId);
        resumen.profesionalesEvaluados += 1;
    }
    return resumen;
}

export interface ResumenBarridoPlazoPago {
    encontradas: number;
    expiradas: number;
    franjasLiberadas: number;
}

export async function barrerPlazoPagoDelPadre(
    now: Date = new Date()
): Promise<ResumenBarridoPlazoPago> {
    const repo = new SolicitudCitaRepository();
    const candidatas = await repo.listarSinConfirmarConPlazoVencido(now);
    const resumen: ResumenBarridoPlazoPago = {
        encontradas: candidatas.length,
        expiradas: 0,
        franjasLiberadas: 0,
    };
    for (const solicitud of candidatas) {
        await withUnitOfWork(async (tx) => {
            await new SolicitudCitaRepository(tx).marcarVencida48h(solicitud.id);
            await new FranjaDisponibleRepository(tx).liberar(solicitud.franjaId);
        });
        await logAudit({
            accion: "CITA_PROFESIONAL_PAGO_EXPIRADA",
            tipoRecurso: "SolicitudCita",
            recursoId: solicitud.id,
            ipAddress: "worker",
            userAgent: "cita/plazo-pago",
        });
        resumen.expiradas += 1;
        resumen.franjasLiberadas += 1;
    }
    return resumen;
}

export interface ResumenBarridoCitas {
    aviso48h: ResumenBarridoAviso48h;
    plazoPago: ResumenBarridoPlazoPago;
}

/**
 * SPEC-657 (I-389) · la corrida del worker de citas: invoca los DOS barredores.
 * Antes de SPEC-657 estos barredores estaban escritos, probados y con candado de
 * repetición, pero NADIE los llamaba — función construida y nunca cableada. Esta
 * es la corrida que el worker (`scripts/worker-citas.mjs`) ejecuta cada 15 min.
 */
export async function ejecutarBarridoCitas(now: Date = new Date()): Promise<ResumenBarridoCitas> {
    const aviso48h = await barrerAvisoVencimiento48h(now);
    const plazoPago = await barrerPlazoPagoDelPadre(now);
    return { aviso48h, plazoPago };
}
