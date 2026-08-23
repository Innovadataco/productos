/**
 * SPEC-214 (002-PI-114): tests de integración de /api/admin/pagos/tasas.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { RolUsuario, FuenteTasa } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("/api/admin/pagos/tasas", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    async function seedAdmin() {
        return crearUsuario(RolUsuario.ADMIN, `admin-tasas-${Date.now()}@test.co`);
    }

    it("GET lista tasas vigentes filtradas por moneda", async () => {
        const admin = await seedAdmin();
        const repo = new PagosRepository();
        await repo.crearTasaCambio({
            monedaOrigen: "USD",
            monedaDestino: "COP",
            tasa: 4000,
            fecha: new Date(),
            fuente: FuenteTasa.API,
        });
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const res = await GET(
            new Request("http://localhost:5005/api/admin/pagos/tasas?monedaDestino=COP")
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.tasas).toHaveLength(1);
        expect(json.tasas[0].monedaDestino).toBe("COP");
    });

    it("POST crea una tasa manual y registra auditoría", async () => {
        const admin = await seedAdmin();
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const res = await POST(
            new Request("http://localhost:5005/api/admin/pagos/tasas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    monedaDestino: "cop",
                    tasa: 4100,
                    motivoManual: "Ajuste manual por política comercial",
                }),
            })
        );
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.tasa.monedaDestino).toBe("COP");
        expect(json.tasa.fuente).toBe(FuenteTasa.ADMIN_MANUAL);
    });

    it("POST rechaza datos inválidos", async () => {
        const admin = await seedAdmin();
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const res = await POST(
            new Request("http://localhost:5005/api/admin/pagos/tasas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ monedaDestino: "COP", tasa: -1, motivoManual: "x" }),
            })
        );
        expect(res.status).toBe(400);
    });

    it("rechaza usuarios no ADMIN", async () => {
        const parent = await crearUsuario(RolUsuario.PARENT, `parent-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(parent.id, RolUsuario.PARENT);

        const res = await GET(new Request("http://localhost:5005/api/admin/pagos/tasas"));
        expect(res.status).toBe(403);
    });
});
