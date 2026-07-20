import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";

describe("GET /api/admin/ia/simulaciones/[id]", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("returns run details and computes progress", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const run = await prisma.simulacionRun.create({
            data: { modelo: "ornith:9b", totalCasos: 2, estado: "EN_PROGRESO", creadoPorId: admin.id },
        });

        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "instagram" } }) ||
            await prisma.plataforma.create({ data: { clave: "instagram", nombre: "Instagram" } });
        const r1 = await prisma.reporte.create({
            data: {
                identificador: "SIM-1-001",
                plataformaId: plataforma.id,
                texto: "texto de prueba suficientemente largo",
                textoOriginal: "texto original",
                fechaIncidente: new Date(),
                ciudad: "Simulación",
                pais: "Simulación",
                esAnonimo: true,
                estado: "CLASIFICADO",
            },
        });
        const r2 = await prisma.reporte.create({
            data: {
                identificador: "SIM-1-002",
                plataformaId: plataforma.id,
                texto: "texto de prueba suficientemente largo",
                textoOriginal: "texto original",
                fechaIncidente: new Date(),
                ciudad: "Simulación",
                pais: "Simulación",
                esAnonimo: true,
                estado: "PENDIENTE",
            },
        });

        await prisma.simulacionReporte.createMany({
            data: [
                { simulacionRunId: run.id, reporteId: r1.id, indice: 1 },
                { simulacionRunId: run.id, reporteId: r2.id, indice: 2 },
            ],
        });

        const req = crearRequestAutenticado("GET", `http://localhost/api/admin/ia/simulaciones/${run.id}`, null);
        const res = await GET(req, { params: Promise.resolve({ id: run.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.id).toBe(run.id);
        expect(body.progreso).toBe(1);
    });

    it("returns 404 for unknown run", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const req = crearRequestAutenticado("GET", "http://localhost/api/admin/ia/simulaciones/unknown", null);
        const res = await GET(req, { params: Promise.resolve({ id: "unknown" }) });
        expect(res.status).toBe(404);
    });
});
