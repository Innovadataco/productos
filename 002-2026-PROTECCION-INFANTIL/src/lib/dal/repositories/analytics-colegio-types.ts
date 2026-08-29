/**
 * SPEC-194 (002-PI-088): tipos y DTOs del repositorio de analítica de colegios.
 * Ningún DTO expone texto de reporte, identificador de menor ni datos del denunciante.
 */

export interface ColegioResumenItem {
    id: string;
    nombre: string;
    ciudad: string;
    departamento: string | null;
    fechaRegistro: string;
    estado: "activo" | "inactivo";
    alumnos: number;
    profesores: number;
    reportesUltimos30Dias: number;
    reportesTotal: number;
    alertasEscaladas: number;
    casosProcesadosPct: number;
    semaforo: "verde" | "amarillo" | "rojo";
}

export interface SerieTemporalPunto {
    fecha: string;
    total: number;
}

export interface TopIdentificadorItem {
    identificador: string;
    plataforma: string;
    total: number;
}

export interface MetricasComite {
    integrantesActivos: number;
    casosEscalados: number;
    casosResueltos: number;
    tiempoPromedioResolucionHoras: number | null;
    ultimosCasos: Array<{ numero: string; estado: string; creadoEn: string; resueltoEn: string | null }>;
}

export interface MetricasAlertas {
    total: number;
    resueltas: number;
    ultimasAlertas: Array<{ id: string; estado: string; tipoSujeto: string; creadoEn: string }>;
}

export interface ComparacionMetrica {
    nombre: string;
    valorColegio: number;
    mediana: number | null;
}

export interface ColegioDetalleResponse {
    id: string;
    infoBasica: {
        nombre: string;
        tipoPeriodo: string;
        ciudad: string;
        departamento: string | null;
        direccion: string | null;
        fechaRegistro: string;
        contactoRector: { nombre: string; email: string } | null;
    };
    metricasTamaño: { alumnos: number; profesores: number; cursos: number; materias: number };
    actividadReportes: {
        serie30Dias: SerieTemporalPunto[];
        porClasificacion: Array<{ categoria: string; total: number }>;
        topIdentificadores: TopIdentificadorItem[];
    };
    comite: MetricasComite;
    alertas: MetricasAlertas;
    hallazgos: { positivos: string[]; negativos: string[]; semaforo: "verde" | "amarillo" | "rojo" };
    comparacionMedia: { metricas: ComparacionMetrica[]; insuficientes: boolean };
}

export interface FiltrosResumenColegios {
    q?: string | undefined;
    ciudadId?: string | undefined;
    estado?: "activo" | "inactivo" | undefined;
    orden?: "nombre" | "reportesTotal" | "reportesUltimos30Dias" | "alertasEscaladas" | "casosProcesadosPct" | "fechaRegistro" | undefined;
    direccion?: "asc" | "desc" | undefined;
}
