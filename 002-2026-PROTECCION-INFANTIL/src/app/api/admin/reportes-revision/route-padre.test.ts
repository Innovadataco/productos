/**
 * N-2 (002-PI-056): filtro por padre en la bandeja de reportes del admin.
 * El filtro busca por email o nombre del usuario denunciante (reportes anónimos
 * no tienen usuario y nunca coinciden).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && activeToken ? { name: "token", value: activeToken } : undefined,
        set: vi.fn(),
    }),
}));

describe("GET /api/admin/reportes-revision — filtro por padre (N-2)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        await crearPaisCiudad();
        activeToken = null;
    });

    async function sembrar() {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const padreA = await crearUsuario("PARENT", "maria.padre@test.local");
        const padreB = await crearUsuario("PARENT", "juan.padre@test.local");
        const base = {
            plataformaId: plataforma!.id,
            texto: "Texto de prueba para el filtro por padre.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            estado: "REVISION_MANUAL" as const,
        };
        const deMaria = await prisma.reporte.create({
            data: { ...base, identificador: "+57300AAAAAA1", numeroSeguimiento: "RPT-N2-MARIA", esAnonimo: false, usuarioId: padreA.id },
        });
        await prisma.reporte.create({
            data: { ...base, identificador: "+57300BBBBBB2", numeroSeguimiento: "RPT-N2-JUAN", esAnonimo: false, usuarioId: padreB.id },
        });
        await prisma.reporte.create({
            data: { ...base, identificador: "+57300CCCCCC3", numeroSeguimiento: "RPT-N2-ANON", esAnonimo: true },
        });
        return deMaria;
    }

    async function getComoAdmin(qs: string) {
        const admin = await crearUsuario("ADMIN");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");
        const req = new Request(`http://localhost:5005/api/admin/reportes-revision?${qs}`, {
            method: "GET",
            headers: { cookie: `token=${activeToken}` },
        });
        return GET(req);
    }

    it("filtra por email del padre y la fila expone su email", async () => {
        const deMaria = await sembrar();
        const res = await getComoAdmin(`padre=${encodeURIComponent("maria.padre")}`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.reportes).toHaveLength(1);
        expect(body.reportes[0].id).toBe(deMaria.id);
        expect(body.reportes[0].usuario.email).toBe("maria.padre@test.local");
    });

    it("sin el filtro devuelve todos (anónimos incluidos)", async () => {
        await sembrar();
        const res = await getComoAdmin("pageSize=50");
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.reportes.length).toBe(3);
        const anon = body.reportes.find((r: { numeroSeguimiento: string }) => r.numeroSeguimiento === "RPT-N2-ANON");
        expect(anon.usuario).toBeNull();
    });
});
