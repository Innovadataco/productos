import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad, crearUsuario } from "@/lib/reporte-test-utils";
import {
    calcularIpHash,
    calcularFingerprintServerSide,
    calcularPesoFuente,
    calcularDiasAntiguedad,
    crearFuenteReporte,
    limpiarFuenteReporteAntiguas,
    getFuentePesoParams,
} from "./fuente-reporte";

async function crearReporte(identificador: string, plataformaId: string, esAnonimo: boolean, usuarioId?: string) {
    const numeroSeguimiento = `RPT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    return prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: "Texto de prueba fuente.",
            fechaIncidente: new Date(),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo,
            usuarioId: usuarioId ?? null,
            numeroSeguimiento,
            estado: "CLASIFICADO",
        },
    });
}

describe("hashing de fuente", () => {
    it("hashConSalt produce sha256 hexadecimal de 64 caracteres", () => {
        const h1 = calcularIpHash("192.168.1.25");
        const h2 = calcularIpHash("192.168.2.25");
        expect(h1).toMatch(/^[a-f0-9]{64}$/);
        expect(h2).toMatch(/^[a-f0-9]{64}$/);
        expect(h1).not.toBe(h2);
    });

    it("fingerprint server-side incluye user-agent y accept-language", () => {
        const req = new Request("http://localhost/api/reportes", {
            headers: {
                "user-agent": "Mozilla/5.0",
                "accept-language": "es-CO",
            },
        });
        const fp = calcularFingerprintServerSide(req);
        expect(fp).toMatch(/^[a-f0-9]{64}$/);
    });
});

describe("calcularPesoFuente", () => {
    it("peso base autenticado es mayor que anónimo", () => {
        const params = {
            weightAnonymous: 0.65,
            weightAuthenticated: 1.0,
            newAccountFactor: 0.7,
            newAccountDaysThreshold: 7,
            burstFactor: 0.4,
            burstWindowHours: 24,
            burstMaxReports: 3,
            confirmedFactor: 1.2,
            discardedFactor: 0.3,
        };
        const anon = calcularPesoFuente({ esAnonimo: true }, { reportesPrevios: 0, reportesConfirmados: 0, reportesDescartados: 0, esRafaga: false }, params);
        const auth = calcularPesoFuente({ esAnonimo: false }, { cuentaDiasAntiguedad: 30, reportesPrevios: 0, reportesConfirmados: 0, reportesDescartados: 0, esRafaga: false }, params);
        expect(auth).toBeGreaterThan(anon);
    });

    it("penaliza cuentas nuevas y ráfagas", () => {
        const params = {
            weightAnonymous: 0.65,
            weightAuthenticated: 1.0,
            newAccountFactor: 0.7,
            newAccountDaysThreshold: 7,
            burstFactor: 0.4,
            burstWindowHours: 24,
            burstMaxReports: 3,
            confirmedFactor: 1.2,
            discardedFactor: 0.3,
        };
        const normal = calcularPesoFuente({ esAnonimo: false }, { cuentaDiasAntiguedad: 30, reportesPrevios: 0, reportesConfirmados: 0, reportesDescartados: 0, esRafaga: false }, params);
        const nueva = calcularPesoFuente({ esAnonimo: false }, { cuentaDiasAntiguedad: 2, reportesPrevios: 0, reportesConfirmados: 0, reportesDescartados: 0, esRafaga: false }, params);
        const rafaga = calcularPesoFuente({ esAnonimo: false }, { cuentaDiasAntiguedad: 30, reportesPrevios: 0, reportesConfirmados: 0, reportesDescartados: 0, esRafaga: true }, params);

        expect(nueva).toBeLessThan(normal);
        expect(rafaga).toBeLessThan(normal);
    });

    it("reportes confirmados aumentan peso y descartados lo reducen", () => {
        const params = {
            weightAnonymous: 0.65,
            weightAuthenticated: 1.0,
            newAccountFactor: 0.7,
            newAccountDaysThreshold: 7,
            burstFactor: 0.4,
            burstWindowHours: 24,
            burstMaxReports: 3,
            confirmedFactor: 1.2,
            discardedFactor: 0.3,
        };
        const base = calcularPesoFuente({ esAnonimo: false }, { cuentaDiasAntiguedad: 30, reportesPrevios: 0, reportesConfirmados: 0, reportesDescartados: 0, esRafaga: false }, params);
        const confirmado = calcularPesoFuente({ esAnonimo: false }, { cuentaDiasAntiguedad: 30, reportesPrevios: 0, reportesConfirmados: 2, reportesDescartados: 0, esRafaga: false }, params);
        const descartado = calcularPesoFuente({ esAnonimo: false }, { cuentaDiasAntiguedad: 30, reportesPrevios: 0, reportesConfirmados: 0, reportesDescartados: 2, esRafaga: false }, params);

        expect(confirmado).toBeGreaterThan(base);
        expect(descartado).toBeLessThan(base);
    });
});

describe("crearFuenteReporte", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("crea FuenteReporte y actualiza fuenteConfianza del reporte", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await crearReporte("+57300FUENTE", plataforma!.id, true);
        const req = new Request("http://localhost/api/reportes", {
            headers: {
                "user-agent": "Mozilla/5.0",
                "accept-language": "es-CO",
                "x-forwarded-for": "203.0.113.45",
            },
        });

        await crearFuenteReporte(reporte.id, {
            request: req,
            identificador: reporte.identificador,
            plataformaId: plataforma!.id,
        });

        const fuente = await prisma.fuenteReporte.findUnique({ where: { reporteId: reporte.id } });
        expect(fuente).not.toBeNull();
        expect(fuente!.ipHash).toBe(calcularIpHash("203.0.113.45"));
        expect(fuente!.pesoAplicado).toBeGreaterThan(0);

        const reporteActualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(reporteActualizado!.fuenteConfianza).toBe(fuente!.pesoAplicado);
    });

    it("cuenta reportes previos del mismo usuario", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const usuario = await crearUsuario("PARENT");
        const r1 = await crearReporte("+57300PREV", plataforma!.id, false, usuario.id);
        await crearFuenteReporte(r1.id, { identificador: r1.identificador, plataformaId: plataforma!.id, usuario });

        const r2 = await crearReporte("+57300PREV2", plataforma!.id, false, usuario.id);
        await crearFuenteReporte(r2.id, { identificador: r2.identificador, plataformaId: plataforma!.id, usuario });

        const fuente2 = await prisma.fuenteReporte.findUnique({ where: { reporteId: r2.id } });
        expect(fuente2!.reportesPrevios).toBe(1);
    });
});

describe("limpiarFuenteReporteAntiguas", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("elimina solo registros más antiguos que el umbral de retención", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await crearReporte("+57300RET", plataforma!.id, true);
        await prisma.fuenteReporte.create({
            data: {
                reporteId: reporte.id,
                pesoAplicado: 1,
                creadoEn: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
            },
        });

        const borrados = await limpiarFuenteReporteAntiguas(90);
        expect(borrados).toBe(1);
        const restantes = await prisma.fuenteReporte.count();
        expect(restantes).toBe(0);
    });
});

describe("getFuentePesoParams", () => {
    it("lee los parámetros por defecto", async () => {
        await resetDatabase();
        await crearParametrosReportes();
        const params = await getFuentePesoParams();
        expect(params.weightAnonymous).toBe(0.65);
        expect(params.weightAuthenticated).toBe(1.0);
        expect(params.newAccountDaysThreshold).toBe(7);
    });
});

describe("calcularDiasAntiguedad", () => {
    it("calcula días desde la creación de la cuenta", () => {
        const usuario = { creadoEn: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } as { creadoEn: Date };
        expect(calcularDiasAntiguedad(usuario)).toBe(3);
    });

    it("devuelve undefined si no hay fecha de creación", () => {
        expect(calcularDiasAntiguedad(null)).toBeUndefined();
    });
});
