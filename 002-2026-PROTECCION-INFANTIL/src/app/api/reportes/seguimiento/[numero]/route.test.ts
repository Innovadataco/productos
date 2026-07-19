import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad, crearUsuario } from "@/lib/reporte-test-utils";
import type { EstadoReporte } from "@prisma/client";

async function crearReporteBase(
    numeroSeguimiento: string,
    identificador: string,
    estado: EstadoReporte = "PENDIENTE",
    eliminado = false
) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const usuario = await crearUsuario("PARENT");
    return prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma!.id,
            texto: "Texto de prueba para seguimiento.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            usuarioId: usuario.id,
            numeroSeguimiento,
            estado,
            eliminado,
        },
    });
}

async function crearReporteClasificadoVisible(numeroSeguimiento: string, identificador: string) {
    const reporte = await crearReporteBase(numeroSeguimiento, identificador, "CLASIFICADO");
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria: "OFRECIMIENTO_REGALOS",
            confianza: 0.92,
            contienePii: true,
            piiDetectada: ["María"],
            modeloUsado: "ornith:9b",
            latenciaMs: 1000,
        },
    });
    await prisma.identificadorReportado.upsert({
        where: { identificador_plataformaId: { identificador, plataformaId: reporte.plataformaId } },
        update: { totalReportes: 1, reportesAutenticados: 1, reportesAnonimos: 0, esVisiblePublicamente: true },
        create: {
            identificador,
            plataformaId: reporte.plataformaId,
            totalReportes: 1,
            reportesAutenticados: 1,
            reportesAnonimos: 0,
            esVisiblePublicamente: true,
        },
    });
    return reporte;
}

describe("GET /api/reportes/seguimiento/[numero]", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("devuelve 404 si el número no existe", async () => {
        const res = await GET(
            new Request("http://localhost:5005/api/reportes/seguimiento/RPT-NOEXIS"),
            { params: Promise.resolve({ numero: "RPT-NOEXIS" }) }
        );
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.message).toBe("Número de seguimiento no encontrado");
    });

    it("mapea PENDIENTE a 'En proceso' con mensaje de SLA", async () => {
        await crearReporteBase("RPT-PEND01", "+57300PEND", "PENDIENTE");

        const res = await GET(
            new Request("http://localhost:5005/api/reportes/seguimiento/RPT-PEND01"),
            { params: Promise.resolve({ numero: "RPT-PEND01" }) }
        );
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.estadoVisual).toBe("En proceso");
        expect(body.estadoInterno).toBe("PENDIENTE");
        expect(body.enProceso).toBe(true);
        expect(body.badge).toBe("warning");
        expect(body.mensaje).toBe("Tu reporte está en proceso — puede tardar hasta 24 horas");
        expect(body.slaHoras).toBe(24);
        expect(body.clasificacion).toBeNull();
    });

    it("mapea CLASIFICADO a 'Procesado' sin SLA", async () => {
        await prisma.parametroSistema.updateMany({ where: { clave: "visibility.report_threshold" }, data: { valor: "1" } });
        await prisma.parametroSistema.updateMany({ where: { clave: "visibility.min_authenticated_ratio" }, data: { valor: "0" } });

        await crearReporteClasificadoVisible("RPT-CLASIF", "+57300CLASIF");

        const res = await GET(
            new Request("http://localhost:5005/api/reportes/seguimiento/RPT-CLASIF"),
            { params: Promise.resolve({ numero: "RPT-CLASIF" }) }
        );
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.estadoVisual).toBe("Verificado");
        expect(body.estadoInterno).toBe("CLASIFICADO");
        expect(body.enProceso).toBe(false);
        expect(body.badge).toBe("success");
        expect(body.mensaje).toBe("Tu reporte ha sido verificado y clasificado.");
        expect(body.slaHoras).toBe(24);
        expect(body.clasificacion).not.toBeNull();
        expect(body.clasificacion.confianza).toBeUndefined();
        expect(body.ranking).not.toBeNull();
    });

    it("mapea DUPLICADO a 'Procesado' con badge muted", async () => {
        await crearReporteBase("RPT-DUPLIC", "+57300DUP", "DUPLICADO");

        const res = await GET(
            new Request("http://localhost:5005/api/reportes/seguimiento/RPT-DUPLIC"),
            { params: Promise.resolve({ numero: "RPT-DUPLIC" }) }
        );
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.estadoVisual).toBe("En proceso");
        expect(body.estadoInterno).toBe("DUPLICADO");
        expect(body.badge).toBe("warning");
        expect(body.mensaje).toBe("Tu reporte está en proceso — puede tardar hasta 24 horas");
        expect(body.clasificacion).toBeNull();
    });

    it("devuelve 404 para reporte eliminado", async () => {
        await crearReporteBase("RPT-BAJA12", "+57300BAJA", "PENDIENTE", true);

        const res = await GET(
            new Request("http://localhost:5005/api/reportes/seguimiento/RPT-BAJA12"),
            { params: Promise.resolve({ numero: "RPT-BAJA12" }) }
        );
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.message).toBe("Número de seguimiento no encontrado");
    });

    it("muestra el nombre personalizado cuando la plataforma es 'otro'", async () => {
        const plataformaOtro = await prisma.plataforma.upsert({
            where: { clave: "otro" },
            update: {},
            create: { clave: "otro", nombre: "Otra plataforma", categoria: "otro" },
        });
        const usuario = await crearUsuario("PARENT");
        await prisma.reporte.create({
            data: {
                identificador: "+57300OTRO",
                plataformaId: plataformaOtro.id,
                otraPlataforma: "Discord",
                texto: "Texto de prueba.",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: false,
                usuarioId: usuario.id,
                numeroSeguimiento: "RPT-OTRO01",
                estado: "PENDIENTE",
            },
        });

        const res = await GET(
            new Request("http://localhost:5005/api/reportes/seguimiento/RPT-OTRO01"),
            { params: Promise.resolve({ numero: "RPT-OTRO01" }) }
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.plataforma).toBe("Discord");
        expect(body.plataforma).not.toContain("undefined");
    });

    it("refleja cambios en ui.sla_horas_procesamiento", async () => {
        await prisma.parametroSistema.updateMany({
            where: { clave: "ui.sla_horas_procesamiento" },
            data: { valor: "48" },
        });
        await crearReporteBase("RPT-SLA480", "+57300SLA48", "PENDIENTE");

        const res = await GET(
            new Request("http://localhost:5005/api/reportes/seguimiento/RPT-SLA480"),
            { params: Promise.resolve({ numero: "RPT-SLA480" }) }
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.slaHoras).toBe(48);
        expect(body.mensaje).toBe("Tu reporte está en proceso — puede tardar hasta 48 horas");
    });
});
