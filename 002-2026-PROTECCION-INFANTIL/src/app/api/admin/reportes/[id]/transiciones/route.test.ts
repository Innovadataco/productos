import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad, crearUsuario, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import { registrarTransicion } from "@/lib/reporte-transiciones";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function crearReporteConTransiciones(operadorId: string) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const usuario = await crearUsuario("PARENT");
    const reporte = await prisma.reporte.create({
        data: {
            identificador: "+57300TRANS01",
            plataformaId: plataforma!.id,
            texto: "Texto de prueba para transiciones de reporte con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            usuarioId: usuario.id,
            numeroSeguimiento: `RPT-${Date.now()}`,
            estado: "PENDIENTE",
        },
    });

    await registrarTransicion({
        reporteId: reporte.id,
        estadoAnterior: "PENDIENTE",
        estadoNuevo: "PROCESANDO",
        responsableTipo: "WORKER",
        metadatos: { latenciaMs: 100 },
    });
    await prisma.reporte.update({ where: { id: reporte.id }, data: { estado: "PROCESANDO" } });

    await registrarTransicion({
        reporteId: reporte.id,
        estadoAnterior: "PROCESANDO",
        estadoNuevo: "CLASIFICADO",
        responsableTipo: "IA",
    });
    await prisma.reporte.update({ where: { id: reporte.id }, data: { estado: "CLASIFICADO" } });

    await registrarTransicion({
        reporteId: reporte.id,
        estadoAnterior: "CLASIFICADO",
        estadoNuevo: "REVISION_MANUAL",
        responsableTipo: "OPERADOR",
        responsableId: operadorId,
        motivo: "Requiere revisión humana",
    });
    await prisma.reporte.update({ where: { id: reporte.id }, data: { estado: "REVISION_MANUAL" } });

    return reporte;
}

describe("GET /api/admin/reportes/[id]/transiciones", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
    });

    it("devuelve el timeline ordenado cronológicamente", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const reporte = await crearReporteConTransiciones(admin.id);

        const req = crearRequestAutenticado(
            "GET",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/transiciones`,
            null,
            mockToken
        );
        const res = await GET(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.transiciones).toHaveLength(3);

        const estados = body.transiciones.map((t: { estadoNuevo: string }) => t.estadoNuevo);
        expect(estados).toEqual(["PROCESANDO", "CLASIFICADO", "REVISION_MANUAL"]);

        const tipos = body.transiciones.map((t: { responsableTipo: string }) => t.responsableTipo);
        expect(tipos).toEqual(["WORKER", "IA", "OPERADOR"]);
    });

    it("filtra por responsableTipo", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const reporte = await crearReporteConTransiciones(admin.id);

        const req = crearRequestAutenticado(
            "GET",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/transiciones?responsableTipo=OPERADOR`,
            null,
            mockToken
        );
        const res = await GET(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.transiciones).toHaveLength(1);
        expect(body.transiciones[0].responsableTipo).toBe("OPERADOR");
        expect(body.transiciones[0].responsableUsuario).not.toBeNull();
        expect(body.transiciones[0].responsableUsuario.id).toBe(admin.id);
    });

    it("rechaza filtro de responsableTipo inválido", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const reporte = await crearReporteConTransiciones(admin.id);

        const req = crearRequestAutenticado(
            "GET",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/transiciones?responsableTipo=INVALIDO`,
            null,
            mockToken
        );
        const res = await GET(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(400);
    });

    it("rechaza si el usuario no es admin ni operador", async () => {
        const parent = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(parent.id, "PARENT");
        const admin = await crearUsuario("ADMIN");
        const reporte = await crearReporteConTransiciones(admin.id);

        const req = crearRequestAutenticado(
            "GET",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/transiciones`,
            null,
            mockToken
        );
        const res = await GET(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(403);
    });

    it("devuelve 404 para reporte inexistente", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "GET",
            "http://localhost:5005/api/admin/reportes/cm00000000000000000000000/transiciones",
            null,
            mockToken
        );
        const res = await GET(req, { params: Promise.resolve({ id: "cm00000000000000000000000" }) });
        expect(res.status).toBe(404);
    });

    it("no expone textoOriginal del reporte", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const reporte = await crearReporteConTransiciones(admin.id);
        await prisma.reporte.update({
            where: { id: reporte.id },
            data: { textoOriginal: "texto original sensible" },
        });

        const req = crearRequestAutenticado(
            "GET",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/transiciones`,
            null,
            mockToken
        );
        const res = await GET(req, { params: Promise.resolve({ id: reporte.id }) });
        const text = await res.text();
        expect(text).not.toContain("texto original sensible");
    });
});

// Tests de integridad append-only: la API no expone endpoints de mutación.
// DELETE y PATCH sobre una transición no existen, por lo que Next.js devuelve 404.

describe("TransicionReporte append-only", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
    });

    it("no expone endpoints de mutación (append-only)", async () => {
        const route = await import("./route");
        expect("GET" in route).toBe(true);
        expect("DELETE" in route).toBe(false);
        expect("PATCH" in route).toBe(false);
        expect("POST" in route).toBe(false);
        expect("PUT" in route).toBe(false);
    });
});
