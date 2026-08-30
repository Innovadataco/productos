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
    // SPEC-303 (002-PI-209): conteo real cruzando 3 rutas de pertenencia (I-98).
    totalReportesActividad: number;
    // SPEC-303 (002-PI-209): mensaje corto (≤ 60 chars) del hallazgo negativo con mayor peso; null si verde (I-104).
    motivoNoVerde: string | null;
}

// SPEC-303 (002-PI-209): shape del bloque umbrales que los endpoints admin devuelven
// junto con los datos, para que el frontend pinte la leyenda con umbrales vigentes.
export interface UmbralesSemaforoDTO {
    casosAbiertosAlto: number;
    casosSinMovimientoDias: number;
    porcentajeProcesadoMin: number;
    inactividadAlertaDias: number;
    spamAlertaPct: number;
    resolucionComiteOkPct: number;
    periodoDefaultDias: number;
}

// SPEC-303 (002-PI-209): bloque nuevo de la ficha detalle · actividad real cruzada.
export interface ActividadReportesCruzada {
    total: number;
    porEstado: Record<string, number>;
    casosAbiertos: number;
    ultimaActividad: string | null;
    rango: { desde: string; hasta: string; periodoDias: number };
}

// SPEC-311 (002-PI-210 · Fase 2): distribución por rol reportante del rango vigente.
// La categoría "estudiante" siempre vale 0 en el estado actual (no existe RolUsuario.STUDENT);
// reservada para futuro. Invariante: padre + estudiante + profesor + anonimo === ActividadReportesCruzada.total.
export interface DistribucionRolReportante {
    padre: number;
    estudiante: number;
    profesor: number;
    anonimo: number;
}

// SPEC-311 (002-PI-210 · Fase 2): operadores DISTINCT asignados a alertas del colegio.
export interface OperadorAsignado {
    id: string;
    nombre: string;
    email: string;
}

// SPEC-311 (002-PI-210 · Fase 2): línea de tiempo del colegio (Bloque C).
export interface LineaTiempoColegio {
    fechaRegistro: string;
    primerReporte: string | null;
    picoActividad: { anioMes: string; total: number } | null;
    hoy: string;
}

// SPEC-311 (002-PI-210 · Fase 2): serie mensual de reportes (Bloque B · alimenta TendenciaReportes).
export interface PuntoSerieMensual {
    anioMes: string;
    total: number;
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
    // SPEC-303 (002-PI-209): añadidos aditivos para cerrar I-98 y I-104.
    actividadReportesCruzada: ActividadReportesCruzada;
    umbralesSemaforo: UmbralesSemaforoDTO;
    // SPEC-311 (002-PI-210 · Fase 2): 4 bloques aditivos para el rediseño 4 bloques A→D.
    distribucionRol: DistribucionRolReportante;
    operadoresAsignados: OperadorAsignado[];
    lineaTiempo: LineaTiempoColegio;
    serieMensual: PuntoSerieMensual[];
}

export interface FiltrosResumenColegios {
    q?: string | undefined;
    ciudadId?: string | undefined;
    estado?: "activo" | "inactivo" | undefined;
    orden?: "nombre" | "reportesTotal" | "reportesUltimos30Dias" | "alertasEscaladas" | "casosProcesadosPct" | "fechaRegistro" | undefined;
    direccion?: "asc" | "desc" | undefined;
}
