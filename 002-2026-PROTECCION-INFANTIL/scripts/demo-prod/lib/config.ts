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
