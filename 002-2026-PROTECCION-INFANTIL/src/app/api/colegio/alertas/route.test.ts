import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { PATCH } from "./[id]/estado/route";
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

describe("/api/colegio/alertas", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearParametrosReportes();
        await crearParametrosColegio();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        mockToken = undefined;
    });

    describe("GET", () => {
        it("SCHOOL_ADMIN lista alertas de su colegio anonimizadas", async () => {
            const { colegio } = await setupSchoolAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "María Gómez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, {
                valor: "+573001234567",
                plataformaId: plataforma!.id,
                etiquetaRelacion: "ALUMNO",
            });

            const reporte = await crearReporte("+573001234567", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
            await notificarColegioSiCorresponde(reporte.id);

            const res = await GET(request("GET", "http://localhost:5005/api/colegio/alertas", undefined, mockToken));
            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.alertas).toHaveLength(1);

            const alerta = json.alertas[0];
            expect(alerta.identificador).toBe("+573001234567");
            expect(alerta.relacion).toBe("ALUMNO");
            expect(alerta.categoria).toBe("OFRECIMIENTO_REGALOS");
            expect(alerta.estadoReporte).toBe("CLASIFICADO");
            expect(alerta.estadoAlerta).toBe("nueva");
            expect(alerta.creadoEn).toBeDefined();
        });

        it("GET no expone PII del reporte ni del denunciante", async () => {
            const { colegio } = await setupSchoolAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "María Gómez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, {
                valor: "+57300PRIV",
                plataformaId: plataforma!.id,
                etiquetaRelacion: "MADRE",
            });

            const reporte = await crearReporte("+57300PRIV", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
            await notificarColegioSiCorresponde(reporte.id);

            const res = await GET(request("GET", "http://localhost:5005/api/colegio/alertas", undefined, mockToken));
            const json = await res.json();
            const alerta = json.alertas[0];

            const respuesta = JSON.stringify(json);
            expect(respuesta).not.toContain(reporte.texto);
            expect(respuesta).not.toContain("Bogotá");
            expect(respuesta).not.toContain("Colombia");
            expect(respuesta).not.toContain(reporte.id);

            expect(alerta).not.toHaveProperty("texto");
            expect(alerta).not.toHaveProperty("ciudad");
            expect(alerta).not.toHaveProperty("pais");
            expect(alerta).not.toHaveProperty("edadVictima");
            expect(alerta).not.toHaveProperty("plataforma");
            expect(alerta).not.toHaveProperty("identificadorDenunciante");
            expect(alerta).not.toHaveProperty("textoAnonimizado");
            expect(alerta).not.toHaveProperty("reporteId");
        });

        it("SCHOOL_ADMIN de otro colegio no ve alertas ajenas", async () => {
            const { colegio: colegio1 } = await setupSchoolAdmin();
            const curso = await crearCurso(colegio1.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio1.id, { nombre: "María Gómez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, { valor: "+57300AJENO", plataformaId: plataforma!.id });

            const reporte = await crearReporte("+57300AJENO", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
            await notificarColegioSiCorresponde(reporte.id);

            const { admin: admin2 } = await crearColegioConAdmin();
            mockToken = await crearTokenUsuario(admin2.id, "SCHOOL_ADMIN");

            const res = await GET(request("GET", "http://localhost:5005/api/colegio/alertas", undefined, mockToken));
            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.alertas).toHaveLength(0);
        });

        it("ADMIN recibe 403", async () => {
            const admin = await crearUsuario("ADMIN");
            mockToken = await crearTokenUsuario(admin.id, "ADMIN");
            const res = await GET(request("GET", "http://localhost:5005/api/colegio/alertas", undefined, mockToken));
            expect(res.status).toBe(403);
        });

        it("OPERADOR recibe 403", async () => {
            const operador = await crearUsuario("OPERADOR");
            mockToken = await crearTokenUsuario(operador.id, "OPERADOR");
            const res = await GET(request("GET", "http://localhost:5005/api/colegio/alertas", undefined, mockToken));
            expect(res.status).toBe(403);
        });

        it("COMITE_VALIDACION recibe 403", async () => {
            const comite = await crearUsuario("COMITE_VALIDACION");
            mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
            const res = await GET(request("GET", "http://localhost:5005/api/colegio/alertas", undefined, mockToken));
            expect(res.status).toBe(403);
        });

        it("PARENT recibe 403", async () => {
            const parent = await crearUsuario("PARENT");
            mockToken = await crearTokenUsuario(parent.id, "PARENT");
            const res = await GET(request("GET", "http://localhost:5005/api/colegio/alertas", undefined, mockToken));
            expect(res.status).toBe(403);
        });

        it("oculta alertas de reportes dados de baja", async () => {
            const { colegio } = await setupSchoolAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "María Gómez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, { valor: "+57300BAJA", plataformaId: plataforma!.id });

            const reporte = await crearReporte("+57300BAJA", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
            await notificarColegioSiCorresponde(reporte.id);
            await prisma.reporte.update({ where: { id: reporte.id }, data: { eliminado: true } });

            const res = await GET(request("GET", "http://localhost:5005/api/colegio/alertas", undefined, mockToken));
            const json = await res.json();
            expect(json.alertas).toHaveLength(0);
        });

        it("filtra por estado de alerta", async () => {
            const { colegio } = await setupSchoolAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "María Gómez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, { valor: "+57300FILTRO", plataformaId: plataforma!.id });

            const reporte = await crearReporte("+57300FILTRO", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
            await notificarColegioSiCorresponde(reporte.id);
            const alerta = await prisma.alertaColegio.findFirst({ where: { colegioId: colegio.id } });
            await PATCH(
                request("PATCH", `http://localhost:5005/api/colegio/alertas/${alerta!.id}/estado`, { estado: "vista" }, mockToken),
                { params: Promise.resolve({ id: alerta!.id }) }
            );

            const res = await GET(request("GET", "http://localhost:5005/api/colegio/alertas?estado=vista", undefined, mockToken));
            const json = await res.json();
            expect(json.alertas).toHaveLength(1);
            expect(json.alertas[0].estadoAlerta).toBe("vista");
        });
    });

    describe("PATCH /api/colegio/alertas/[id]/estado", () => {
        it("SCHOOL_ADMIN marca alerta propia como vista", async () => {
            const { colegio } = await setupSchoolAdmin();
            const curso = await crearCurso(colegio.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio.id, { nombre: "María Gómez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, { valor: "+57300ESTADO", plataformaId: plataforma!.id });

            const reporte = await crearReporte("+57300ESTADO", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
            await notificarColegioSiCorresponde(reporte.id);
            const alerta = await prisma.alertaColegio.findFirst({ where: { colegioId: colegio.id } });

            const res = await PATCH(
                request("PATCH", `http://localhost:5005/api/colegio/alertas/${alerta!.id}/estado`, { estado: "vista" }, mockToken),
                { params: Promise.resolve({ id: alerta!.id }) }
            );

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.alerta.estado).toBe("vista");

            const audit = await prisma.auditLog.findFirst({
                where: { accion: "COLEGIO_ALERTA_ESTADO", recursoId: alerta!.id },
            });
            expect(audit).not.toBeNull();
        });

        it("SCHOOL_ADMIN no puede cambiar alerta de otro colegio", async () => {
            const { colegio: colegio1 } = await setupSchoolAdmin();
            const curso = await crearCurso(colegio1.id, { nombre: "6A" });
            const alumno = await crearAlumno(curso.id, colegio1.id, { nombre: "María Gómez" });
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            await crearIdentificadorAlumno(alumno.id, { valor: "+57300AJENA", plataformaId: plataforma!.id });

            const reporte = await crearReporte("+57300AJENA", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
            await notificarColegioSiCorresponde(reporte.id);
            const alerta = await prisma.alertaColegio.findFirst({ where: { colegioId: colegio1.id } });

            const { admin: admin2 } = await crearColegioConAdmin();
            mockToken = await crearTokenUsuario(admin2.id, "SCHOOL_ADMIN");

            const res = await PATCH(
                request("PATCH", `http://localhost:5005/api/colegio/alertas/${alerta!.id}/estado`, { estado: "vista" }, mockToken),
                { params: Promise.resolve({ id: alerta!.id }) }
            );
            expect(res.status).toBe(404);
        });

        it("rechaza estado inválido", async () => {
            await setupSchoolAdmin();
            const alertaId = crypto.randomUUID();
            const res = await PATCH(
                request("PATCH", `http://localhost:5005/api/colegio/alertas/${alertaId}/estado`, { estado: "invalido" }, mockToken),
                { params: Promise.resolve({ id: alertaId }) }
            );
            expect(res.status).toBe(400);
        });
    });
});
