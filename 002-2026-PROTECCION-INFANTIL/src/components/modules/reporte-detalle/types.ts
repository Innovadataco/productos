import { CATEGORIAS_LABELS } from "@/lib/labels";

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

// SPEC-574 (I-357) · el desplegable DERIVA del mapa canónico `CATEGORIAS_LABELS` — UNA sola fuente.
// Antes era una lista paralela hardcodeada que se desincronizó del mapa (le faltaban las 3 de la Ley
// 2564; al mapa le faltaba SPAM): cada lista incompleta de forma distinta. Derivando, un rótulo nuevo
// aparece solo en el desplegable y no hay nada que se pueda desincronizar. El endpoint ya deriva del
// enum; ahora la UI deriva del mapa, y el candado ata el mapa al enum.
export const CATEGORIAS: { value: string; label: string }[] = Object.entries(CATEGORIAS_LABELS).map(
    ([value, label]) => ({ value, label }),
);

export { formatCategoria } from "@/lib/labels";

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
    categoriaClasificacion: string;
    setCategoriaClasificacion: (v: string) => void;
    notaClasificacion: string;
    setNotaClasificacion: (v: string) => void;
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
    deshacer: { categoria: string; nivelRiesgo: string } | null;
    handleDeshacerConfirmar: () => Promise<void>;
    descartarDeshacer: () => void;
    handleCorregir: () => Promise<void>;
    handleClasificar: () => Promise<void>;
    handleBaja: () => Promise<void>;
    handleReactivar: () => Promise<void>;
    handleRevelarOriginal: () => Promise<void>;
    handleValidarAnonimizacion: (valida: boolean) => Promise<void>;
    handleEscalar: () => Promise<void>;
    retry: number;
    setRetry: (v: number | ((prev: number) => number)) => void;
}
