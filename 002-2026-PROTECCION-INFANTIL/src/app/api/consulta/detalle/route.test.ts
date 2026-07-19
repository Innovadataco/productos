import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad, crearUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";

let parentUser: Awaited<ReturnType<typeof crearUsuario>>;

async function setupParent() {
    parentUser = await crearUsuario("PARENT");
    vi.spyOn(auth, "verifyAuth").mockResolvedValue(parentUser);
}

async function crearReporteClasificado(
    identificador: string,
    categoria: string,
    confianza: number,
    esAnonimo = false,
    plataformaClave = "whatsapp"
) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: plataformaClave } });
    const ciudad = await prisma.ciudad.findUnique({
        where: { nombre_paisId: { nombre: "Bogotá", paisId: (await prisma.pais.findUnique({ where: { codigo: "CO" } }))!.id } },
    });
    const numeroSeguimiento = `RPT-${identificador.replace(/\D/g, "").slice(0, 6)}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma!.id,
            texto: "Texto de prueba.",
            textoOriginal: "enc:texto-original",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            ciudadId: ciudad?.id,
            paisId: (await prisma.pais.findUnique({ where: { codigo: "CO" } }))!.id,
            esAnonimo,
            usuarioId: esAnonimo ? null : parentUser.id,
            numeroSeguimiento,
            estado: "CLASIFICADO",
        },
    });
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria: categoria as any,
            confianza,
            contienePii: false,
            piiDetectada: [],
            modeloUsado: "ornith:9b",
            latenciaMs: 100,
        },
    });
    return reporte;
}

describe("GET /api/consulta/detalle", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        await setupParent();
    });

    it("devuelve 401 si no está autenticado", async () => {
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(new Error("No autenticado"));
        const res = await GET(new Request("http://localhost:5005/api/consulta/detalle?identificador=3001111111"));
        expect(res.status).toBe(401);
    });

    it("devuelve detalle agregado sin exponer texto ni denunciante", async () => {
        await crearReporteClasificado("3001111111", "SOLICITUD_MATERIAL", 0.85, true);
        await crearReporteClasificado("3001111111", "SOLICITUD_MATERIAL", 0.9, false);

        const res = await GET(new Request("http://localhost:5005/api/consulta/detalle?identificador=3001111111"));
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.tieneReportes).toBe(true);
        expect(body.totalReportes).toBe(2);
        expect(body.nivelRiesgo).toBeDefined();
        expect(body.confianzaPromedio).toBeGreaterThan(0);
        expect(body.reportes).toHaveLength(2);

        const texto = JSON.stringify(body);
        expect(texto).not.toContain("Texto de prueba");
        expect(texto).not.toContain("textoOriginal");
        expect(texto).not.toContain("usuarioId");
        expect(texto).not.toContain(parentUser.email);
    });

    it("incluye ubicaciones aproximadas a nivel ciudad", async () => {
        await crearReporteClasificado("3002222222", "CONTACTO_INSISTENTE", 0.7, true);

        const res = await GET(new Request("http://localhost:5005/api/consulta/detalle?identificador=3002222222"));
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.ubicaciones).toHaveLength(1);
        expect(body.ubicaciones[0].ciudad).toBe("Bogotá");
        expect(body.ubicaciones[0].pais).toBe("Colombia");
        expect(typeof body.ubicaciones[0].lat).toBe("number");
        expect(typeof body.ubicaciones[0].lng).toBe("number");
    });

    it("devuelve sin reportes cuando no hay reportes clasificados", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await prisma.reporte.create({
            data: {
                identificador: "3003333333",
                plataformaId: plataforma!.id,
                texto: "Texto.",
                textoOriginal: "enc:texto",
                fechaIncidente: new Date(),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                usuarioId: null,
                numeroSeguimiento: "RPT-333333",
                estado: "REVISION_MANUAL",
            },
        });

        const res = await GET(new Request("http://localhost:5005/api/consulta/detalle?identificador=3003333333"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tieneReportes).toBe(false);
    });

    it("formatea plataforma 'otro' sin mostrar undefined", async () => {
        const plataformaOtro = await prisma.plataforma.upsert({
            where: { clave: "otro" },
            update: {},
            create: { clave: "otro", nombre: "Otra plataforma", categoria: "otro" },
        });
        const ciudad = await prisma.ciudad.findUnique({
            where: {
                nombre_paisId: {
                    nombre: "Bogotá",
                    paisId: (await prisma.pais.findUnique({ where: { codigo: "CO" } }))!.id,
                },
            },
        });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "3004444444",
                plataformaId: plataformaOtro.id,
                otraPlataforma: "Instagram",
                texto: "Texto.",
                textoOriginal: "enc:texto",
                fechaIncidente: new Date(),
                ciudad: "Bogotá",
                pais: "Colombia",
                ciudadId: ciudad?.id,
                paisId: (await prisma.pais.findUnique({ where: { codigo: "CO" } }))!.id,
                esAnonimo: true,
                usuarioId: null,
                numeroSeguimiento: "RPT-444444",
                estado: "CLASIFICADO",
            },
        });
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "CONTACTO_INSISTENTE",
                confianza: 0.7,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "ornith:9b",
                latenciaMs: 100,
            },
        });

        const res = await GET(new Request("http://localhost:5005/api/consulta/detalle?identificador=3004444444"));
        expect(res.status).toBe(200);
        const body = await res.json();

        const texto = JSON.stringify(body);
        expect(texto).not.toContain("undefined");
        expect(body.plataformas[0].nombre).toBe("Instagram");
        expect(body.reportes[0].plataforma).toBe("Instagram");
    });
});
