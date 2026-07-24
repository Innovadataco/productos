import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "./route";
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
    const ciudad = await prisma.ciudad.findUnique({
        where: { nombre_paisId: { nombre: "Bogotá", paisId: (await prisma.pais.findUnique({ where: { codigo: "CO" } }))!.id } },
    });
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: "Texto de prueba para consulta pública.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            paisId: ciudad?.paisId,
            ciudadId: ciudad?.id,
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

async function crearReporteEnRevision(identificador: string, plataformaId: string) {
    const numeroSeguimiento = `RPT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const ciudad = await prisma.ciudad.findUnique({
        where: { nombre_paisId: { nombre: "Bogotá", paisId: (await prisma.pais.findUnique({ where: { codigo: "CO" } }))!.id } },
    });
    return prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: "Texto en revisión para consulta pública.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            paisId: ciudad?.paisId,
            ciudadId: ciudad?.id,
            esAnonimo: false,
            numeroSeguimiento,
            estado: "REVISION_MANUAL",
        },
    });
}

describe("GET /api/consulta", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("devuelve sin reportes cuando el identificador no existe", async () => {
        const req = new Request("http://localhost:5005/api/consulta?identificador=%2B57300111111");
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tieneReportes).toBe(false);
    });

    it("devuelve información agregada aunque no supere el umbral de visibilidad pública", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await crearReporteVisible("+57300BAJO", plataforma!.id, "OFRECIMIENTO_REGALOS", false);

        const req = new Request("http://localhost:5005/api/consulta?identificador=%2B57300BAJO");
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tieneReportes).toBe(true);
        expect(body.visibleEnDashboard).toBe(false);
        expect(body.totalReportes).toBe(1);
        expect(body.plataformas).toHaveLength(1);
        // Anónimo: ubicación agregada por PAÍS (spec 089-US5)
        expect(body.ubicaciones).toHaveLength(1);
        expect(body.ubicaciones[0].pais).toBe("Colombia");
        expect(body.ubicaciones[0].lat).toBeUndefined();
        expect(body.actividad).toBe("baja");
        expect(body.autenticado).toBe(false);
        expect(body.nivelRiesgo).toBeUndefined();
        expect(body.texto).toBeUndefined();
        expect(body.textoOriginal).toBeUndefined();
    });

    it("usuario anónimo ve señal de actividad y resumen agregado básico (sin nivelRiesgo, spec 089-US6)", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        for (let i = 0; i < 3; i++) {
            await crearReporteVisible("+57300ANON", plataforma!.id, "OFRECIMIENTO_REGALOS", i === 0);
        }

        const req = new Request("http://localhost:5005/api/consulta?identificador=%2B57300ANON");
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tieneReportes).toBe(true);
        expect(body.visibleEnDashboard).toBe(true);
        expect(body.totalReportes).toBe(3);
        expect(body.nivelRiesgo).toBeUndefined();
        expect(body.actividad).toBe("baja");
        expect(body.resumenPlataformas).toBeDefined();
        expect(body.ubicaciones).toHaveLength(1);
        // Divulgación progresiva: el detalle (resumen/timeline) es solo para autenticados
        expect(body.resumen).toBeUndefined();
        expect(body.timeline).toBeUndefined();
        expect(body.plataformas).toHaveLength(1);
        expect(body.plataformas[0].nombre).toBe("WhatsApp");
        expect(body.texto).toBeUndefined();
        expect(body.textoOriginal).toBeUndefined();
    });

    it("no expone score ni datos del denunciante; categorías de riesgo sí visibles sin SPAM/OTRO (spec 089-US4)", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        for (let i = 0; i < 3; i++) {
            await crearReporteVisible("+57300AUTH", plataforma!.id, "OFRECIMIENTO_REGALOS", false);
        }

        const req = new Request("http://localhost:5005/api/consulta?identificador=%2B57300AUTH");
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tieneReportes).toBe(true);
        expect(body.score).toBeUndefined();
        expect(body.categorias).toBeDefined();
        expect(body.categorias.map((c: { categoria: string }) => c.categoria)).toContain("OFRECIMIENTO_REGALOS");
        expect(body.categorias.every((c: { categoria: string }) => !["SPAM", "OTRO"].includes(c.categoria))).toBe(true);
        // Anónimo: sin timeline
        expect(body.timeline).toBeUndefined();
    });

    it("spec 089-US3: SPAM y OTRO no cuentan en el conteo público", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        // 2 reportes clasificados como SPAM + 1 OTRO + 1 con riesgo real
        await crearReporteVisible("+57300SPAM", plataforma!.id, "SPAM", false);
        await crearReporteVisible("+57300SPAM", plataforma!.id, "SPAM", false);
        await crearReporteVisible("+57300SPAM", plataforma!.id, "OTRO", false);
        await crearReporteVisible("+57300SPAM", plataforma!.id, "EXTORSION", false);

        const req = new Request("http://localhost:5005/api/consulta?identificador=%2B57300SPAM");
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        // Antes del predicado único contaba 4; ahora solo el aprobado (riesgo real)
        expect(body.totalReportes).toBe(1);
        expect(body.categorias).toHaveLength(1);
        expect(body.categorias[0].categoria).toBe("EXTORSION");
    });

    it("spec 089-US3: identificador con SOLO spam/otro responde sin reportes", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await crearReporteVisible("+57300SOLOSPAM", plataforma!.id, "SPAM", false);

        const req = new Request("http://localhost:5005/api/consulta?identificador=%2B57300SOLOSPAM");
        const res = await GET(req);
        const body = await res.json();
        expect(body.tieneReportes).toBe(false);
    });

    it("spec 091-US1: POST devuelve el mismo contrato sin identificador en la URL", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await crearReporteVisible("+57300POST", plataforma!.id, "EXTORSION", false);

        // La Request NO lleva query string: el identificador viaja SOLO en el cuerpo
        const req = new Request("http://localhost:5005/api/consulta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identificador: "+57300POST" }),
        });
        expect(new URL(req.url).search).toBe("");

        const res = await POST(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tieneReportes).toBe(true);
        expect(body.totalReportes).toBe(1);
        expect(body.nivelRiesgo).toBeUndefined();
    });

    it("spec 091-US1: POST sin identificador en el cuerpo → 400", async () => {
        const req = new Request("http://localhost:5005/api/consulta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it("rechaza parámetros inválidos", async () => {
        const req = new Request("http://localhost:5005/api/consulta?identificador=ab");
        const res = await GET(req);
        expect(res.status).toBe(400);
    });

    it("agrupa reportes del mismo identificador en múltiples plataformas", async () => {
        const whatsapp = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const instagram = await crearPlataforma("instagram", "Instagram", "red_social");
        for (let i = 0; i < 3; i++) {
            await crearReporteVisible("+57300MULTI", whatsapp!.id, "OFRECIMIENTO_REGALOS", false);
            await crearReporteVisible("+57300MULTI", instagram.id, "CONTACTO_INSISTENTE", false);
        }

        const req = new Request("http://localhost:5005/api/consulta?identificador=%2B57300MULTI");
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tieneReportes).toBe(true);
        expect(body.totalReportes).toBe(6);
        expect(body.plataformas).toHaveLength(2);
        expect(body.categorias).toHaveLength(2);
    });

    it("no muestra reportes que aún están en revisión manual", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await crearReporteEnRevision("+57300REVISION", plataforma!.id);

        const req = new Request("http://localhost:5005/api/consulta?identificador=%2B57300REVISION");
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tieneReportes).toBe(false);
        expect(body.score).toBeUndefined();
        expect(body.categorias).toBeUndefined();
    });

    it("muestra solo los reportes clasificados cuando hay mezcla de estados", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await crearReporteVisible("+57300MIX", plataforma!.id, "OFRECIMIENTO_REGALOS", false);
        await crearReporteEnRevision("+57300MIX", plataforma!.id);

        const req = new Request("http://localhost:5005/api/consulta?identificador=%2B57300MIX");
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tieneReportes).toBe(true);
        expect(body.totalReportes).toBe(1);
        expect(body.plataformas).toHaveLength(1);
    });
});
