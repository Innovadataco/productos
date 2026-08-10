import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad, crearUsuario, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import { registrarTransicion } from "@/lib/reporte-transiciones";
import { guardarReintento } from "@/lib/reporte-reintentos";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function crearReporteConEventos(adminId: string) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const usuario = await crearUsuario("PARENT");
    const reporte = await prisma.reporte.create({
        data: {
            identificador: "+57300PROCESO1",
            plataformaId: plataforma!.id,
            texto: "Texto de prueba para timeline de proceso con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            usuarioId: usuario.id,
            numeroSeguimiento: `RPT-${Date.now()}`,
            estado: "PENDIENTE",
        },
    });

    await guardarReintento({ reporteId: reporte.id, intento: 1, exitoso: false, error: "Ollama timeout" });

    await registrarTransicion({
        reporteId: reporte.id,
        estadoAnterior: "PENDIENTE",
        estadoNuevo: "PROCESANDO",
        responsableTipo: "WORKER",
    });
    await prisma.reporte.update({ where: { id: reporte.id }, data: { estado: "PROCESANDO" } });

    await guardarReintento({ reporteId: reporte.id, intento: 2, exitoso: true });

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
        responsableId: adminId,
        motivo: "Requiere revisión humana",
    });
    await prisma.reporte.update({ where: { id: reporte.id }, data: { estado: "REVISION_MANUAL" } });

    return reporte;
}

describe("GET /api/admin/reportes/[id]/proceso", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
    });

    it("devuelve transiciones y reintentos ordenados cronológicamente", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const reporte = await crearReporteConEventos(admin.id);

        const req = crearRequestAutenticado(
            "GET",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/proceso`,
            null,
            mockToken
        );
        const res = await GET(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.eventos).toHaveLength(5);

        const tipos = body.eventos.map((e: { tipo: string }) => e.tipo);
        expect(tipos).toEqual(["REINTENTO", "TRANSICION", "REINTENTO", "TRANSICION", "TRANSICION"]);

        const transiciones = body.eventos.filter((e: { tipo: string }) => e.tipo === "TRANSICION");
        expect(transiciones.map((t: { estadoNuevo: string }) => t.estadoNuevo)).toEqual([
            "PROCESANDO",
            "CLASIFICADO",
            "REVISION_MANUAL",
        ]);

        const reintentos = body.eventos.filter((e: { tipo: string }) => e.tipo === "REINTENTO");
        expect(reintentos.map((r: { intento: number }) => r.intento)).toEqual([1, 2]);
        expect(reintentos[0].exitoso).toBe(false);
        expect(reintentos[1].exitoso).toBe(true);
    });

    it("solo ADMIN puede consultar el timeline de proceso", async () => {
        const operador = await crearUsuario("OPERADOR");
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");
        const admin = await crearUsuario("ADMIN");
        const reporte = await crearReporteConEventos(admin.id);

        const req = crearRequestAutenticado(
            "GET",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/proceso`,
            null,
            mockToken
        );
        const res = await GET(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(403);
    });

    it("rechaza a roles no autorizados", async () => {
        const parent = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(parent.id, "PARENT");
        const admin = await crearUsuario("ADMIN");
        const reporte = await crearReporteConEventos(admin.id);

        const req = crearRequestAutenticado(
            "GET",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/proceso`,
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
            "http://localhost:5005/api/admin/reportes/cm00000000000000000000000/proceso",
            null,
            mockToken
        );
        const res = await GET(req, { params: Promise.resolve({ id: "cm00000000000000000000000" }) });
        expect(res.status).toBe(404);
    });

    it("no expone textoOriginal del reporte ni datos personales", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const reporte = await crearReporteConEventos(admin.id);
        await prisma.reporte.update({
            where: { id: reporte.id },
            data: { textoOriginal: "texto original sensible" },
        });

        const req = crearRequestAutenticado(
            "GET",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/proceso`,
            null,
            mockToken
        );
        const res = await GET(req, { params: Promise.resolve({ id: reporte.id }) });
        const text = await res.text();
        expect(text).not.toContain("texto original sensible");
        expect(text).not.toContain(reporte.texto);
    });
});
