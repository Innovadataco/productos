/**
 * SPEC-225 (002-PI-126): fixtures compartidas de los tests de integración del
 * detector de anomalías (reglas.test.ts y detector.test.ts). No es un test:
 * solo builders de datos con los campos obligatorios reales del schema
 * (Plan.precio, Suscripcion.codigoReferidoPropio, comprobante de Pago, etc.).
 */
import type { DuracionPlan, EstadoPago, EstadoSuscripcion } from "@prisma/client";
// Test-only (la importan únicamente los *.test.ts del detector): los tests
// siembran la BD directamente por diseño (patrón de src/lib/reporte-test-utils.ts,
// que usa import relativo; la frontera Q-3 restringe el alias `@/lib/prisma`).
import { prisma } from "../../prisma";
import { crearUsuario, crearColegioConAdmin, crearPlataforma } from "@/lib/reporte-test-utils";

let consecutivo = 0;
export function unico(prefijo: string) {
    consecutivo += 1;
    return `${prefijo}-${Date.now()}-${consecutivo}`;
}

export async function crearPlan(adminId: string) {
    return prisma.plan.create({
        data: {
            nombre: unico("Plan225"),
            tipoTitular: "COLEGIO",
            duracion: "MES_1",
            anio: 2026 + (consecutivo % 50),
            precioBaseUSD: 10,
            precio: 0,
            creadoPorAdminId: adminId,
        },
    });
}

export async function crearAdmin() {
    return crearUsuario("ADMIN", unico("admin225") + "@test.local");
}

export interface DatosSuscripcion {
    estado?: EstadoSuscripcion;
    fechaInicio?: Date;
    fechaFin?: Date;
    canceladaEn?: Date | null;
    colegioId?: string | null;
    createdAt?: Date;
}

export async function crearSuscripcion(planId: string, datos: DatosSuscripcion = {}) {
    const ahora = new Date();
    return prisma.suscripcion.create({
        data: {
            tipoTitular: "COLEGIO",
            colegioId: datos.colegioId ?? null,
            estado: datos.estado ?? "ACTIVA",
            planActualId: planId,
            fechaInicio: datos.fechaInicio ?? ahora,
            fechaFin: datos.fechaFin ?? new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000),
            canceladaEn: datos.canceladaEn ?? null,
            codigoReferidoPropio: unico("PI-PADRE"),
            ...(datos.createdAt ? { createdAt: datos.createdAt } : {}),
        },
    });
}

export interface DatosPago {
    duracionCubierta?: DuracionPlan;
    fechaReporte: Date;
    estado?: EstadoPago;
    fechaAutorizacion?: Date | null;
    montoNetoUSD?: number;
}

export async function crearPago(suscripcionId: string, datos: DatosPago) {
    const montoNetoUSD = datos.montoNetoUSD ?? 10;
    return prisma.pago.create({
        data: {
            suscripcionId,
            duracionCubierta: datos.duracionCubierta ?? "MES_1",
            montoBaseUSD: montoNetoUSD,
            montoNetoUSD,
            tasaCambioAplicada: 4000,
            montoLocalPagado: montoNetoUSD * 4000,
            monedaLocal: "COP",
            metodoDeclarado: "TRANSFERENCIA",
            comprobanteAdjuntoUrl: "https://ejemplo.test/comprobante.pdf",
            comprobanteMimeType: "application/pdf",
            comprobanteHashSha256: unico("hash"),
            fechaReporte: datos.fechaReporte,
            estado: datos.estado ?? "AUTORIZADO",
            fechaAutorizacion: datos.fechaAutorizacion ?? datos.fechaReporte,
        },
    });
}

export { crearColegioConAdmin, crearPlataforma };

export async function crearReporteMinimo(
    plataformaId: string,
    tenantId: string,
    overrides: { ciudadId?: string; paisId?: string } = {}
) {
    return prisma.reporte.create({
        data: {
            identificador: unico("+57300"),
            plataformaId,
            texto: "texto de prueba",
            fechaIncidente: new Date(),
            ciudad: "Bogotá",
            pais: "Colombia",
            tenantId,
            ciudadId: overrides.ciudadId ?? null,
            paisId: overrides.paisId ?? null,
        },
    });
}

export async function crearSesion(
    usuarioId: string,
    tenantId: string,
    iniciadaEn: Date
) {
    return prisma.sesionLog.create({
        data: {
            usuarioId,
            tenantId,
            rol: "SCHOOL_ADMIN",
            iniciadaEn,
            ultimaActividadEn: iniciadaEn,
            ipHash: unico("iphash"),
        },
    });
}
