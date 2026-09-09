/**
 * SPEC-604 (modelo EXPEDIENTE · cimientos) — el expediente nace SOLO.
 *
 * Deroga la creación manual de SPEC-340 (el botón «Crear expediente»): para el
 * padre autenticado, TODA cadena tiene expediente desde el evento 1. El primer
 * reporte de un identificador abre el expediente en la misma transacción del
 * alta; los eventos siguientes se suman al existente. El anónimo NO cambia:
 * reporte sin sesión → sin expediente (el modelo es solo del padre).
 *
 * La carrera de dos altas concurrentes del mismo padre+identificador ya está
 * cerrada AGUAS ARRIBA: `ReporteCreationService.crear` toma el advisory lock
 * por (usuario, identificador) dentro de la misma tx antes de llegar acá, así
 * que el segundo request o recibe la oferta de vinculación o ve el expediente
 * ya commitado. La idempotencia por reporte (un reporte entra UNA sola vez al
 * expediente) la garantiza `ExpedienteRepository.agregarEvento`.
 */
import { EstadoExpediente, type Prisma } from "@prisma/client";
import { ExpedienteRepository } from "../repositories/expediente-repository";

export interface ResultadoExpedienteAutomatico {
    expedienteId: string;
    /** true cuando este reporte ABRIÓ el expediente; false si se sumó a uno vivo. */
    creado: boolean;
}

/**
 * Asegura que el reporte del padre tenga expediente y quede registrado como
 * evento. Debe llamarse DENTRO de la transacción del alta (misma UoW).
 *
 * Reglas:
 * - Reporte anónimo (sin usuarioId) → null: el anónimo no tiene expedientes.
 * - Sin expediente para (padre, identificador) → se crea (origen AUTOMATICO,
 *   el default de la columna) y el reporte es su evento 1.
 * - Expediente vivo (cualquier estado salvo CERRADO) → el reporte se suma.
 * - El último expediente está CERRADO → el repositorio no acepta eventos en un
 *   cerrado; el reporte nuevo abre un ciclo NUEVO sobre el mismo identificador.
 */
export async function asegurarExpedienteParaReporte(
    tx: Prisma.TransactionClient,
    reporteId: string
): Promise<ResultadoExpedienteAutomatico | null> {
    const reporte = await tx.reporte.findUnique({
        where: { id: reporteId },
        select: { identificador: true, plataformaId: true, creadoEn: true, usuarioId: true },
    });
    // El identificador guardado es el canónico (normalizado por el embudo único
    // de ReporteCreationService) — el mismo valor con que cadenas-padre cruza
    // expediente ↔ tarjeta.
    if (!reporte || !reporte.usuarioId) return null;

    const repo = new ExpedienteRepository(tx);
    const ultimo = await tx.expediente.findFirst({
        where: { padreUsuarioId: reporte.usuarioId, identificadorReportado: reporte.identificador },
        orderBy: { fechaApertura: "desc" },
    });
    const vigente = ultimo && ultimo.estado !== EstadoExpediente.CERRADO ? ultimo : null;

    const expediente =
        vigente ??
        (await repo.crearExpediente({
            padreUsuarioId: reporte.usuarioId,
            identificadorReportado: reporte.identificador,
            plataformaId: reporte.plataformaId ?? undefined,
        }));

    // texto="" (AD-3 opción C, igual que el alta por botón de SPEC-340): el
    // evento sella su propio ContenidoReporte y el relato se descifra al leer.
    await repo.agregarEvento({
        expedienteId: expediente.id,
        texto: "",
        reporteId,
        fechaEvento: reporte.creadoEn,
    });

    return { expedienteId: expediente.id, creado: !vigente };
}
