/**
 * SPEC-211 (002-PI-111): tipos del DTO de la vista de suscripción del cliente.
 * Módulo puro (sin imports de runtime): lo comparten el servicio server-side y
 * los componentes cliente, sin arrastrar Prisma al bundle del navegador.
 */

export interface PagoHistorialItem {
    id: string;
    estado: string;
    duracionCubierta: string;
    montoNetoUSD: number;
    montoLocalPagado: number;
    monedaLocal: string;
    metodoDeclarado: string;
    fechaReporte: string;
    motivoRechazo: string | null;
}

export interface OpcionRenovacion {
    duracion: string;
    precioBaseUSD: number;
    descuentoAnualPct: number;
    precioNetoUSD: number;
    montoLocal: number | null;
    monedaLocal: string;
}

export interface PagoPendienteResumen {
    id: string;
    estado: string;
    montoNetoUSD: number;
    montoLocalPagado: number;
    monedaLocal: string;
    fechaReporte: string;
}

export interface VistaSuscripcion {
    id: string;
    estado: string;
    esFreemium: boolean;
    // SPEC-217 (002-PI-117): datos de freemium para la vista cliente (FR-008).
    freemiumFechaFin: string | null;
    diasRestantesFreemium: number | null;
    diasRestantes: number;
    fechaInicio: string;
    fechaFin: string;
    // SPEC-289 (002-PI-189 · Fase 1): agrega `precioBaseCOP` como campo opcional
    // (aditivo, backward-compatible) para que la vista pueda pasar el monto base
    // en COP a `AplicarBonoCard` sin depender del legacy USD. Fase 2 (ARQ_16)
    // eliminará `precioBaseUSD`.
    plan: { nombre: string; duracion: string; precioBaseUSD: number; precioBaseCOP?: number | null };
    totalPagadoUSD: number;
    totalPagadoLocal: number;
    monedaLocal: string;
    codigoReferidoPropio: string;
    referidosExitososEsteAnio: number;
    contratoPDFUrl: string | null;
    contratoObligatorio: boolean;
    pagoPendiente: PagoPendienteResumen | null;
    pagos: PagoHistorialItem[];
    opcionesRenovacion: OpcionRenovacion[];
    limitesComprobante: { tamanoMaxMB: number; formatosPermitidos: string[] };
    descuentoReferidoPct: number;
    puedeRenovar: boolean;
}

/** Color de acento por rol: pino (rector) o cielo (padre). */
export type ColorRol = "pino" | "cielo";
