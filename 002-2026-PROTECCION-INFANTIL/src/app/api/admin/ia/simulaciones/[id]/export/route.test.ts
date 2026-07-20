import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";

describe("GET /api/admin/ia/simulaciones/[id]/export", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("exports CSV for a completed run", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const run = await prisma.simulacionRun.create({
            data: { modelo: "ornith:9b", totalCasos: 1, estado: "COMPLETADA", creadoPorId: admin.id },
        });
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "instagram" } }) ||
            await prisma.plataforma.create({ data: { clave: "instagram", nombre: "Instagram" } });
        const reporte = await prisma.reporte.create({
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
        await prisma.simulacionReporte.create({
            data: { simulacionRunId: run.id, reporteId: reporte.id, indice: 1, categoriaEsperada: "SOLICITUD_ENCUENTRO" },
        });
        await prisma.clasificacionIA.create({
            data: { reporteId: reporte.id, categoria: "SOLICITUD_ENCUENTRO", confianza: 0.85, latenciaMs: 120, modeloUsado: "ornith:9b" },
        });

        const req = crearRequestAutenticado("GET", `http://localhost/api/admin/ia/simulaciones/${run.id}/export?formato=csv`, null);
        const res = await GET(req, { params: Promise.resolve({ id: run.id }) });
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toContain("indice,identificador,categoriaEsperada");
        expect(text).toContain("SIM-1-001");
    });

    it("exports JSON for a completed run", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const run = await prisma.simulacionRun.create({
            data: { modelo: "ornith:9b", totalCasos: 1, estado: "COMPLETADA", creadoPorId: admin.id },
        });
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "instagram" } }) ||
            await prisma.plataforma.create({ data: { clave: "instagram", nombre: "Instagram" } });
        const reporte = await prisma.reporte.create({
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
        await prisma.simulacionReporte.create({
            data: { simulacionRunId: run.id, reporteId: reporte.id, indice: 1, categoriaEsperada: "SOLICITUD_ENCUENTRO" },
        });
        await prisma.clasificacionIA.create({
            data: { reporteId: reporte.id, categoria: "SOLICITUD_ENCUENTRO", confianza: 0.85, latenciaMs: 120, modeloUsado: "ornith:9b" },
        });

        const req = crearRequestAutenticado("GET", `http://localhost/api/admin/ia/simulaciones/${run.id}/export?formato=json`, null);
        const res = await GET(req, { params: Promise.resolve({ id: run.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.casos).toHaveLength(1);
        expect(body.metricas).toBeDefined();
    });
});
