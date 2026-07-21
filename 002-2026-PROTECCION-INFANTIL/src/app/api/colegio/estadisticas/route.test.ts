import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as getEstadisticas } from "./route";
import { GET as getPdf } from "./pdf/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearTokenUsuario,
    crearUsuario,
    crearColegioConAdmin,
    crearCurso,
    crearAlumno,
    crearIdentificadorAlumno,
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

vi.mock("@/lib/email", () => ({
    enviarAlertaColegio: vi.fn().mockResolvedValue(undefined),
}));

function request(method: string, url: string, body: unknown, token?: string): Request {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.cookie = `token=${token}`;
    return new Request(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
}

async function setupSchoolAdmin() {
    const { admin, colegio } = await crearColegioConAdmin();
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    return { admin, colegio };
}

async function crearReporte(
    identificador: string,
    plataformaId: string,
    estado: EstadoReporte,
    categoria?: CategoriaConducta,
    eliminado = false
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
            paisId: ciudad?.paisId,
            ciudadId: ciudad?.id,
            esAnonimo: true,
            edadVictima: 12,
            estado,
            eliminado,
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
    return reporte;
}

async function crearParametrosColegio() {
    await prisma.$executeRaw`
        INSERT INTO "ParametroSistema" (id, clave, valor, tipo, categoria, "esPublico", "creadoEn", "actualizadoEn")
        VALUES
            (${crypto.randomUUID()}, ${"colegio.notificaciones.enabled"}, ${"true"}, ${"BOOLEAN"}::"TipoParametro", ${"EMAIL"}::"CategoriaParametro", false, NOW(), NOW()),
            (${crypto.randomUUID()}, ${"colegio.notificaciones.cooldown_horas"}, ${"24"}, ${"INTEGER"}::"TipoParametro", ${"EMAIL"}::"CategoriaParametro", false, NOW(), NOW())
        ON CONFLICT (clave) DO UPDATE SET
            valor = EXCLUDED.valor,
            "actualizadoEn" = NOW()
    `;
}

describe("/api/colegio/estadisticas", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearParametrosReportes();
        await crearParametrosColegio();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        mockToken = undefined;
    });

    describe("GET /api/colegio/estadisticas", () => {
        it("SCHOOL_ADMIN ve estadísticas de su colegio con totales y desglose por curso", async () => {
            const { colegio } = await setupSchoolAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "5A", grado: "Quinto" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "Ana Pérez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, {
                valor: "+57300EST1",
                plataformaId: plataforma!.id,
                etiquetaRelacion: "ALUMNO",
            });

            const reporte = await crearReporte("+57300EST1", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
            await notificarColegioSiCorresponde(reporte.id);

            const res = await getEstadisticas(
                request("GET", "http://localhost:5005/api/colegio/estadisticas", undefined, mockToken)
            );
            expect(res.status).toBe(200);
            const json = await res.json();

            expect(json.colegioId).toBe(colegio.id);
            expect(json.colegioNombre).toBe(colegio.nombre);
            expect(json.totales).toEqual({ cursos: 1, alumnos: 1, identificadores: 1, alertas: 1 });
            expect(json.porCurso).toHaveLength(1);
            expect(json.porCurso[0]).toMatchObject({
                nombre: "5A",
                grado: "Quinto",
                alumnos: 1,
                identificadores: 1,
                alertas: 1,
            });
        });

        it("SCHOOL_ADMIN de otro colegio ve totales en cero", async () => {
            const { colegio } = await setupSchoolAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "5A" });
            await crearAlumno(curso.id, colegio.id, { nombre: "Ana Pérez" });

            const { admin: admin2 } = await crearColegioConAdmin();
            mockToken = await crearTokenUsuario(admin2.id, "SCHOOL_ADMIN");

            const res = await getEstadisticas(
                request("GET", "http://localhost:5005/api/colegio/estadisticas", undefined, mockToken)
            );
            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.totales).toEqual({ cursos: 0, alumnos: 0, identificadores: 0, alertas: 0 });
            expect(json.porCurso).toHaveLength(0);
        });

        it("ADMIN recibe 403", async () => {
            const admin = await crearUsuario("ADMIN");
            mockToken = await crearTokenUsuario(admin.id, "ADMIN");
            const res = await getEstadisticas(
                request("GET", "http://localhost:5005/api/colegio/estadisticas", undefined, mockToken)
            );
            expect(res.status).toBe(403);
        });

        it("No cuenta alertas de reportes dados de baja", async () => {
            const { colegio } = await setupSchoolAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "5A" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "Ana Pérez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, {
                valor: "+57300BAJA",
                plataformaId: plataforma!.id,
                etiquetaRelacion: "ALUMNO",
            });

            const reporte = await crearReporte("+57300BAJA", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS", true);
            await notificarColegioSiCorresponde(reporte.id);

            const res = await getEstadisticas(
                request("GET", "http://localhost:5005/api/colegio/estadisticas", undefined, mockToken)
            );
            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.totales.alertas).toBe(0);
        });

        it("No expone PII en la respuesta", async () => {
            const { colegio } = await setupSchoolAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "5A" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "Ana Pérez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, {
                valor: "+57300PII",
                plataformaId: plataforma!.id,
                etiquetaRelacion: "ALUMNO",
            });

            const reporte = await crearReporte("+57300PII", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
            await notificarColegioSiCorresponde(reporte.id);

            const res = await getEstadisticas(
                request("GET", "http://localhost:5005/api/colegio/estadisticas", undefined, mockToken)
            );
            const json = await res.json();
            const respuesta = JSON.stringify(json);

            expect(respuesta).not.toContain(reporte.texto);
            expect(respuesta).not.toContain(alumno.nombre);
            expect(respuesta).not.toContain("+57300PII");
            expect(respuesta).not.toContain(reporte.id);
            expect(respuesta).not.toContain("Bogotá");
            expect(respuesta).not.toContain("Colombia");
        });
    });

    describe("GET /api/colegio/estadisticas/pdf", () => {
        it("SCHOOL_ADMIN descarga un PDF no vacío", async () => {
            const { colegio } = await setupSchoolAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "5A" });
            await crearAlumno(curso.id, colegio.id, { nombre: "Ana Pérez" });

            const res = await getPdf(
                request("GET", "http://localhost:5005/api/colegio/estadisticas/pdf", undefined, mockToken)
            );
            expect(res.status).toBe(200);
            expect(res.headers.get("content-type")).toBe("application/pdf");
            const contentDisposition = res.headers.get("content-disposition");
            expect(contentDisposition).toContain("estadisticas-");
            expect(contentDisposition).toContain(".pdf");

            const blob = await res.blob();
            expect(blob.size).toBeGreaterThan(0);
        });

        it("ADMIN recibe 403 en PDF", async () => {
            const admin = await crearUsuario("ADMIN");
            mockToken = await crearTokenUsuario(admin.id, "ADMIN");
            const res = await getPdf(
                request("GET", "http://localhost:5005/api/colegio/estadisticas/pdf", undefined, mockToken)
            );
            expect(res.status).toBe(403);
        });
    });
});
