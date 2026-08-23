import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST as POST_APROBAR } from "./route";
import { POST as POST_RECHAZAR } from "../rechazar/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { seedParametrosPadre } from "../../../../../../../../prisma/seed";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("POST /api/admin/comite/guias-accion/[id]/aprobar", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await seedParametrosPadre();
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
                estado: "PENDIENTE_APROBACION_COMITE",
                creadaPorAdminId: adminId,
            },
        });
    }

    it("primer voto no publica la guía", async () => {
        const admin = await crearUsuario("ADMIN", `admin-${Date.now()}@test.local`);
        const comite = await crearUsuario("COMITE_VALIDACION", `comite-${Date.now()}@test.local`);
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const guia = await crearGuia(admin.id);

        const res = await POST_APROBAR(
            new Request(`http://localhost:5005/api/admin/comite/guias-accion/${guia.id}/aprobar`, {
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

    it("segundo voto publica la guía", async () => {
        const admin = await crearUsuario("ADMIN", `admin-${Date.now()}@test.local`);
        const comite1 = await crearUsuario("COMITE_VALIDACION", `comite1-${Date.now()}@test.local`);
        const comite2 = await crearUsuario("COMITE_VALIDACION", `comite2-${Date.now()}@test.local`);
        const guia = await crearGuia(admin.id);

        mockToken = await crearTokenUsuario(comite1.id, "COMITE_VALIDACION");
        await POST_APROBAR(
            new Request(`http://localhost:5005/api/admin/comite/guias-accion/${guia.id}/aprobar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            }),
            { params: Promise.resolve({ id: guia.id }) }
        );

        mockToken = await crearTokenUsuario(comite2.id, "COMITE_VALIDACION");
        const res = await POST_APROBAR(
            new Request(`http://localhost:5005/api/admin/comite/guias-accion/${guia.id}/aprobar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            }),
            { params: Promise.resolve({ id: guia.id }) }
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.guia.estado).toBe("ACTIVA");
    });
});

describe("POST /api/admin/comite/guias-accion/[id]/rechazar", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await seedParametrosPadre();
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
                estado: "PENDIENTE_APROBACION_COMITE",
                creadaPorAdminId: adminId,
            },
        });
    }

    it("rechaza guía y vuelve a BORRADOR", async () => {
        const admin = await crearUsuario("ADMIN", `admin-${Date.now()}@test.local`);
        const comite = await crearUsuario("COMITE_VALIDACION", `comite-${Date.now()}@test.local`);
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const guia = await crearGuia(admin.id);

        const res = await POST_RECHAZAR(
            new Request(`http://localhost:5005/api/admin/comite/guias-accion/${guia.id}/rechazar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ motivo: "No aplica" }),
            }),
            { params: Promise.resolve({ id: guia.id }) }
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.guia.estado).toBe("BORRADOR");
    });
});
