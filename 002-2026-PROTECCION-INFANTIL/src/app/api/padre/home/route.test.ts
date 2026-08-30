/**
 * SPEC-309 (A-50): tests de integración de GET /api/padre/home.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearPlataforma } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function requestHome() {
    return new Request("http://localhost:5005/api/padre/home", { method: "GET" });
}

async function crearContactoConIdentificador(usuarioId: string, etiqueta: string, valor: string) {
    return prisma.contactoConfianza.create({
        data: {
            usuarioId,
            etiqueta,
            activo: true,
            identificadores: {
                create: { valor, tipo: "telefono", activo: true },
            },
        },
    });
}

async function crearReporteVisible(identificador: string) {
    const plataforma = await crearPlataforma("whatsapp", "WhatsApp");
    return prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma.id,
            texto: "Reporte de prueba",
            textoOriginal: "Reporte de prueba",
            fechaIncidente: new Date(),
            ciudad: "Bogotá",
            pais: "Colombia",
            estado: "CLASIFICADO",
            esAnonimo: false,
            clasificacion: {
                create: { categoria: "SOLICITUD_MATERIAL", confianza: 0.85, modeloUsado: "ornith:9b", latenciaMs: 120 },
            },
        },
    });
}

describe("/api/padre/home (SPEC-309)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("200: devuelve payload completo del home para padre autenticado", async () => {
        const padre = await crearUsuario("PARENT", "padre@example.com");
        await prisma.usuario.update({ where: { id: padre.id }, data: { nombre: "Carlos" } });
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await GET(requestHome());
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.data.saludo).toContain("Carlos");
        expect(json.data.fechaHoy).toBeTruthy();
        expect(json.data.resumen).toEqual({ totalContactos: 0, sinReportes: 0, enRevision: 0, clasificados: 0 });
        expect(json.data.semaforo).toEqual([]);
        expect(json.data.timeline).toEqual([]);
        expect(json.data.accesos.length).toBeGreaterThanOrEqual(3);
    });

    it("200: incluye resumen y semáforo con contactos y reportes", async () => {
        const padre = await crearUsuario("PARENT", "padre@example.com");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        await crearContactoConIdentificador(padre.id, "Hijo", "+573001111111");
        await crearReporteVisible("+573001111111");

        const res = await GET(requestHome());
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.data.resumen.totalContactos).toBe(1);
        expect(json.data.resumen.clasificados).toBe(1);
        expect(json.data.semaforo).toHaveLength(1);
        expect(json.data.semaforo[0].etiqueta).toBe("Hijo");
    });

    it("403: un rol distinto de PARENT no puede consultar", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(requestHome());
        expect(res.status).toBe(403);
    });

    it("401: sin sesión", async () => {
        const res = await GET(requestHome());
        expect(res.status).toBe(401);
    });
});
