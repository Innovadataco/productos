/**
 * SPEC-166: cálculo determinista de prioridad y SLA para alertas de colegio.
 * Los pesos y horizontes SLA se pueden configurar vía ParametroSistema;
 * si no existen, se usan defaults seguros documentados.
 */
import type { CategoriaConducta } from "@prisma/client";

export type PrioridadAlerta = "alta" | "media" | "baja";

export type ConfiguracionPrioridad = {
    pesos: {
        categoria: Record<CategoriaConducta, number>;
        confianzaAlta: number;
        confianzaMedia: number;
        posibleAgresorPar: number;
        matchMayorIgual3: number;
        matchMayorIgual2: number;
        matchInterCiudad: number;
    };
    umbrales: {
        alta: number;
        media: number;
    };
    slaHoras: {
        alta: number;
        media: number;
        baja: number;
    };
};

const CATEGORIAS_CRITICAS: CategoriaConducta[] = [
    "SOLICITUD_ENCUENTRO",
    "COMPARTIMIENTO_SEXUAL",
    "DIFUSION_NO_CONSENTIDA",
    "DOXING",
    "EXTORSION",
];

const CATEGORIAS_ALTAS: CategoriaConducta[] = [
    "SUPLANTACION_IDENTIDAD",
    "OFRECIMIENTO_REGALOS",
    "SOLICITUD_MATERIAL",
];

const CATEGORIAS_MEDIAS: CategoriaConducta[] = ["CONTACTO_INSISTENTE", "CONTENIDO_GENERADO_IA"];

function pesosCategoriaPorDefecto(): Record<CategoriaConducta, number> {
    const map = new Map<CategoriaConducta, number>();
    for (const c of CATEGORIAS_CRITICAS) map.set(c, 3);
    for (const c of CATEGORIAS_ALTAS) map.set(c, 2);
    for (const c of CATEGORIAS_MEDIAS) map.set(c, 1);
    map.set("OTRO", 0);
    map.set("SPAM", 0);
    return Object.fromEntries(map) as Record<CategoriaConducta, number>;
}

export const CONFIG_DEFAULT: ConfiguracionPrioridad = {
    pesos: {
        categoria: pesosCategoriaPorDefecto(),
        confianzaAlta: 2,
        confianzaMedia: 1,
        posibleAgresorPar: 2,
        matchMayorIgual3: 3,
        matchMayorIgual2: 2,
        matchInterCiudad: 1,
    },
    umbrales: { alta: 6, media: 3 },
    slaHoras: { alta: 24, media: 48, baja: 72 },
};

export type EventoMatchInput = {
    conteoAcumulado: number;
    interCiudad: boolean;
} | null;

export type ClasificacionInput = {
    categoria: CategoriaConducta;
    confianza: number;
    posibleAgresorPar: boolean;
} | null;

/**
 * Calcula prioridad y vencimiento SLA a partir de la clasificación y el match.
 * El cálculo es determinista y totalmente local; no toca BD.
 */
export function calcularPrioridadYSLA(
    creadoEn: Date,
    clasificacion: ClasificacionInput,
    eventoMatch: EventoMatchInput,
    config: ConfiguracionPrioridad = CONFIG_DEFAULT
): { prioridad: PrioridadAlerta; vencimientoSla: Date } {
    let score = 0;

    if (clasificacion) {
        score += config.pesos.categoria[clasificacion.categoria] ?? 0;
        if (clasificacion.confianza >= 0.8) score += config.pesos.confianzaAlta;
        else if (clasificacion.confianza >= 0.5) score += config.pesos.confianzaMedia;
        if (clasificacion.posibleAgresorPar) score += config.pesos.posibleAgresorPar;
    }

    if (eventoMatch) {
        if (eventoMatch.conteoAcumulado >= 3) score += config.pesos.matchMayorIgual3;
        else if (eventoMatch.conteoAcumulado >= 2) score += config.pesos.matchMayorIgual2;
        if (eventoMatch.interCiudad) score += config.pesos.matchInterCiudad;
    }

    const prioridad: PrioridadAlerta = score >= config.umbrales.alta ? "alta" : score >= config.umbrales.media ? "media" : "baja";
    const horas = config.slaHoras[prioridad];
    const vencimientoSla = new Date(creadoEn.getTime() + horas * 60 * 60 * 1000);
    return { prioridad, vencimientoSla };
}

/**
 * Orden de novedad para desempate en la bandeja (nueva > vista > gestionada > escalada > cerrada).
 */
export const ORDEN_ESTADO: Record<string, number> = {
    nueva: 0,
    vista: 1,
    gestionada: 2,
    escalada: 3,
    cerrada: 4,
};
