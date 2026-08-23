/**
 * SPEC-203 (002-PI-100): tests de preferencias de notificación del usuario final.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function crearPlantilla(clave: string, canal: "EMAIL" | "IN_APP") {
    return prisma.notificacionPlantilla.create({
        data: { clave, canal, cuerpoMarkdown: "Cuerpo {{nombre}}", asunto: canal === "EMAIL" ? "Asunto" : null },
    });
}

async function crearRegla(
    evento: string,
    rol: string,
    canal: "EMAIL" | "IN_APP",
    plantillaClave: string,
    obligatoria = false
) {
    return prisma.notificacionRegla.create({
        data: { evento, rol, offset: "+0m", canal, plantillaClave, obligatoria, activa: true },
    });
}

describe("GET /api/notificaciones/preferencias", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("devuelve reglas aplicables al rol con preferencia por defecto habilitada", async () => {
        const user = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(user.id, "PARENT");
        const plantilla = await crearPlantilla("reporte.resuelto.email", "EMAIL");
        await crearRegla("reporte.resuelto", "PARENT", "EMAIL", plantilla.clave);

        const res = await GET(crearRequestAutenticado("GET", "http://localhost:5005/api/notificaciones/preferencias", undefined, mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.preferencias).toHaveLength(1);
        expect(json.preferencias[0].evento).toBe("reporte.resuelto");
        expect(json.preferencias[0].canales).toHaveLength(1);
        expect(json.preferencias[0].canales[0]).toMatchObject({
            eventoRegla: "reporte.resuelto.email",
            obligatoria: false,
            habilitado: true,
        });
    });

    it("respeta preferencia deshabilitada previamente guardada", async () => {
        const user = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(user.id, "PARENT");
        const plantilla = await crearPlantilla("reporte.resuelto.email", "EMAIL");
        await crearRegla("reporte.resuelto", "PARENT", "EMAIL", plantilla.clave);
        await prisma.notificacionPreferencia.create({
            data: { usuarioId: user.id, eventoRegla: "reporte.resuelto.email", habilitado: false },
        });

        const res = await GET(crearRequestAutenticado("GET", "http://localhost:5005/api/notificaciones/preferencias", undefined, mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.preferencias[0].canales[0].habilitado).toBe(false);
    });

    it("sin sesión devuelve 401", async () => {
        const res = await GET(crearRequestAutenticado("GET", "http://localhost:5005/api/notificaciones/preferencias", undefined));
        expect(res.status).toBe(401);
    });
});
