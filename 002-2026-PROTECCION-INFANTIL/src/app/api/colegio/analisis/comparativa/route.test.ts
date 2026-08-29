import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
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

vi.mock("@/lib/email", () => ({
    enviarAlertaColegio: vi.fn().mockResolvedValue(undefined),
}));

function request(url: string, token?: string): Request {
    const headers: Record<string, string> = {};
    if (token) headers.cookie = `token=${token}`;
    return new Request(url, { headers });
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
    categoria?: CategoriaConducta
) {
    const ciudad = await prisma.ciudad.findUnique({
        where: { nombre_paisId: { nombre: "Bogotá", paisId: (await prisma.pais.findUnique({ where: { codigo: "CO" } }))!.id } },
    });
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: "Texto confidencial",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            paisId: ciudad?.paisId ?? null,
            ciudadId: ciudad?.id ?? null,
            esAnonimo: true,
            edadVictima: 12,
            estado,
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

describe("GET /api/colegio/analisis/comparativa", { timeout: 30000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearParametrosReportes();
        await crearParametrosColegio();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        mockToken = undefined;
    });

    it("agrupa cursos por grado por defecto y devuelve métricas agregadas", async () => {
        const { colegio } = await setupSchoolAdmin();
        const curso5A = await crearCurso(colegio.id, { nombre: "5A", grado: "Quinto", anioLectivo: "2026" });
        const curso5B = await crearCurso(colegio.id, { nombre: "5B", grado: "Quinto", anioLectivo: "2026" });
        await crearCurso(colegio.id, { nombre: "6A", grado: "Sexto", anioLectivo: "2026" });

        await crearEstudiante(curso5A.id, colegio.id, { nombre: "Ana" });
        await crearEstudiante(curso5B.id, colegio.id, { nombre: "Luis" });
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const alumno6A = await crearEstudiante(curso5B.id, colegio.id, { nombre: "Carlos" });
        await crearIdentificadorEstudiante(alumno6A.id, { valor: "+57300X", plataformaId: plataforma!.id, etiquetaRelacion: "ESTUDIANTE" });

        const reporte = await crearReporte("+57300X", plataforma!.id, "CLASIFICADO", "OFRECIMIENTO_REGALOS");
        await notificarColegioSiCorresponde(reporte.id);

        const res = await GET(request("http://localhost:5005/api/colegio/analisis/comparativa", mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.colegioId).toBe(colegio.id);
        expect(json.agruparPor).toBe("grado");
        expect(json.grupos).toHaveLength(2);

        const quinto = json.grupos.find((g: { grupo: string }) => g.grupo === "Quinto");
        expect(quinto).toMatchObject({ cursos: 2, estudiantes: 3, identificadores: 1, alertas: 1, promedioEstudiantes: 1.5 });

        const sexto = json.grupos.find((g: { grupo: string }) => g.grupo === "Sexto");
        expect(sexto).toMatchObject({ cursos: 1, estudiantes: 0, identificadores: 0, alertas: 0, promedioEstudiantes: 0 });
    });

    it("agrupa cursos por año lectivo cuando se solicita", async () => {
        const { colegio } = await setupSchoolAdmin();
        await crearCurso(colegio.id, { nombre: "5A", grado: "Quinto", anioLectivo: "2025" });
        await crearCurso(colegio.id, { nombre: "5B", grado: "Quinto", anioLectivo: "2026" });

        const res = await GET(
            request("http://localhost:5005/api/colegio/analisis/comparativa?agruparPor=anioLectivo", mockToken)
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.agruparPor).toBe("anioLectivo");
        expect(json.grupos).toHaveLength(2);
    });

    it("devuelve 400 para criterio de agrupación inválido", async () => {
        const { colegio } = await setupSchoolAdmin();
        await crearCurso(colegio.id, { nombre: "5A", grado: "Quinto" });
        const res = await GET(
            request("http://localhost:5005/api/colegio/analisis/comparativa?agruparPor=invalido", mockToken)
        );
        expect(res.status).toBe(400);
    });

    it("ADMIN recibe 403", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await GET(request("http://localhost:5005/api/colegio/analisis/comparativa", mockToken));
        expect(res.status).toBe(403);
    });

    it("no expone PII en la respuesta", async () => {
        const { colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "5A", grado: "Quinto" });
        await crearEstudiante(curso.id, colegio.id, { nombre: "Ana Pérez" });

        const res = await GET(request("http://localhost:5005/api/colegio/analisis/comparativa", mockToken));
        const json = await res.json();
        const respuesta = JSON.stringify(json);
        expect(respuesta).not.toContain("Ana Pérez");
    });
});
