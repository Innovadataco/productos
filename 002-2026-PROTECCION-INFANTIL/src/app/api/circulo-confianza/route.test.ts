import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearPlataforma, crearPaisCiudad, crearParametrosReportes } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("/api/circulo-confianza", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        await prisma.parametroSistema.createMany({
            data: [
                { clave: "circulo.max_contactos", valor: "20", tipo: "INTEGER", categoria: "SECURITY", esPublico: false, descripcion: "" },
                { clave: "circulo.umbral_agregacion", valor: '{"contactosConReportes":2,"totalReportes":3}', tipo: "JSON", categoria: "SECURITY", esPublico: false, descripcion: "" },
                { clave: "circulo.notificaciones.enabled", valor: "true", tipo: "BOOLEAN", categoria: "EMAIL", esPublico: false, descripcion: "" },
                { clave: "circulo.notificaciones.cooldown_horas", valor: "24", tipo: "INTEGER", categoria: "EMAIL", esPublico: false, descripcion: "" },
            ],
        });
    });

    it("GET rechaza sin autenticación", async () => {
        const req = new Request("http://localhost:5005/api/circulo-confianza");
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it("GET devuelve contactos del usuario autenticado", async () => {
        const user = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(user.id, "PARENT");
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await prisma.contactoConfianza.create({
            data: {
                usuarioId: user.id,
                identificador: "+57300111111",
                plataformaId: plataforma!.id,
                etiqueta: "tío",
            },
        });

        const req = new Request("http://localhost:5005/api/circulo-confianza");
        const res = await GET(req);
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.contactos).toHaveLength(1);
        expect(json.contactos[0].identificador).toBe("+57300111111");
    });

    it("POST crea contacto con cookie", async () => {
        const user = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(user.id, "PARENT");
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });

        const req = new Request("http://localhost:5005/api/circulo-confianza", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identificador: "+57300222222", plataformaId: plataforma!.id, etiqueta: "primo" }),
        });

        const res = await POST(req);
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.identificador).toBe("+57300222222");
    });
});
