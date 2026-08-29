export type EstadoRespuesta = "OK" | "RECHAZADO" | "REVISION";

export type PlantillaId = "sin-datos" | "un-numero" | "tabla" | "grafico";

export type Rol = "ADMIN" | "SCHOOL_ADMIN" | "PARENT";

export interface Usuario {
    id: string;
    rol: Rol;
    tenantId?: string;
}

export interface EntradaMotor {
    preguntaNL: string;
    usuario: Usuario;
}

export interface VotoJurado {
    modelo: string;
    sqlCrudo?: string;
    sqlCanonico?: string;
    error?: string;
    latenciaMs?: number;
}

export interface RespuestaMotor {
    estado: EstadoRespuesta;
    plantilla?: PlantillaId;
    respuestaNarrativa?: string;
    filas?: unknown[];
    graficoSpec?: object;
    sqlGenerado?: string;
    razon?: string;
    llamadasLlm: number;
    consultaLogId?: string;
    latenciaMs: number;
    cacheHit: boolean;
    votosJurado?: VotoJurado[];
}

export interface CatalogoTablaResuelto {
    tablasPermitidas: string[];
    columnasPorTabla: Record<string, string[]>;
    columnasExcluidas: Record<string, string[]>;
}

export interface SchemaJSON {
    schema: object;
    catalogoResuelto: CatalogoTablaResuelto;
}
