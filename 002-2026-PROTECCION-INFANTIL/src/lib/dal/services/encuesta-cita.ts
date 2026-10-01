/**
 * SPEC-784 · DAL de la encuesta de servicio de la cita. La ÚNICA capa que toca Prisma para esta
 * feature (Q-3, frontera del DAL): la página y el endpoint delegan acá, no importan `@/lib/prisma`.
 *
 * Dos operaciones:
 *  - `citasPendientesEncuesta` — lee las citas del usuario con encuesta pendiente PARA ÉL (para pintar
 *    la tarjeta/bloque y montar el formulario). Deriva con la fuente única (`citasConEncuestaPendiente`).
 *  - `registrarEncuestaCita` — persiste la fila tipada y CRUZA con el otro lado (753) en una tx.
 *    Valida participación + estado + coherencia del CHECK; traduce el `@@unique` a 409.
 */
import { Prisma, type RolUsuario, type OperadorConvoco, type InicioSesion, type EnlaceFunciono, type DuracionSesion, type RazonNoSesion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { estadoEfectivoDeCita, type EntradaTiempo } from "@/lib/profesional/cita/estado-efectivo";
import {
    citasConEncuestaPendiente,
    esEncuestaPendientePara,
    origenParaRol,
    type CitaPendienteEncuesta,
} from "@/lib/profesional/cita/encuesta-pendiente";
import { cruzarEncuestasCita } from "@/lib/profesional/cita/encuestas-cita-cruce.service";

/** Las citas del usuario con encuesta pendiente para él (fuente única, ordenadas por más reciente). */
export function citasPendientesEncuesta(
    usuarioId: string,
    rol: RolUsuario,
    now: EntradaTiempo,
): Promise<CitaPendienteEncuesta[]> {
    return citasConEncuestaPendiente(usuarioId, rol, now, prisma);
}

export interface RegistrarEncuestaParams {
    readonly solicitudId: string;
    readonly usuarioId: string;
    readonly rol: RolUsuario;
    readonly seRealizo: boolean;
    readonly operador: OperadorConvoco;
    readonly inicio: InicioSesion;
    readonly enlace: EnlaceFunciono;
    readonly razonNoRealizo?: RazonNoSesion;
    readonly duracion?: DuracionSesion;
}

/**
 * Registra la encuesta de un lado y cruza. Sólo el padre/profesional de ESA cita (origen derivado del
 * rol, no del cliente), sólo si la cita pide encuesta, sólo la combinación coherente con el CHECK.
 * 2º envío del mismo lado → 409.
 */
export async function registrarEncuestaCita(
    params: RegistrarEncuestaParams,
): Promise<{ registrada: true; contradicciones: number }> {
    const origen = origenParaRol(params.rol);
    if (!origen) {
        throw new AppError("Tu rol no responde encuestas de cita.", ERROR_CODES.FORBIDDEN, 403);
    }

    const solicitud = await prisma.solicitudCita.findUnique({
        where: { id: params.solicitudId },
        select: {
            estado: true,
            padreUsuarioId: true,
            franja: { select: { inicio: true, fin: true } },
            profesional: { select: { usuarioId: true } },
        },
    });
    if (!solicitud) {
        throw new AppError("Cita no encontrada.", ERROR_CODES.NOT_FOUND, 404);
    }
    const participa =
        origen === "PADRE"
            ? solicitud.padreUsuarioId === params.usuarioId
            : solicitud.profesional.usuarioId === params.usuarioId;
    if (!participa) {
        throw new AppError("No participás en esta cita.", ERROR_CODES.FORBIDDEN, 403);
    }
    const estadoEfectivo = estadoEfectivoDeCita(
        solicitud.estado,
        solicitud.franja.inicio,
        solicitud.franja.fin,
        new Date(),
    );
    if (!esEncuestaPendientePara(estadoEfectivo, false)) {
        throw new AppError("Esta cita no admite encuesta.", ERROR_CODES.CONFLICT, 409);
    }

    return prisma.$transaction(async (tx) => {
        try {
            await tx.encuestaCita.create({
                data: {
                    solicitudId: params.solicitudId,
                    origen,
                    seRealizo: params.seRealizo,
                    operador: params.operador,
                    inicio: params.inicio,
                    enlace: params.enlace,
                    // Coerción espejo del CHECK (razón sii NO se realizó; duración sii SÍ).
                    razonNoRealizo: params.seRealizo ? null : params.razonNoRealizo ?? null,
                    duracion: params.seRealizo ? params.duracion ?? null : null,
                },
            });
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
                throw new AppError("Ya respondiste la encuesta de esta cita.", ERROR_CODES.CONFLICT, 409);
            }
            throw e;
        }
        const cruce = await cruzarEncuestasCita(params.solicitudId, tx);
        return { registrada: true, contradicciones: cruce.contradicciones.length };
    });
}
