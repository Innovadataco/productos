export type DetalleReporte = {
    id: string;
    identificador: string;
    plataforma: { nombre: string; clave: string };
    texto: string;
    estado: string;
    ciudad: string;
    pais: string;
    fechaIncidente: string;
    esAnonimo: boolean;
    numeroSeguimiento: string;
    creadoEn: string;
    prioridadAlta: boolean;
    keywordsDetectadas: string[];
    esRafaga: boolean;
    eliminado: boolean;
    motivoBaja: string | null;
    notaBaja: string | null;
    eliminadoEn: string | null;
    clasificacion?: {
        categoria: string;
        confianza: number;
        contienePii: boolean;
        piiDetectada: string[];
        modeloUsado: string;
        latenciaMs: number;
        categoriasSecundarias: { categoria: string; score: number }[];
        posibleAgresorPar: boolean;
        correccion: {
            categoriaCorregida: string;
            categoriaOriginal: string;
            motivo: string | null;
            creadoEn: string;
        } | null;
    } | null;
    reintentos?: {
        id: string;
        intento: number;
        exitoso: boolean;
        error: string | null;
        creadoEn: string;
    }[];
};

export const CATEGORIAS = [
    { value: "CONTACTO_INSISTENTE", label: "Contacto insistente" },
    { value: "SOLICITUD_MATERIAL", label: "Solicitud de material" },
    { value: "OFRECIMIENTO_REGALOS", label: "Ofrecimiento de regalos" },
    { value: "SUPLANTACION_IDENTIDAD", label: "Suplantación de identidad" },
    { value: "SOLICITUD_ENCUENTRO", label: "Solicitud de encuentro" },
    { value: "COMPARTIMIENTO_SEXUAL", label: "Compartimiento sexual" },
    { value: "EXTORSION", label: "Extorsión" },
    { value: "CONTENIDO_GENERADO_IA", label: "Contenido generado por IA" },
    { value: "DIFUSION_NO_CONSENTIDA", label: "Difusión no consentida" },
    { value: "DOXING", label: "Doxing" },
    { value: "SPAM", label: "Spam" },
    { value: "OTRO", label: "Otro" },
];

export function formatCategoria(categoria: string) {
    return CATEGORIAS.find((c) => c.value === categoria)?.label || categoria;
}

export function formatEstado(estado: string) {
    return estado.replace(/_/g, " ");
}

export interface UseReporteDetalleResult {
    reporte: DetalleReporte | null;
    loading: boolean;
    error: string;
    success: string;
    textoAnonimizado: string;
    setTextoAnonimizado: (v: string) => void;
    categoriaCorreccion: string;
    setCategoriaCorreccion: (v: string) => void;
    motivoCorreccion: string;
    setMotivoCorreccion: (v: string) => void;
    actionLoading: boolean;
    confirmando: boolean;
    mostrarBaja: boolean;
    setMostrarBaja: (v: boolean) => void;
    motivoBaja: string;
    setMotivoBaja: (v: string) => void;
    notaBaja: string;
    setNotaBaja: (v: string) => void;
    mostrarReactivar: boolean;
    setMostrarReactivar: (v: boolean) => void;
    notaReactivar: string;
    setNotaReactivar: (v: string) => void;
    puedeRevelarOriginal: boolean;
    textoOriginalRevelado: string | null;
    loadingRevelar: boolean;
    observacionesValidacion: string;
    setObservacionesValidacion: (v: string) => void;
    validando: boolean;
    puedeEscalar: boolean;
    mostrarEscalar: boolean;
    setMostrarEscalar: (v: boolean) => void;
    motivoEscalar: string;
    setMotivoEscalar: (v: string) => void;
    handleAnonimizar: () => Promise<void>;
    handleConfirmar: () => Promise<void>;
    handleCorregir: () => Promise<void>;
    handleBaja: () => Promise<void>;
    handleReactivar: () => Promise<void>;
    handleRevelarOriginal: () => Promise<void>;
    handleValidarAnonimizacion: (valida: boolean) => Promise<void>;
    handleEscalar: () => Promise<void>;
    retry: number;
    setRetry: (v: number | ((prev: number) => number)) => void;
}
