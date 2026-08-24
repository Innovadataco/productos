/**
 * SPEC-211 (002-PI-111): utilidades de presentación de la vista de suscripción.
 * Solo tokens del sistema de diseño (pino/cielo/ambar/rubi/tinta) — prohibido
 * color crudo (ratchet SPEC-157).
 */
import type { ColorRol } from "@/lib/pagos/suscripcion-vista.types";

export interface Acento {
    texto: string;
    fondoSuave: string;
    borde: string;
    boton: string;
}

export const ACENTOS: Record<ColorRol, Acento> = {
    pino: {
        texto: "text-pino",
        fondoSuave: "bg-pino/10",
        borde: "border-pino/30",
        boton: "bg-pino text-white hover:brightness-110",
    },
    cielo: {
        texto: "text-cielo",
        fondoSuave: "bg-cielo/10",
        borde: "border-cielo/30",
        boton: "bg-cielo text-white hover:brightness-110",
    },
};

export interface EstadoMeta {
    label: string;
    clases: string;
}

export const ESTADO_SUSCRIPCION: Record<string, EstadoMeta> = {
    ACTIVA: { label: "Activa", clases: "bg-pino/10 text-pino" },
    EN_GRACIA: { label: "En periodo de gracia", clases: "bg-ambar/10 text-ambar" },
    SUSPENDIDA: { label: "Suspendida", clases: "bg-rubi/10 text-rubi" },
    CANCELADA: { label: "Cancelada", clases: "bg-tinta/10 text-muted" },
};

export const ESTADO_PAGO: Record<string, EstadoMeta> = {
    PENDIENTE_AUTORIZACION: { label: "Pendiente de autorización", clases: "bg-ambar/10 text-ambar" },
    AUTORIZADO: { label: "Autorizado", clases: "bg-pino/10 text-pino" },
    RECHAZADO: { label: "Rechazado", clases: "bg-rubi/10 text-rubi" },
    REEMBOLSADO: { label: "Reembolsado", clases: "bg-cielo/10 text-cielo" },
};

export const DURACION_LABEL: Record<string, string> = {
    MES_1: "1 mes",
    MES_2: "2 meses",
    MES_3: "3 meses",
    MES_6: "6 meses",
    MES_12: "12 meses",
};

export const METODO_PAGO_LABEL: Record<string, string> = {
    TRANSFERENCIA: "Transferencia bancaria",
    NEQUI: "Nequi",
    DAVIPLATA: "Daviplata",
    PSE_MANUAL: "PSE (manual)",
    EFECTIVO: "Efectivo",
    CHEQUE: "Cheque",
    OTRO: "Otro",
};

const FORMATO_USD = new Intl.NumberFormat("es-CO", { style: "currency", currency: "USD" });

export function formatoUSD(valor: number): string {
    return FORMATO_USD.format(valor);
}

export function formatoLocal(valor: number, moneda: string): string {
    try {
        return new Intl.NumberFormat("es-CO", { style: "currency", currency: moneda, maximumFractionDigits: 0 }).format(valor);
    } catch {
        return `${valor} ${moneda}`;
    }
}

export function estadoSuscripcionMeta(estado: string): EstadoMeta {
    return ESTADO_SUSCRIPCION[estado] ?? { label: estado, clases: "bg-tinta/10 text-muted" };
}

export function estadoPagoMeta(estado: string): EstadoMeta {
    return ESTADO_PAGO[estado] ?? { label: estado, clases: "bg-tinta/10 text-muted" };
}
