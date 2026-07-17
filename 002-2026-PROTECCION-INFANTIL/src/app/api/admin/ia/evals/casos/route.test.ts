import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";

describe("GET /api/admin/ia/evals/casos", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("lists active eval cases with pagination", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        await prisma.casoEval.createMany({
            data: [
                { texto: "caso A", categoriaEsperada: "OTRO", ruido: false, fuente: "SEMILLA", activo: true, fixtureVersion: 1 },
                { texto: "caso B", categoriaEsperada: "OTRO", ruido: true, fuente: "MANUAL_ADMIN", activo: true, fixtureVersion: 1 },
            ],
        });

        const req = crearRequestAutenticado("GET", "http://localhost/api/admin/ia/evals/casos", null);
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toHaveLength(2);
        expect(body.pagination.total).toBe(2);
    });
});

describe("POST /api/admin/ia/evals/casos", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("creates a case and increments fixtureVersion", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const req = crearRequestAutenticado("POST", "http://localhost/api/admin/ia/evals/casos", {
            texto: "Texto de prueba para eval",
            categoriaEsperada: "CONTACTO_INSISTENTE",
            ruido: false,
        });

        const res = await POST(req);
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.caso.categoriaEsperada).toBe("CONTACTO_INSISTENTE");
        expect(body.fixtureVersion).toBeGreaterThanOrEqual(1);

        const datasetCount = await prisma.datasetEntrenamiento.count();
        expect(datasetCount).toBe(0);

        const audit = await prisma.auditLog.findFirst({ where: { accion: "EVAL_CASE_CREATE" } });
        expect(audit).not.toBeNull();
    });
});
