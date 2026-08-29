import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
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

describe("GET /api/admin/comite/guias-accion", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    async function crearGuia(adminId: string, estado: "BORRADOR" | "PENDIENTE_APROBACION_COMITE") {
        return prisma.guiaAccionCategoria.create({
            data: {
                categoria: "GROOMING",
                versionSecuencial: 1,
                tituloEmocional: "Título",
                categoriaBadgeTexto: "Badge",
                pasosJson: [{ orden: 1, tipo: "TRANQUILIDAD", titulo: "Paso", descripcion: "Desc" }],
                botonesAccionJson: [{ tipo: "tel", texto: "Llamar", valor: "141", estilo: "primario" }],
                estado,
                creadaPorAdminId: adminId,
            },
        });
    }

    it("lista solo guías pendientes para COMITE_VALIDACION", async () => {
        const admin = await crearUsuario("ADMIN", `admin-${Date.now()}@test.local`);
        const comite = await crearUsuario("COMITE_VALIDACION", `comite-${Date.now()}@test.local`);
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        await crearGuia(admin.id, "PENDIENTE_APROBACION_COMITE");
        await crearGuia(admin.id, "BORRADOR");

        const res = await GET(new Request("http://localhost:5005/api/admin/comite/guias-accion"));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].estado).toBe("PENDIENTE_APROBACION_COMITE");
    });
});
