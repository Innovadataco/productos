import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearUsuario,
    crearTokenUsuario,
    crearPlataforma,
    crearPaisCiudad,
    crearParametrosReportes,
} from "@/lib/reporte-test-utils";
import type { CategoriaConducta } from "@prisma/client";

async function crearReporteVisible(
    identificador: string,
    plataformaId: string,
    categoria: CategoriaConducta,
    esAnonimo: boolean
) {
    const numeroSeguimiento = `RPT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: "Texto de prueba para consulta pública.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo,
            numeroSeguimiento,
            estado: "CLASIFICADO",
        },
    });
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria,
            confianza: 0.8,
            contienePii: false,
            piiDetectada: [],
            modeloUsado: "ornith:9b",
            latenciaMs: 1000,
        },
    });
    return reporte;
}

describe("GET /api/consulta", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("devuelve sin reportes cuando no supera umbral", async () => {
        const req = new Request("http://localhost:5005/api/consulta?identificador=%2B57300111111&plataforma=whatsapp");
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tieneReportes).toBe(false);
    });

    it("usuario anónimo ve información agregada básica", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        for (let i = 0; i < 3; i++) {
            await crearReporteVisible("+57300ANON", plataforma!.id, "OFRECIMIENTO_REGALOS", i === 0);
        }

        const req = new Request("http://localhost:5005/api/consulta?identificador=%2B57300ANON&plataforma=whatsapp");
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tieneReportes).toBe(true);
        expect(body.totalReportes).toBe(3);
        expect(body.score).toBeUndefined();
        expect(body.ubicaciones).toHaveLength(3);
        expect(body.resumen).toContain("3");
    });

    it("usuario autenticado ve score, nivel de riesgo y categorías", async () => {
        const user = await crearUsuario("PARENT");
        const token = await crearTokenUsuario(user.id, "PARENT");
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        for (let i = 0; i < 3; i++) {
            await crearReporteVisible("+57300AUTH", plataforma!.id, "OFRECIMIENTO_REGALOS", false);
        }

        const req = new Request("http://localhost:5005/api/consulta?identificador=%2B57300AUTH&plataforma=whatsapp", {
            headers: { cookie: `token=${token}` },
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tieneReportes).toBe(true);
        expect(body.score).toBeGreaterThanOrEqual(0);
        expect(body.nivelRiesgo).toMatch(/^(BAJO|MEDIO|ALTO)$/);
        expect(body.categorias).toHaveLength(1);
        expect(body.timeline).toHaveLength(1);
    });

    it("rechaza parámetros inválidos", async () => {
        const req = new Request("http://localhost:5005/api/consulta?identificador=ab&plataforma=whatsapp");
        const res = await GET(req);
        expect(res.status).toBe(400);
    });
});
