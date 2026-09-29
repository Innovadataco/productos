/**
 * SPEC-784 · FUENTE ÚNICA de «¿esta cita tiene encuesta de servicio pendiente para este lado?».
 *
 * La consumen TODAS las superficies de la encuesta —el gate de página, el shell `/encuesta` y el
 * panel del profesional— para que «pendiente» sea UNA sola noción. Si el gate derivara «pendiente»
 * de una forma y el panel de otra, el usuario terminaría rebotado a una encuesta que ya respondió
 * (la costura entre dos candados correctos que ya nos mordió).
 *
 * NO hay flag `Usuario.encuestaPendiente` (D-2): «pendiente» se DERIVA del estado efectivo de la cita
 * (que ya cuenta el paso del tiempo, `estadoEfectivoDeCita`) + la AUSENCIA de una fila `EncuestaCita`
 * de ese `origen`. El disparador de #341 (subir un flag al cumplir la cita) se SUBSUME: no hay nada
 * que disparar, la verdad emerge del tiempo y de las filas.
 *
 * Núcleo PURO (`esEncuestaPendientePara`) sin BD para que el candado lo pruebe como unit; la envoltura
 * (`citasConEncuestaPendiente`) lee la BD con el cliente que le pasa el llamador (Q-3: sin singleton).
 */
import { Prisma, type PrismaClient, type RolUsuario, type OrigenEncuestaCita } from "@prisma/client";
import { estadoEfectivoDeCita, type EntradaTiempo, type EstadoEfectivoCita } from "./estado-efectivo";

/**
 * Los estados EFECTIVOS de una cita que PIDEN encuesta: el momento de la cita llegó y su desenlace
 * depende del AUTO-REPORTE de las partes.
 *
 * Incluye `NO_ASISTIO_*` A PROPÓSITO (veredicto CEO · D-2): el sistema NO mide asistencia (SPEC-750,
 * sin marcas de presencia), así que un `NO_ASISTIO_PADRE`/`NO_ASISTIO_PROFESIONAL` no es un hecho
 * medido sino la AFIRMACIÓN de una parte —casi siempre el profesional—. Sin encuestar al otro lado, la
 * familia que PAGÓ no tiene canal para decir «yo estuve, el profesional nunca se conectó»: es
 * exactamente `NO_PRESTACION_DICHA_PROFESIONAL` de 753, la entrada principal del motor de cruce.
 * Excluirlos dejaría al motor sin su caso más importante.
 *
 * Quedan FUERA (no piden encuesta): `PROXIMA`/`EN_CURSO` (la cita no ha terminado), `PAGADA_PENDIENTE`/
 * `SIN_CONFIRMAR` (aún no es una cita en pie), `VENCIDA_SIN_RESPUESTA`/`REEMBOLSADA`/`REPROGRAMADA`
 * (terminaron sin una sesión que reportar).
 */
export const ESTADOS_QUE_PIDEN_ENCUESTA = [
    "PASADA",
    "CUMPLIDA",
    "NO_ASISTIO_PADRE",
    "NO_ASISTIO_PROFESIONAL",
] as const satisfies readonly EstadoEfectivoCita[];

/** ¿Este estado efectivo pide encuesta? (miembro del conjunto de arriba). */
export function esEstadoQuePideEncuesta(estadoEfectivo: EstadoEfectivoCita): boolean {
    return (ESTADOS_QUE_PIDEN_ENCUESTA as readonly string[]).includes(estadoEfectivo);
}

/**
 * NÚCLEO PURO — la regla que el candado prueba. Una cita tiene encuesta pendiente PARA UN LADO
 * sii su estado efectivo pide encuesta Y ese lado todavía no respondió.
 *
 * `yaRespondidaEsteLado` = ya existe una fila `EncuestaCita` del `origen` de este usuario.
 */
export function esEncuestaPendientePara(
    estadoEfectivo: EstadoEfectivoCita,
    yaRespondidaEsteLado: boolean,
): boolean {
    if (yaRespondidaEsteLado) return false;
    return esEstadoQuePideEncuesta(estadoEfectivo);
}

/** El `origen` de la encuesta que le toca a un rol, o `null` si ese rol no responde encuesta de cita. */
export function origenParaRol(rol: RolUsuario): OrigenEncuestaCita | null {
    if (rol === "PARENT") return "PADRE";
    if (rol === "PROFESIONAL") return "PROFESIONAL";
    return null;
}

/** Cliente inyectado (Prisma o de transacción); nunca el singleton (Q-3). */
type ClienteDB = PrismaClient | Prisma.TransactionClient;

/** Una cita con encuesta pendiente para el usuario consultado. */
export interface CitaPendienteEncuesta {
    readonly solicitudId: string;
    readonly origen: OrigenEncuestaCita;
}

/**
 * Las citas del usuario con encuesta pendiente PARA ÉL, derivadas del estado efectivo + la ausencia
 * de su fila. Fuente única para el gate, el shell y el panel. `now` inyectado (sin reloj de pared);
 * hereda el fallo conservador de `estadoEfectivoDeCita` (tiempo inválido → `PASADA` → se pide de más,
 * nunca de menos).
 */
export async function citasConEncuestaPendiente(
    usuarioId: string,
    rol: RolUsuario,
    now: EntradaTiempo,
    db: ClienteDB,
): Promise<CitaPendienteEncuesta[]> {
    const origen = origenParaRol(rol);
    if (!origen) return [];

    // El lado del usuario en la cita: PADRE por su `padreUsuarioId`; PROFESIONAL por el
    // `usuarioId` de su `PerfilProfesional`.
    const where: Prisma.SolicitudCitaWhereInput =
        origen === "PADRE" ? { padreUsuarioId: usuarioId } : { profesional: { usuarioId } };

    const citas = await db.solicitudCita.findMany({
        where,
        select: {
            id: true,
            estado: true,
            franja: { select: { inicio: true, fin: true } },
            // Solo la fila de ESTE lado: su presencia = ya respondió.
            encuestasSesion: { where: { origen }, select: { id: true } },
        },
    });

    return citas
        .filter((c) =>
            esEncuestaPendientePara(
                estadoEfectivoDeCita(c.estado, c.franja.inicio, c.franja.fin, now),
                c.encuestasSesion.length > 0,
            ),
        )
        .map((c) => ({ solicitudId: c.id, origen }));
}
