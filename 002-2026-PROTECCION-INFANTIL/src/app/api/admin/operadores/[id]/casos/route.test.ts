import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function crearOperadorConPerfil(adminId: string, email: string) {
    const usuario = await crearUsuario("OPERADOR", email);
    await prisma.perfilOperador.create({
        data: { usuarioId: usuario.id, creadoPorId: adminId, cupoMaximo: 10, esComite: false },
    });
    return usuario;
}

async function crearReporte(operadorId: string, plataformaId: string, estado: "REVISION_MANUAL" | "CORREGIDO") {
    const reporte = await prisma.reporte.create({
        data: {
            identificador: `+57300${Math.floor(Math.random() * 1000000)}`,
            plataformaId,
            texto: "Texto de prueba.",
            fechaIncidente: new Date("2026-08-15T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            operadorId,
            estado,
            numeroSeguimiento: `RPT-${Math.floor(Math.random() * 1000000)}`,
            eliminado: false,
        },
    });
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria: "CONTACTO_INSISTENTE",
            confianza: 0.9,
            contienePii: false,
            piiDetectada: [],
            modeloUsado: "ornith:9b",
            latenciaMs: 100,
        },
    });
    return reporte;
}

describe("GET /api/admin/operadores/[id]/casos", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPaisCiudad();
        await crearPlataforma();
        mockToken = undefined;
    });

    it("devuelve casos paginados del operador", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearOperadorConPerfil(admin.id, "op@test.com");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const plataforma = await crearPlataforma();

        await crearReporte(operador.id, plataforma.id, "REVISION_MANUAL");
        await crearReporte(operador.id, plataforma.id, "CORREGIDO");

        const res = await GET(
            new Request(`http://localhost:5005/api/admin/operadores/${operador.id}/casos?page=1&pageSize=10`, {
                headers: { cookie: `token=${mockToken}` },
            }),
            { params: Promise.resolve({ id: operador.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(2);
        expect(json.pagination.total).toBe(2);
        expect(json.pagination.page).toBe(1);
    });

    it("filtra por estado", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearOperadorConPerfil(admin.id, "op@test.com");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const plataforma = await crearPlataforma();

        await crearReporte(operador.id, plataforma.id, "REVISION_MANUAL");
        await crearReporte(operador.id, plataforma.id, "CORREGIDO");
        await crearReporte(operador.id, plataforma.id, "CORREGIDO");

        const res = await GET(
            new Request(`http://localhost:5005/api/admin/operadores/${operador.id}/casos?estado=CORREGIDO`, {
                headers: { cookie: `token=${mockToken}` },
            }),
            { params: Promise.resolve({ id: operador.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(2);
        expect(json.items.every((r: { estado: string }) => r.estado === "CORREGIDO")).toBe(true);
    });

    it("respeta pageSize y paginación", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearOperadorConPerfil(admin.id, "op@test.com");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const plataforma = await crearPlataforma();

        for (let i = 0; i < 5; i++) {
            await crearReporte(operador.id, plataforma.id, "REVISION_MANUAL");
        }

        const res = await GET(
            new Request(`http://localhost:5005/api/admin/operadores/${operador.id}/casos?page=1&pageSize=2`, {
                headers: { cookie: `token=${mockToken}` },
            }),
            { params: Promise.resolve({ id: operador.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(2);
        expect(json.pagination.totalPages).toBe(3);
    });
});
