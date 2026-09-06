import { AuditLogRepository } from "@/lib/dal/repositories/audit-log";
import { resumenAuditoriaColegio, accionLabelColegio } from "@/lib/colegio/confianza-auditoria-resumen";

export interface EventoAuditoriaColegio {
    id: string;
    accion: string;
    /** Etiqueta humana de la acción (SPEC-576): «Integrante de comité agregado», no el enum crudo. */
    accionLabel: string;
    tipoRecurso: string;
    recursoId: string | null;
    usuarioId: string | null;
    fecha: string;
    resumen: string | null;
}

export interface AuditoriaColegioResultado {
    items: EventoAuditoriaColegio[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

const MAX_DIAS = 90;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * Devuelve eventos de auditoría de un colegio en los últimos N días.
 * No expone IPs en claro ni textos de reportes.
 */
export async function listarAuditoriaColegio(
    colegioId: string,
    dias: number,
    page: number,
    pageSize: number
): Promise<AuditoriaColegioResultado> {
    const diasEfectivos = Math.min(Math.max(1, dias), MAX_DIAS);
    const pageEfectiva = Math.max(1, page);
    const pageSizeEfectiva = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);

    const desde = new Date();
    desde.setDate(desde.getDate() - diasEfectivos);

    const where = {
        colegioId,
        creadoEn: { gte: desde },
    };

    const [filas, total] = await new AuditLogRepository().findPaginadosConUsuario(where, {
        skip: (pageEfectiva - 1) * pageSizeEfectiva,
        take: pageSizeEfectiva,
    });

    const totalPages = Math.ceil(total / pageSizeEfectiva);

    return {
        items: filas.map((f) => ({
            id: f.id,
            accion: f.accion,
            accionLabel: accionLabelColegio(f.accion),
            tipoRecurso: f.tipoRecurso,
            recursoId: f.recursoId,
            usuarioId: f.usuarioId,
            fecha: f.creadoEn.toISOString(),
            // SPEC-576 (I-358): frase DECLARADA en español o null (→ «—» en la UI). NUNCA el payload:
            // el origen manda frase-o-null, no JSON — la diferencia entre tapar el síntoma (formatear
            // el JSON) y cerrar el canal (una lista declarada por acción).
            resumen: resumenAuditoriaColegio(f.accion, f.valorNuevo),
        })),
        pagination: {
            page: pageEfectiva,
            pageSize: pageSizeEfectiva,
            total,
            totalPages,
        },
    };
}
