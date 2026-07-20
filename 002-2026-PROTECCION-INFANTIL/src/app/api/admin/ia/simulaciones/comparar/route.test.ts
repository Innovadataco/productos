import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";

describe("POST /api/admin/ia/simulaciones/comparar", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("compares two runs by case index", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "instagram" } }) ||
            await prisma.plataforma.create({ data: { clave: "instagram", nombre: "Instagram" } });

        const run1 = await prisma.simulacionRun.create({
            data: { modelo: "ornith:9b", totalCasos: 1, estado: "COMPLETADA", creadoPorId: admin.id },
        });
        const run2 = await prisma.simulacionRun.create({
            data: { modelo: "qwen:7b", totalCasos: 1, estado: "COMPLETADA", creadoPorId: admin.id },
        });

        const r1 = await prisma.reporte.create({
            data: { identificador: "SIM-1-001", plataformaId: plataforma.id, texto: "texto", textoOriginal: "texto", fechaIncidente: new Date(), ciudad: "x", pais: "x", esAnonimo: true, estado: "CLASIFICADO" },
        });
        const r2 = await prisma.reporte.create({
            data: { identificador: "SIM-2-001", plataformaId: plataforma.id, texto: "texto", textoOriginal: "texto", fechaIncidente: new Date(), ciudad: "x", pais: "x", esAnonimo: true, estado: "CLASIFICADO" },
        });

        await prisma.simulacionReporte.create({ data: { simulacionRunId: run1.id, reporteId: r1.id, indice: 1, categoriaEsperada: "SOLICITUD_ENCUENTRO" } });
        await prisma.simulacionReporte.create({ data: { simulacionRunId: run2.id, reporteId: r2.id, indice: 1, categoriaEsperada: "SOLICITUD_ENCUENTRO" } });
        await prisma.clasificacionIA.create({ data: { reporteId: r1.id, categoria: "SOLICITUD_ENCUENTRO", confianza: 0.9, latenciaMs: 100, modeloUsado: "ornith:9b" } });
        await prisma.clasificacionIA.create({ data: { reporteId: r2.id, categoria: "OTRO", confianza: 0.6, latenciaMs: 200, modeloUsado: "qwen:7b" } });

        const req = crearRequestAutenticado("POST", "http://localhost/api/admin/ia/simulaciones/comparar", {
            ids: [run1.id, run2.id],
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.runs).toHaveLength(2);
        expect(body.filas).toHaveLength(1);
        expect(body.filas[0].resultados).toHaveLength(2);
    });
});
