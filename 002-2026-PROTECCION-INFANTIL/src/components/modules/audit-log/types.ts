import type { AccionAudit } from "@prisma/client";

export type UsuarioResumen = {
    nombre: string | null;
    email: string;
};

export type AuditLogItem = {
    id: string;
    accion: AccionAudit;
    tipoRecurso: string;
    recursoId: string | null;
    usuario: UsuarioResumen | null;
    creadoEn: string;
    valorNuevo: string | null;
};

export type Pagination = {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
};

export type AuditResponse = {
    items: AuditLogItem[];
    pagination: Pagination;
};

export type Filters = {
    selectedActions: AccionAudit[];
    fechaDesde: string;
    fechaHasta: string;
    q: string;
    recursoId: string;
};

export const DEFAULT_PAGE_SIZE = 25;

export function buildQueryParams(filters: Filters, page: number): URLSearchParams {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(DEFAULT_PAGE_SIZE));
    if (filters.selectedActions.length > 0) {
        params.set("acciones", filters.selectedActions.join(","));
    }
    if (filters.fechaDesde) params.set("fechaDesde", filters.fechaDesde);
    if (filters.fechaHasta) params.set("fechaHasta", filters.fechaHasta);
    if (filters.q.trim()) params.set("q", filters.q.trim());
    if (filters.recursoId.trim()) params.set("recursoId", filters.recursoId.trim());
    return params;
}

export function formatDate(iso: string): string {
    return new Date(iso).toLocaleString("es-CO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function formatValorNuevo(valor: string | null): string {
    if (!valor) return "—";
    try {
        const parsed = JSON.parse(valor);
        return JSON.stringify(parsed, null, 2);
    } catch {
        return valor;
    }
}
