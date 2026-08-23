import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
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

describe("POST /api/admin/guias-accion/[id]/enviar-comite", () => {
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

    it("envía guía al comité", async () => {
        const admin = await crearUsuario("ADMIN", `admin-${Date.now()}@test.local`);
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const guia = await crearGuia(admin.id);

        const res = await POST(
            new Request(`http://localhost:5005/api/admin/guias-accion/${guia.id}/enviar-comite`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            }),
            { params: Promise.resolve({ id: guia.id }) }
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.guia.estado).toBe("PENDIENTE_APROBACION_COMITE");
    });
});
