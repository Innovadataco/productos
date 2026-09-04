/**
 * SPEC-439 · el aviso al padre que YA reportó ese identificador.
 *
 * Es la promesa central del producto: *más gente reportando la misma cuenta =
 * señal más fuerte*. Hasta hoy esa corroboración se contaba en un número y a
 * nadie se le avisaba.
 *
 * **Tres poblaciones distintas, no una** (verificado en fuente el 04-09-2026):
 * - Quien se **suscribió** al identificador → `enviarAlertasSuscriptores` (ya existía).
 * - Quien lo **vigila** en su círculo → `notificarCambioCirculoSiCorresponde`
 *   (existía y estaba **sin cablear**; SPEC-439 la conecta).
 * - Quien lo **reportó** → nadie le avisaba. Es lo que hace este archivo.
 *   Reportar NO agrega el identificador al círculo (`reporte-creation.ts:47`),
 *   así que la tercera población no la cubre ninguna de las otras dos.
 *
 * **Reserva (A-60 · criterio 5).** El aviso lleva plataforma, ciudad, conducta y
 * el conteo. **Nunca** el texto del otro reporte ni la identidad de quien lo
 * hizo — es exactamente lo que el padre ya ve en sus cadenas (`cadenas-padre`).
 *
 * **No necesita enfriamiento propio.** Se dispara desde `detectarYRegistrarMatch`,
 * que es idempotente por `reporteNuevoId` (FR-004): como mucho un aviso por
 * reporte nuevo, ante cualquier reintento. El opt-out por usuario lo resuelve el
 * motor con `NotificacionPreferencia` — sin columna nueva ni migración.
 */
import { prisma } from "@/lib/prisma";
import { programar, despacharEnvios } from "@/lib/notificaciones/motor";
import { logger } from "@/lib/logger";

export const EVENTO_CORROBORACION = "reporte.corroborado_por_otro";

export interface AvisoCorroboracionInput {
    /** El reporte nuevo que corrobora. Su autor NO recibe el aviso. */
    reporteNuevoId: string;
    plataformaId: string;
    ciudad: string | null;
    categoria: string | null;
    conteoAcumulado: number;
    /** Autores de los reportes previos aprobados; anónimos vienen como `null`. */
    usuariosPrevios: ReadonlyArray<string | null>;
    /** Autor del reporte nuevo, para no avisarse a sí mismo. */
    autorNuevoId: string | null;
}

export interface ResultadoAviso {
    avisados: number;
    motivo?: string;
}

/**
 * Avisa a cada padre autenticado que ya había reportado este identificador.
 *
 * Fail-open a cargo del llamador: nunca debe tumbar la detección del match.
 */
export async function avisarPadresQueReportaron(input: AvisoCorroboracionInput): Promise<ResultadoAviso> {
    const destinatariosIds = [
        ...new Set(
            input.usuariosPrevios.filter(
                (id): id is string => id !== null && id !== input.autorNuevoId
            )
        ),
    ];
    if (destinatariosIds.length === 0) return { avisados: 0, motivo: "sin_padres_previos" };

    // Solo padres vivos. El motor resuelve el email y el opt-out por usuario.
    const padres = await prisma.usuario.findMany({
        where: { id: { in: destinatariosIds }, rol: "PARENT", estado: "activo" },
        select: { id: true },
    });
    if (padres.length === 0) return { avisados: 0, motivo: "sin_padres_activos" };

    const plataforma = await prisma.plataforma.findUnique({
        where: { id: input.plataformaId },
        select: { nombre: true },
    });

    const variables = {
        plataforma: plataforma?.nombre ?? "una plataforma",
        ciudad: input.ciudad ?? "una ciudad no especificada",
        conducta: input.categoria ?? "sin clasificar todavía",
        totalReportes: input.conteoAcumulado,
    };

    const resultado = await programar({
        evento: EVENTO_CORROBORACION,
        sujetoTipo: "Reporte",
        sujetoId: input.reporteNuevoId,
        destinatarios: padres.map((p) => ({ usuarioId: p.id, rol: "PARENT", variables })),
    });

    // Sin `tx` el motor despacha en línea y `envios` viene vacío; el `?? []`
    // es por el tipo opcional del contrato de SPEC-418, no por un caso vivo.
    await despacharEnvios(resultado.envios ?? []);
    return { avisados: resultado.programadas };
}

/**
 * Igual que la anterior pero tragándose el error y dejándolo en el log.
 * El llamador (`detectarYRegistrarMatch`) no puede fallar por un aviso.
 */
export async function avisarPadresQueReportaronSinFallar(input: AvisoCorroboracionInput): Promise<void> {
    try {
        await avisarPadresQueReportaron(input);
    } catch (err) {
        logger.error("[SPEC-439] No se pudo avisar a los padres que ya habían reportado", {
            reporteNuevoId: input.reporteNuevoId,
            error: err instanceof Error ? err.message : err,
        });
    }
}
