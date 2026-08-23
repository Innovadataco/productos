/**
 * SPEC-203 (002-PI-100): tests del endpoint unificado de notificaciones del usuario final.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST, PATCH } from "./route";
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

async function crearNotificacionInApp(usuarioId: string, plantillaClave: string, evento = "reporte.resuelto") {
    return prisma.notificacion.create({
        data: {
            evento,
            destinatarioUsuarioId: usuarioId,
            destinatarioEmail: "test@example.com",
            plantillaClave,
            canal: "IN_APP",
            variables: { nombre: "Test" },
            estado: "ENVIADA",
        },
    });
}

describe("/api/notificaciones", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("GET lista notificaciones in-app del usuario", async () => {
        const user = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(user.id, "PARENT");
        const plantilla = await crearPlantilla("reporte.resuelto.in_app", "IN_APP");
        await crearNotificacionInApp(user.id, plantilla.clave);

        const res = await GET(crearRequestAutenticado("GET", "http://localhost:5005/api/notificaciones", undefined, mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(1);
        expect(json.total).toBe(1);
        expect(json.items[0].titulo).toBe("reporte.resuelto");
    });

    it("GET /resumen devuelve el conteo de no leídas", async () => {
        const user = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(user.id, "PARENT");
        const plantilla = await crearPlantilla("reporte.resuelto.in_app", "IN_APP");
        await crearNotificacionInApp(user.id, plantilla.clave);
        await prisma.notificacion.create({
            data: {
                evento: "reporte.resuelto",
                destinatarioUsuarioId: user.id,
                destinatarioEmail: "test@example.com",
                plantillaClave: plantilla.clave,
                canal: "IN_APP",
                variables: {},
                estado: "ABIERTA",
                openedAt: new Date(),
            },
        });

        const { GET: resumen } = await import("./resumen/route");
        const res = await resumen(crearRequestAutenticado("GET", "http://localhost:5005/api/notificaciones/resumen", undefined, mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.noLeidas).toBe(1);
    });

    it("POST marca todas las notificaciones como leídas", async () => {
        const user = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(user.id, "PARENT");
        const plantilla = await crearPlantilla("reporte.resuelto.in_app", "IN_APP");
        await crearNotificacionInApp(user.id, plantilla.clave);
        await crearNotificacionInApp(user.id, plantilla.clave);

        const res = await POST(crearRequestAutenticado("POST", "http://localhost:5005/api/notificaciones", {}, mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.afectadas).toBe(2);
        const noLeidas = await prisma.notificacion.count({
            where: { destinatarioUsuarioId: user.id, canal: "IN_APP", estado: { in: ["ENCOLADA", "ENVIADA"] } },
        });
        expect(noLeidas).toBe(0);
    });

    it("PATCH actualiza preferencia no obligatoria", async () => {
        const user = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(user.id, "PARENT");
        const plantilla = await crearPlantilla("reporte.resuelto.email", "EMAIL");
        await crearRegla("reporte.resuelto", "PARENT", "EMAIL", plantilla.clave);

        const res = await PATCH(
            crearRequestAutenticado("PATCH", "http://localhost:5005/api/notificaciones", { eventoRegla: "reporte.resuelto.email", habilitado: false }, mockToken)
        );
        expect(res.status).toBe(200);
        const pref = await prisma.notificacionPreferencia.findUnique({
            where: { usuarioId_eventoRegla: { usuarioId: user.id, eventoRegla: "reporte.resuelto.email" } },
        });
        expect(pref?.habilitado).toBe(false);
    });

    it("PATCH rechaza deshabilitar regla obligatoria", async () => {
        const user = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(user.id, "PARENT");
        const plantilla = await crearPlantilla("suscripcion.por_vencer.email", "EMAIL");
        await crearRegla("suscripcion.por_vencer", "PARENT", "EMAIL", plantilla.clave, true);

        const res = await PATCH(
            crearRequestAutenticado("PATCH", "http://localhost:5005/api/notificaciones", { eventoRegla: "suscripcion.por_vencer.email", habilitado: false }, mockToken)
        );
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toBe("regla_obligatoria");
    });

    it("sin sesión devuelve 401", async () => {
        const res = await GET(crearRequestAutenticado("GET", "http://localhost:5005/api/notificaciones", undefined));
        expect(res.status).toBe(401);
    });
});
