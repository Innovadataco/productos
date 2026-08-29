import { EstadoGuiaAccion } from "@prisma/client";

export interface Guia {
    id: string;
    categoria: string;
    versionSecuencial: number;
    tituloEmocional: string;
    subtitulo: string | null;
    categoriaBadgeTexto: string;
    pasosJson: unknown;
    calloutTitulo: string | null;
    calloutTexto: string | null;
    botonesAccionJson: unknown;
    piePagina: string | null;
    estado: EstadoGuiaAccion;
    aprobadaPorComiteJson: unknown;
    creadaPorAdminId: string;
    createdAt: string;
    publicadaEn: string | null;
    reemplazadaEn: string | null;
    creadaPor?: { id: string; email: string; nombre: string | null } | null;
}

export interface Pagination {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

export type Paso = {
    orden: number;
    tipo: "TRANQUILIDAD" | "ATENCION" | "ACCION" | "URGENCIA";
    titulo: string;
    descripcion: string;
};

export type Boton = {
    tipo: "tel" | "url";
    texto: string;
    subtexto?: string;
    valor: string;
    estilo: "primario" | "urgente" | "secundario";
};

export function pasosFrom(json: unknown): Paso[] {
    if (!Array.isArray(json)) return [];
    return json.filter((p) => p && typeof p === "object" && "orden" in p && "titulo" in p) as Paso[];
}

export function botonesFrom(json: unknown): Boton[] {
    if (!Array.isArray(json)) return [];
    return json.filter((b) => b && typeof b === "object" && "texto" in b) as Boton[];
}
