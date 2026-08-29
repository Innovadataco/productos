import { describe, it, expect, beforeEach, vi } from "vitest";
import { PATCH } from "./route";
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

describe("PATCH /api/admin/guias-accion/[id]", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    async function crearGuia(adminId: string) {
        return prisma.guiaAccionCategoria.create({
            data: {
                categoria: "GROOMING",
                versionSecuencial: 1,
                tituloEmocional: "Título",
                categoriaBadgeTexto: "Badge",
                pasosJson: [{ orden: 1, tipo: "TRANQUILIDAD", titulo: "Paso", descripcion: "Desc" }],
                botonesAccionJson: [{ tipo: "tel", texto: "Llamar", valor: "141", estilo: "primario" }],
                estado: "BORRADOR",
                creadaPorAdminId: adminId,
            },
        });
    }

    it("edita título de guía en BORRADOR", async () => {
        const admin = await crearUsuario("ADMIN", `admin-${Date.now()}@test.local`);
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const guia = await crearGuia(admin.id);

        const res = await PATCH(
            new Request(`http://localhost:5005/api/admin/guias-accion/${guia.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tituloEmocional: "Editado" }),
            }),
            { params: Promise.resolve({ id: guia.id }) }
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.guia.tituloEmocional).toBe("Editado");
    });
});
