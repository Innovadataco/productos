/**
 * SPEC-169 (Fase G): tests de GET/PATCH /api/colegio/onboarding.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearTokenUsuario, crearColegioConAdmin } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function request(method: string, url: string, body?: unknown, token?: string): Request {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.cookie = `token=${token}`;
    return new Request(url, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
}

async function setupSchoolAdmin() {
    const { admin, colegio } = await crearColegioConAdmin();
    await prisma.onboardingColegio.create({
        data: { colegioId: colegio.id, estado: "activo", pasoActual: 1 },
    });
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    return { admin, colegio };
}

describe("/api/colegio/onboarding", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("GET devuelve el onboarding calculado con pasos pendientes para colegio vacío", async () => {
        await setupSchoolAdmin();
        const res = await GET(request("GET", "http://localhost:5005/api/colegio/onboarding", undefined, mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.onboarding.estado).toBe("activo");
        expect(json.onboarding.pasos).toHaveLength(5);
        expect(json.onboarding.pasos[0]?.estado).toBe("pendiente");
    });

    it("GET refleja pasos completados a medida que se cargan datos", async () => {
        const { colegio } = await setupSchoolAdmin();
        const curso = await prisma.curso.create({
            data: { colegioId: colegio.id, nombre: "6A", estado: "activo" },
        });
        await prisma.estudiante.create({ data: { cursoId: curso.id, colegioId: colegio.id, nombre: "Ana", apellidos: "López" } });
        await prisma.profesor.create({ data: { colegioId: colegio.id, nombre: "Carlos", apellidos: "Pérez" } });

        const res = await GET(request("GET", "http://localhost:5005/api/colegio/onboarding", undefined, mockToken));
        const json = await res.json();
        expect(json.onboarding.pasos[0]?.estado).toBe("completado");
        expect(json.onboarding.pasos[1]?.estado).toBe("completado");
        expect(json.onboarding.pasos[2]?.estado).toBe("completado");
        expect(json.onboarding.pasos[3]?.estado).toBe("pendiente");
    });

    it("GET con onboarding completado incluye resumen con conteos aislados por colegio", async () => {
        const { colegio } = await setupSchoolAdmin();
        await prisma.onboardingColegio.updateMany({
            where: { colegioId: colegio.id },
            data: { estado: "completado", completadoEn: new Date() },
        });
        const curso = await prisma.curso.create({
            data: { colegioId: colegio.id, nombre: "6A", estado: "activo" },
        });
        await prisma.estudiante.create({ data: { cursoId: curso.id, colegioId: colegio.id, nombre: "Ana", apellidos: "López" } });
        await prisma.estudiante.create({ data: { cursoId: curso.id, colegioId: colegio.id, nombre: "Luis", apellidos: "Gómez" } });
        await prisma.profesor.create({ data: { colegioId: colegio.id, nombre: "Carlos", apellidos: "Pérez" } });

        // Datos de OTRO colegio no deben contarse en el resumen.
        const { colegio: otroColegio } = await crearColegioConAdmin();
        await prisma.profesor.create({ data: { colegioId: otroColegio.id, nombre: "Otro", apellidos: "Profesor" } });

        const res = await GET(request("GET", "http://localhost:5005/api/colegio/onboarding", undefined, mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.onboarding.estado).toBe("completado");
        expect(json.onboarding.resumen).toEqual({ estudiantes: 2, cursos: 1, profesores: 1 });
    });

    it("PATCH a 'omitido' oculta el onboarding y audita", async () => {
        const { colegio } = await setupSchoolAdmin();
        const res = await PATCH(
            request("PATCH", "http://localhost:5005/api/colegio/onboarding", { estado: "omitido" }, mockToken)
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.onboarding.estado).toBe("omitido");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_ONBOARDING_OMITIDO", colegioId: colegio.id },
        });
        expect(audit).not.toBeNull();
    });

    it("PATCH a 'activo' reactiva el onboarding y audita", async () => {
        const { colegio } = await setupSchoolAdmin();
        await prisma.onboardingColegio.updateMany({
            where: { colegioId: colegio.id },
            data: { estado: "omitido" },
        });

        const res = await PATCH(
            request("PATCH", "http://localhost:5005/api/colegio/onboarding", { estado: "activo" }, mockToken)
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.onboarding.estado).toBe("activo");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_ONBOARDING_REACTIVADO", colegioId: colegio.id },
        });
        expect(audit).not.toBeNull();
    });

    it("rechaza estado inválido (400)", async () => {
        await setupSchoolAdmin();
        const res = await PATCH(
            request("PATCH", "http://localhost:5005/api/colegio/onboarding", { estado: "completado" }, mockToken)
        );
        expect(res.status).toBe(400);
    });

    it("sin sesión devuelve 401", async () => {
        await setupSchoolAdmin();
        mockToken = undefined;
        const res = await GET(request("GET", "http://localhost:5005/api/colegio/onboarding"));
        expect(res.status).toBe(401);
    });
});
