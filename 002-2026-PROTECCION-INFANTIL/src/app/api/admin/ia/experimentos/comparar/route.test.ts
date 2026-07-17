import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";

function makeReport(errorSilencioso: number, accuracy: number): Record<string, unknown> {
    return {
        metadata: { fixtureVersion: 1, totalExamples: 2 },
        metrics: { errorSilencioso, accuracy, recallOTRO: 0, revisionManualRate: 0 },
    };
}

describe("POST /api/admin/ia/experimentos/comparar", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("compares completed experiments of same fixtureVersion", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const a = await prisma.evalRun.create({
            data: { tipo: "f7", fixtureVersion: 1, estado: "COMPLETADA", nombre: "A", resultadoJson: makeReport(0.2, 0.7) as never },
        });
        const b = await prisma.evalRun.create({
            data: { tipo: "f7", fixtureVersion: 1, estado: "COMPLETADA", nombre: "B", resultadoJson: makeReport(0.3, 0.6) as never },
        });

        const req = crearRequestAutenticado("POST", "http://localhost/api/admin/ia/experimentos/comparar", { ids: [a.id, b.id] });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.comparable).toBe(true);
        expect(body.experimentos).toHaveLength(2);
    });

    it("rejects comparing different fixtureVersions", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const a = await prisma.evalRun.create({
            data: { tipo: "f7", fixtureVersion: 1, estado: "COMPLETADA", nombre: "A", resultadoJson: makeReport(0.2, 0.7) as never },
        });
        const b = await prisma.evalRun.create({
            data: { tipo: "f7", fixtureVersion: 2, estado: "COMPLETADA", nombre: "B", resultadoJson: makeReport(0.3, 0.6) as never },
        });

        const req = crearRequestAutenticado("POST", "http://localhost/api/admin/ia/experimentos/comparar", { ids: [a.id, b.id] });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });
});
