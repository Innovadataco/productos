import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as getPdf } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearTokenUsuario,
    crearUsuario,
    crearColegioConAdmin,
    crearCurso,
    crearEstudiante,
    crearIdentificadorEstudiante,
    crearPlataforma,
    crearParametrosReportes,
} from "@/lib/reporte-test-utils";
import { notificarColegioSiCorresponde } from "@/lib/colegio/alertas";
import type { EstadoReporte, CategoriaConducta } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function request(method: string, url: string, token?: string): Request {
    const headers: Record<string, string> = {};
    if (token) headers.cookie = `token=${token}`;
    return new Request(url, { method, headers });
}

async function setupSchoolAdmin() {
    const { admin, colegio } = await crearColegioConAdmin();
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    return { admin, colegio };
}

async function crearReporteMensual(
    identificador: string,
    plataformaId: string,
    estado: EstadoReporte,
    categoria?: CategoriaConducta,
    creadoEn?: Date
) {
    const ciudad = await prisma.ciudad.findUnique({
        where: { nombre_paisId: { nombre: "Bogotá", paisId: (await prisma.pais.findUnique({ where: { codigo: "CO" } }))!.id } },
    });
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: "Texto confidencial del reporte con datos sensibles del menor",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            paisId: ciudad?.paisId ?? null,
            ciudadId: ciudad?.id ?? null,
            esAnonimo: true,
            edadVictima: 12,
            estado,
            eliminado: false,
            numeroSeguimiento: `RPT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        },
    });
    if (categoria) {
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria,
                confianza: 0.85,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "ornith:9b",
                latenciaMs: 1000,
            },
        });
    }
    await notificarColegioSiCorresponde(reporte.id);
    if (creadoEn) {
        await prisma.alertaColegio.updateMany({
            where: { reporteId: reporte.id },
            data: { creadoEn },
        });
    }
    return reporte;
}

describe("GET /api/colegio/reportes/pdf", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearParametrosReportes();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        mockToken = undefined;
    });

    it("SCHOOL_ADMIN descarga un PDF no vacío con nombre correcto", async () => {
        const { colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "5A", grado: "Quinto" });
        const alumno = await crearEstudiante(curso.id, colegio.id, { nombre: "Ana Pérez" });
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await crearIdentificadorEstudiante(alumno.id, {
            valor: "+57300000001",
            plataformaId: plataforma!.id,
            etiquetaRelacion: "ESTUDIANTE",
        });
        await crearReporteMensual("+57300000001", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");

        const res = await getPdf(
            request("GET", "http://localhost:5005/api/colegio/reportes/pdf?mes=2026-07", mockToken)
        );
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("application/pdf");
        const contentDisposition = res.headers.get("content-disposition");
        expect(contentDisposition).toContain("informe-mensual-");
        expect(contentDisposition).toContain("2026-07");
        expect(contentDisposition).toContain(".pdf");

        const blob = await res.blob();
        expect(blob.size).toBeGreaterThan(0);
    });

    it("responde 400 si el formato de mes es inválido", async () => {
        await setupSchoolAdmin();
        const res = await getPdf(
            request("GET", "http://localhost:5005/api/colegio/reportes/pdf?mes=07-2026", mockToken)
        );
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.message).toBeTruthy();
    });

    it("responde 400 si el mes es futuro", async () => {
        await setupSchoolAdmin();
        const res = await getPdf(
            request("GET", "http://localhost:5005/api/colegio/reportes/pdf?mes=2030-01", mockToken)
        );
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.message).toBeTruthy();
    });

    it("genera informe con totales en cero para mes sin actividad", async () => {
        await setupSchoolAdmin();
        const res = await getPdf(
            request("GET", "http://localhost:5005/api/colegio/reportes/pdf?mes=2026-06", mockToken)
        );
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("application/pdf");
        const blob = await res.blob();
        expect(blob.size).toBeGreaterThan(0);
    });

    it("SCHOOL_ADMIN de otro colegio no ve datos ajenos (A/B)", async () => {
        const { colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "5A", grado: "Quinto" });
        const alumno = await crearEstudiante(curso.id, colegio.id, { nombre: "Ana Pérez" });
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await crearIdentificadorEstudiante(alumno.id, {
            valor: "+57300000002",
            plataformaId: plataforma!.id,
            etiquetaRelacion: "ESTUDIANTE",
        });
        await crearReporteMensual("+57300000002", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");

        const { admin: admin2 } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin2.id, "SCHOOL_ADMIN");

        const res = await getPdf(
            request("GET", "http://localhost:5005/api/colegio/reportes/pdf?mes=2026-07", mockToken)
        );
        expect(res.status).toBe(200);
        const blob = await res.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const text = new TextDecoder("latin1").decode(arrayBuffer);
        expect(text).not.toContain("5A");
        expect(text).not.toContain("Quinto");
        expect(text).not.toContain("Ofrecimiento");
    });

    it("dos requests del mismo mes generan PDFs idénticos (determinismo)", async () => {
        const { colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "5A", grado: "Quinto" });
        const alumno = await crearEstudiante(curso.id, colegio.id, { nombre: "Ana Pérez" });
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await crearIdentificadorEstudiante(alumno.id, {
            valor: "+57300000003",
            plataformaId: plataforma!.id,
            etiquetaRelacion: "ESTUDIANTE",
        });
        await crearReporteMensual("+57300000003", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");

        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-08-09T12:00:00Z"));

        const res1 = await getPdf(
            request("GET", "http://localhost:5005/api/colegio/reportes/pdf?mes=2026-07", mockToken)
        );
        const res2 = await getPdf(
            request("GET", "http://localhost:5005/api/colegio/reportes/pdf?mes=2026-07", mockToken)
        );

        vi.useRealTimers();

        expect(res1.status).toBe(200);
        expect(res2.status).toBe(200);
        const buf1 = new Uint8Array(await res1.arrayBuffer());
        const buf2 = new Uint8Array(await res2.arrayBuffer());
        expect(buf1.length).toBe(buf2.length);
        expect(buf1).toEqual(buf2);
    });

    it("ADMIN recibe 403", async () => {
        await crearColegioConAdmin();
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await getPdf(
            request("GET", "http://localhost:5005/api/colegio/reportes/pdf?mes=2026-07", mockToken)
        );
        expect(res.status).toBe(403);
    });
});
