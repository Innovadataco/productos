import type { CategoriaConducta } from "@prisma/client";

export const CORRIDA = "demo-002-PI-059";

export const NUM_COLEGIOS = 5;
export const CURSOS_POR_COLEGIO = 10;
export const ESTUDIANTES_POR_CURSO = 20;
export const IDENTIFICADORES_POR_ESTUDIANTE = 5;
export const NUM_OPERADORES = 12;
export const NUM_PADRES = 55;
export const PADRES_CON_CIRCULO = 20;
export const NUM_REPORTES = 250;
export const FRACCION_ANONIMOS = 0.7;
export const DIAS_HISTORICOS_MAX = 180;
export const DIAS_FRESCOS_MAX = 7;

/**
 * SPEC-499 · volumen del sembrado. El flag `--min` (VOLUMEN MÍNIMO) siembra
 * UN colegio y lo mínimo para caminar los flujos, sin las 5×10×20 filas del
 * volumen completo — para poblar prod rápido cuando solo se quiere probar el
 * ciclo de cita o una demo liviana. El profesional demo se siembra en AMBOS
 * modos (es aditivo y de una sola fila).
 */
export interface VolumenSeed {
    NUM_COLEGIOS: number;
    CURSOS_POR_COLEGIO: number;
    ESTUDIANTES_POR_CURSO: number;
    NUM_OPERADORES: number;
    NUM_PADRES: number;
    PADRES_CON_CIRCULO: number;
    NUM_REPORTES: number;
}

export const VOLUMEN_COMPLETO: VolumenSeed = {
    NUM_COLEGIOS,
    CURSOS_POR_COLEGIO,
    ESTUDIANTES_POR_CURSO,
    NUM_OPERADORES,
    NUM_PADRES,
    PADRES_CON_CIRCULO,
    NUM_REPORTES,
};

export const VOLUMEN_MINIMO: VolumenSeed = {
    NUM_COLEGIOS: 1,
    CURSOS_POR_COLEGIO: 2,
    ESTUDIANTES_POR_CURSO: 3,
    NUM_OPERADORES: 1,
    NUM_PADRES: 3,
    PADRES_CON_CIRCULO: 1,
    NUM_REPORTES: 8,
};

export const CATEGORIAS_PESOS: { categoria: CategoriaConducta; peso: number }[] = [
    { categoria: "CONTACTO_INSISTENTE", peso: 0.2 },
    { categoria: "SOLICITUD_MATERIAL", peso: 0.15 },
    { categoria: "OFRECIMIENTO_REGALOS", peso: 0.15 },
    { categoria: "SUPLANTACION_IDENTIDAD", peso: 0.15 },
    { categoria: "SOLICITUD_ENCUENTRO", peso: 0.15 },
    { categoria: "COMPARTIMIENTO_SEXUAL", peso: 0.15 },
    { categoria: "OTRO", peso: 0.05 },
];

export const ESTADOS_HISTORICOS: { estado: "CLASIFICADO" | "REVISION_MANUAL" | "POSIBLE_SPAM" | "CORREGIDO"; peso: number }[] = [
    { estado: "CLASIFICADO", peso: 0.6 },
    { estado: "REVISION_MANUAL", peso: 0.15 },
    { estado: "POSIBLE_SPAM", peso: 0.1 },
    { estado: "CORREGIDO", peso: 0.15 },
];
