import { AuditLogRepository } from "@/lib/dal/repositories/audit-log";

export interface EventoAuditoriaColegio {
    id: string;
    accion: string;
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
            tipoRecurso: f.tipoRecurso,
            recursoId: f.recursoId,
            usuarioId: f.usuarioId,
            fecha: f.creadoEn.toISOString(),
            resumen: f.valorNuevo ? truncarResumen(f.valorNuevo) : null,
        })),
        pagination: {
            page: pageEfectiva,
            pageSize: pageSizeEfectiva,
            total,
            totalPages,
        },
    };
}

function truncarResumen(valor: string): string {
    if (valor.length <= 200) return valor;
    return `${valor.slice(0, 200)}…`;
}
