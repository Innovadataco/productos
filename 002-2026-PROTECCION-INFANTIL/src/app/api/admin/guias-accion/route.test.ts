import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

const guiaPayload = {
    categoria: "GROOMING",
    tituloEmocional: "Título",
    categoriaBadgeTexto: "Badge",
    pasosJson: [{ orden: 1, tipo: "TRANQUILIDAD", titulo: "Paso", descripcion: "Desc" }],
    botonesAccionJson: [{ tipo: "tel", texto: "Llamar", valor: "141", estilo: "primario" }],
};

describe("GET /api/admin/guias-accion", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("lista guías para ADMIN", async () => {
        const admin = await crearUsuario("ADMIN", `admin-${Date.now()}@test.local`);
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        await prisma.guiaAccionCategoria.create({
            data: {
                categoria: "GROOMING",
                versionSecuencial: 1,
                tituloEmocional: "Título",
                categoriaBadgeTexto: "Badge",
                pasosJson: [{ orden: 1, tipo: "TRANQUILIDAD", titulo: "Paso", descripcion: "Desc" }],
                botonesAccionJson: [{ tipo: "tel", texto: "Llamar", valor: "141", estilo: "primario" }],
                estado: "BORRADOR",
                creadaPorAdminId: admin.id,
            },
        });

        const res = await GET(new Request("http://localhost:5005/api/admin/guias-accion"));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(1);
        expect(json.pagination.total).toBe(1);
    });

    it("rechaza COMITE_VALIDACION", async () => {
        const comite = await crearUsuario("COMITE_VALIDACION", `comite-${Date.now()}@test.local`);
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");

        const res = await GET(new Request("http://localhost:5005/api/admin/guias-accion"));
        expect(res.status).toBe(403);
    });
});

describe("POST /api/admin/guias-accion", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("crea guía en BORRADOR", async () => {
        const admin = await crearUsuario("ADMIN", `admin-${Date.now()}@test.local`);
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await POST(
            new Request("http://localhost:5005/api/admin/guias-accion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(guiaPayload),
            })
        );
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.guia.estado).toBe("BORRADOR");
        expect(json.guia.versionSecuencial).toBe(1);
    });
});
