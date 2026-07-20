import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";

describe("POST /api/admin/ia/simulaciones/[id]/cancelar", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("cancels a pending run", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const run = await prisma.simulacionRun.create({
            data: { modelo: "ornith:9b", totalCasos: 5, estado: "PENDIENTE", creadoPorId: admin.id },
        });

        const req = crearRequestAutenticado("POST", `http://localhost/api/admin/ia/simulaciones/${run.id}/cancelar`, null);
        const res = await POST(req, { params: Promise.resolve({ id: run.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.estado).toBe("CANCELADA");

        const updated = await prisma.simulacionRun.findUnique({ where: { id: run.id } });
        expect(updated?.estado).toBe("CANCELADA");
    });

    it("rejects cancelling a completed run", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const run = await prisma.simulacionRun.create({
            data: { modelo: "ornith:9b", totalCasos: 5, estado: "COMPLETADA", creadoPorId: admin.id },
        });

        const req = crearRequestAutenticado("POST", `http://localhost/api/admin/ia/simulaciones/${run.id}/cancelar`, null);
        const res = await POST(req, { params: Promise.resolve({ id: run.id }) });
        expect(res.status).toBe(409);
    });
});
