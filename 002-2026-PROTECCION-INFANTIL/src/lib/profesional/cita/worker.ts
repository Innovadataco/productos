/**
 * SPEC-395 (L4) · workers de la cita profesional.
 *
 * Dos barredores + una regla del profesional:
 *
 *  1) `barrerAvisoVencimiento48h(now)` — el reloj del profesional.
 *     Toma solicitudes PAGADA_PENDIENTE con `pagoAprobadoEn + 48h` pasado, las
 *     marca VENCIDA_SIN_RESPUESTA, libera la franja, y avisa al padre con el
 *     contacto abierto. **Candado de repetición (patrón I-280)**: consulta el
 *     último audit `CITA_PROFESIONAL_AVISO_48H_ENVIADO` y salta si
 *     `audit.creadoEn >= solicitud.actualizadoEn`. El aviso solo se marca tras
 *     enviar bien (si el correo trueca, la siguiente vuelta reintenta).
 *     Después de vencer, evalúa suspensión y alarma del profesional.
 *
 *  2) `barrerPlazoPagoDelPadre(now)` — el plazo del padre.
 *     Toma solicitudes SIN_CONFIRMAR con `venceEn` pasado (sin pago aprobado),
 *     las marca VENCIDA_SIN_RESPUESTA y **libera la franja** — si no, cualquiera
 *     bloquea la agenda de un profesional sin poner un peso (aviso CEO 09:50).
 */
import { logAudit } from "@/lib/audit";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { AuditLogRepository } from "@/lib/dal/repositories/audit-log";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { FranjaDisponibleRepository } from "@/lib/dal/repositories/franja-disponible";
import { evaluarSuspensionYAlarma } from "./cita.service";

/**
 * @internal — expuesto para el test. Idempotencia del aviso 48h.
 * Devuelve la fecha del último aviso emitido para esta solicitud, o null.
 */
export function ultimoAviso48h(solicitudId: string): Promise<{ creadoEn: Date } | null> {
    return new AuditLogRepository().ultimoPorAccionYRecurso("CITA_PROFESIONAL_AVISO_48H_ENVIADO", solicitudId);
}

export interface ResumenBarridoAviso48h {
    encontradas: number;
    avisadas: number;
    saltadas: number;
    profesionalesEvaluados: number;
}

export async function barrerAvisoVencimiento48h(
    now: Date = new Date()
): Promise<ResumenBarridoAviso48h> {
    const repo = new SolicitudCitaRepository();
    const candidatas = await repo.listarVencidasSinAvisar48h(now);
    const resumen: ResumenBarridoAviso48h = {
        encontradas: candidatas.length,
        avisadas: 0,
        saltadas: 0,
        profesionalesEvaluados: 0,
    };
    const profesionalesTocados = new Set<string>();
    for (const solicitud of candidatas) {
        // Candado I-280: si ya avisamos DESPUÉS del último cambio de la
        // solicitud, no repetimos hasta que el estado se mueva.
        const prev = await ultimoAviso48h(solicitud.id);
        if (prev && prev.creadoEn.getTime() >= solicitud.actualizadoEn.getTime()) {
            resumen.saltadas += 1;
            continue;
        }
        // Mueve el estado y libera la franja, atómico.
        await withUnitOfWork(async (tx) => {
            await new SolicitudCitaRepository(tx).marcarVencida48h(solicitud.id);
            await new FranjaDisponibleRepository(tx).liberar(solicitud.franjaId);
        });
        // El audit se registra SOLO tras el cambio; el candado se compara con
        // `solicitud.actualizadoEn` que Prisma recalculó al marcar vencida.
        await logAudit({
            accion: "CITA_PROFESIONAL_AVISO_48H_ENVIADO",
            tipoRecurso: "SolicitudCita",
            recursoId: solicitud.id,
            ipAddress: "worker",
            userAgent: "cita/aviso-48h",
        });
        resumen.avisadas += 1;
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
