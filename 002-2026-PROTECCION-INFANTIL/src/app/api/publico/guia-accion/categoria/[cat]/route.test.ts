import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario } from "@/lib/reporte-test-utils";

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: () => undefined,
    }),
}));

describe("GET /api/publico/guia-accion/categoria/[cat]", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
    });

    it("devuelve guía activa por categoría", async () => {
        const admin = await crearUsuario("ADMIN", `admin-${Date.now()}@test.local`);
        await prisma.guiaAccionCategoria.create({
            data: {
                categoria: "GROOMING",
                versionSecuencial: 1,
                tituloEmocional: "Activa",
                categoriaBadgeTexto: "Badge",
                pasosJson: [{ orden: 1, tipo: "TRANQUILIDAD", titulo: "Paso", descripcion: "Desc" }],
                botonesAccionJson: [{ tipo: "tel", texto: "Llamar", valor: "141", estilo: "primario" }],
                estado: "ACTIVA",
                creadaPorAdminId: admin.id,
            },
        });

        const res = await GET(
            new Request("http://localhost:5005/api/publico/guia-accion/categoria/GROOMING"),
            { params: Promise.resolve({ cat: "GROOMING" }) }
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.guia.categoria).toBe("GROOMING");
        expect(json.guia.estado).toBe("ACTIVA");
    });

    it("devuelve 404 si no hay guía activa", async () => {
        const res = await GET(
            new Request("http://localhost:5005/api/publico/guia-accion/categoria/INEXISTENTE"),
            { params: Promise.resolve({ cat: "INEXISTENTE" }) }
        );
        expect(res.status).toBe(404);
    });
});
