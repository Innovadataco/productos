/**
 * SPEC-380 (PR A · C4) — análisis persistente del comité. Afirma:
 *   · el comité guarda análisis mientras el caso está PENDIENTE;
 *   · el rector puede LEER pero no editar (PUT le da 403);
 *   · un caso ya RESUELTO no acepta más ediciones del análisis (409);
 *   · el texto vacío se rechaza en el schema (400);
 *   · la audit deja rastro sin PII del texto.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { GET, PUT } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearColegioConAdmin, crearUsuario, crearTokenUsuario, crearPlataforma } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function seedCasoConComite() {
    const { admin, colegio } = await crearColegioConAdmin();
    const comite = await prisma.usuario.create({
        data: {
            email: `comite-${Date.now()}@test.local`,
            passwordHash: "x",
            rol: "COMITE_CONVIVENCIA",
            estado: "activo",
            comiteColegioId: colegio.id,
        },
    });
    const plataforma = await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
    const reporte = await prisma.reporte.create({
        data: {
            identificador: `+57300${Date.now()}${Math.floor(Math.random() * 1000)}`,
            plataformaId: plataforma.id,
            texto: "Texto anonimizado",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            estado: "REVISION_MANUAL",
            esAnonimo: true,
        },
    });
    const solicitud = await prisma.solicitudComite.create({
        data: {
            reporteId: reporte.id,
            numero: `SOL-${Date.now()}`,
            estado: "PENDIENTE",
            colegioId: colegio.id,
            motivo: "Escalamiento por gravedad",
        },
    });
    return { admin, colegio, comite, solicitud };
}

function req(method: "GET" | "PUT", solicitudId: string, body?: unknown): Request {
    return new Request(`http://localhost:5005/api/colegio/comite/solicitudes/${solicitudId}/analisis`, {
        method,
        headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
}

describe("PUT/GET /api/colegio/comite/solicitudes/[id]/analisis (SPEC-380)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => prisma.$disconnect());

    it("el comité guarda el análisis mientras el caso está PENDIENTE", async () => {
        const { comite, solicitud } = await seedCasoConComite();
        mockToken = await crearTokenUsuario(comite.id, "COMITE_CONVIVENCIA");

        const res = await PUT(req("PUT", solicitud.id, { texto: "Deliberación completa del comité." }), {
            params: Promise.resolve({ id: solicitud.id }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.analisis).toBe("Deliberación completa del comité.");
        expect(body.analisisActualizadoEn).toBeDefined();
        expect(body.analisisPor?.id).toBe(comite.id);

        // Fila en BD.
        const enBd = await prisma.solicitudComite.findUnique({ where: { id: solicitud.id } });
        expect(enBd?.analisis).toBe("Deliberación completa del comité.");
        expect(enBd?.analisisPorId).toBe(comite.id);

        // Audit sin PII del texto (solo longitud).
        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COMITE_ANALISIS_ACTUALIZADO", recursoId: solicitud.id },
        });
        expect(audit).not.toBeNull();
        expect(audit?.valorNuevo).toContain("longitud");
        expect(audit?.valorNuevo).not.toContain("Deliberación");
    });

    it("el rector (SCHOOL_ADMIN) puede LEER el análisis pero NO editarlo", async () => {
        const { admin, comite, solicitud } = await seedCasoConComite();
        // Comité escribe.
        mockToken = await crearTokenUsuario(comite.id, "COMITE_CONVIVENCIA");
        await PUT(req("PUT", solicitud.id, { texto: "Análisis privado del comité." }), {
            params: Promise.resolve({ id: solicitud.id }),
        });

        // Rector lee.
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        const resGet = await GET(req("GET", solicitud.id), { params: Promise.resolve({ id: solicitud.id }) });
        expect(resGet.status).toBe(200);
        const bodyGet = await resGet.json();
        expect(bodyGet.analisis).toBe("Análisis privado del comité.");

        // Rector intenta editar → verifyAuth("COMITE_CONVIVENCIA") lo corta.
        const resPut = await PUT(req("PUT", solicitud.id, { texto: "el rector no puede" }), {
            params: Promise.resolve({ id: solicitud.id }),
        });
        expect([401, 403]).toContain(resPut.status);
    });

    it("caso RESUELTO → PUT devuelve 409 (el análisis quedó tal cual para el informe)", async () => {
        const { comite, solicitud } = await seedCasoConComite();
        await prisma.solicitudComite.update({
            where: { id: solicitud.id },
            data: { estado: "RESUELTO", resolucion: "cerrado" },
        });
        mockToken = await crearTokenUsuario(comite.id, "COMITE_CONVIVENCIA");
        const res = await PUT(req("PUT", solicitud.id, { texto: "quiero editar" }), {
            params: Promise.resolve({ id: solicitud.id }),
        });
        expect(res.status).toBe(409);
    });

    it("texto vacío → 400 (schema exige mín. 1 char)", async () => {
        const { comite, solicitud } = await seedCasoConComite();
        mockToken = await crearTokenUsuario(comite.id, "COMITE_CONVIVENCIA");
        const res = await PUT(req("PUT", solicitud.id, { texto: "   " }), {
            params: Promise.resolve({ id: solicitud.id }),
        });
        expect(res.status).toBe(400);
    });

    it("PARENT (rol equivocado) → 401", async () => {
        const parent = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(parent.id, "PARENT");
        const { solicitud } = await seedCasoConComite();
        const res = await PUT(req("PUT", solicitud.id, { texto: "x" }), {
            params: Promise.resolve({ id: solicitud.id }),
        });
        expect([401, 403]).toContain(res.status);
    });

    it("GET · caso de OTRO colegio → 404 (tenant-first)", async () => {
        const { comite: comiteA } = await seedCasoConComite();
        const { solicitud: solicitudB } = await seedCasoConComite();
        mockToken = await crearTokenUsuario(comiteA.id, "COMITE_CONVIVENCIA");
        const res = await GET(req("GET", solicitudB.id), {
            params: Promise.resolve({ id: solicitudB.id }),
        });
        expect(res.status).toBe(404);
    });
});
