/**
 * SPEC-824 · La bandeja del operador/admin para la Puerta de Soporte (SPEC-819). CABLEA
 * `estado-efectivo-peticion.ts` (deja de ser hueco-funcional): el estado del reloj es FUENTE ÚNICA, igual
 * que la bandeja de incidentes de 787 cablea `estado-efectivo-incidente`.
 *
 * Principios (radicado SPEC-824):
 *  - Orden por el VENCIMIENTO real. Para una habeas data el vencimiento real es el del caso legal ENLAZADO
 *    (la bandeja DERIVA por el enlace, no copia — candado de 752), NO el término interno de la PQR.
 *  - SEPARAR lo legal de lo demás: una obligación con término no puede perderse entre quejas de plataforma.
 *  - 🔒 CERO contenido del titular: el DTO es metadata (motivo, tipo de acción, relojes). Nada de «de quién»
 *    ni del dato. La fila legal está despojada a propósito (sobrevive a una supresión); leer la bandeja no
 *    revela qué se pidió borrar.
 *  - Superficie 100% interna (operador/admin). Este DTO no se expone a padre ni profesional.
 */
import type { MotivoPeticionServicio, TipoSolicitudHabeasData } from "@prisma/client";
import { PeticionServicioRepository, type FilaBandejaPeticion } from "@/lib/dal/repositories/peticion-servicio";
import { estadoEfectivoPeticion, esPeticionIncumplida, type EstadoPeticionServicio } from "./estado-efectivo-peticion";
import { motivoTieneTerminoLegal } from "./plazo-peticion";
import { diasHabilesTranscurridosColombia } from "@/lib/fechas/dias-habiles-colombia";

export interface PeticionBandejaDto {
    id: string;
    /** ¿Obligación con término legal? (habeas data, o reversión de pago). Fuente única: `motivoTieneTerminoLegal`. */
    esLegal: boolean;
    motivo: MotivoPeticionServicio;
    /** Solo para habeas data: la ACCIÓN pedida (ver/corregir/pedir borrar). NUNCA el contenido ni el sujeto. */
    tipoHabeas: TipoSolicitudHabeasData | null;
    /** Vencimiento EFECTIVO (legal enlazado si lo hay; si no, el término interno de la PQR). */
    venceEn: string;
    /** Hábiles restantes hasta el vencimiento efectivo (negativo si ya venció). */
    quedanDiasHabiles: number;
    estado: EstadoPeticionServicio;
    /** Fuente ÚNICA del incumplimiento (incluye RESUELTA_TARDE). */
    incumplida: boolean;
    creadoEn: string;
}

export interface BandejaPeticionesDto {
    /** Obligaciones con término, ordenadas por vencimiento efectivo (lo urgente primero). */
    legales: PeticionBandejaDto[];
    /** El resto (cita, plataforma, otra), ordenadas por su término interno. */
    otras: PeticionBandejaDto[];
    resumen: { total: number; incumplidas: number; legalesAbiertas: number };
}

/** Vencimiento EFECTIVO: el del caso legal enlazado si existe (habeas data), si no el de la PQR. */
function venceEnEfectivo(fila: FilaBandejaPeticion): Date {
    return fila.solicitudHabeasData?.venceEn ?? fila.venceEn;
}

export function aPeticionBandejaDto(fila: FilaBandejaPeticion, now: Date): PeticionBandejaDto {
    const vence = venceEnEfectivo(fila);
    const estado = estadoEfectivoPeticion(fila.resueltoEn, vence, now);
    return {
        id: fila.id,
        esLegal: motivoTieneTerminoLegal(fila.motivo),
        motivo: fila.motivo,
        tipoHabeas: fila.solicitudHabeasData?.tipo ?? null,
        venceEn: vence.toISOString(),
        quedanDiasHabiles: diasHabilesTranscurridosColombia(now, vence),
        estado,
        incumplida: esPeticionIncumplida(estado),
        creadoEn: fila.creadoEn.toISOString(),
    };
}

/** La bandeja: peticiones abiertas, separadas legal/otras, cada grupo ordenado por vencimiento efectivo. */
export async function listarBandejaPeticiones(now: Date = new Date()): Promise<BandejaPeticionesDto> {
    const filas = await new PeticionServicioRepository().listarAbiertas();
    const dtos = filas.map((f) => aPeticionBandejaDto(f, now));
    const porVencimiento = (a: PeticionBandejaDto, b: PeticionBandejaDto) => a.venceEn.localeCompare(b.venceEn);
    const legales = dtos.filter((d) => d.esLegal).sort(porVencimiento);
    const otras = dtos.filter((d) => !d.esLegal).sort(porVencimiento);
    return {
        legales,
        otras,
        resumen: {
            total: dtos.length,
            incumplidas: dtos.filter((d) => d.incumplida).length,
            legalesAbiertas: legales.length,
        },
    };
}
