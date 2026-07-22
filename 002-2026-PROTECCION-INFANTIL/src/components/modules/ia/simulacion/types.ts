export interface SimulacionRun {
    id: string;
    modelo: string;
    totalCasos: number;
    progreso: number;
    estado: string;
    fechaInicio: string;
    fechaFin: string | null;
    metricasJson: Record<string, unknown> | null;
    casosJson: unknown;
    createdAt: string;
    updatedAt: string;
    creadoPor: { email: string | null; nombre: string | null } | null;
}

export interface ResultadoCaso {
    indice: number;
    identificador: string;
    reporteId: string;
    estado: string;
    categoriaEsperada: string | null;
    categoriaAsignada: string;
    confianza: number | null;
    latenciaMs: number | null;
    modeloUsado: string | null;
    acierto: boolean | null;
}

export interface MetricaCategoriaUI {
    precision: number;
    recall: number;
    f1: number;
    support: number;
    aciertos: number;
    fallos: number;
}

export interface MetricasSimulacionUI {
    totalCasos: number;
    progreso: number;
    aciertos: number;
    fallos: number;
    omitidos: number;
    accuracy: number;
    porCategoria: Record<string, MetricaCategoriaUI>;
    matrizConfusion: Array<{ esperado: string; asignado: string; count: number }>;
    falsosNegativos: Array<{
        indice: number;
        identificador: string;
        esperado: string;
        asignado: string;
        confianza: number;
        estado: string;
    }>;
    latenciaPromedioMs: number;
    latenciaP50Ms: number;
    latenciaP95Ms: number;
    usoDesempate: { casos: number; porcentaje: number };
    distribucionEstados: Record<string, number>;
}

export interface ComparacionRunResumen {
    id: string;
    modelo: string;
    totalCasos: number;
    aciertos: number;
    fallos: number;
    accuracy: number;
    latenciaP50Ms: number;
    latenciaP95Ms: number;
    distribucionEstados: Record<string, number>;
}

export interface ComparacionResultadoCaso {
    runId: string;
    modelo: string;
    identificador: string;
    categoriaEsperada: string | null;
    categoriaAsignada: string;
    confianza: number | null;
    estado: string;
    acierto: boolean | null;
}

export interface ComparacionResultado {
    runs: ComparacionRunResumen[];
    filas: Array<{ indice: number; resultados: ComparacionResultadoCaso[] }>;
    advertencia?: string;
}

export interface OllamaModel {
    name: string;
    tag: string;
    size: number;
    esEmbedding: boolean;
}
