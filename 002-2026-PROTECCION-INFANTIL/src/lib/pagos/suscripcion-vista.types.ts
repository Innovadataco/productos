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
    diasRestantes: number;
    fechaInicio: string;
    fechaFin: string;
    plan: { nombre: string; duracion: string; precioBaseUSD: number };
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
