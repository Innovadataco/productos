import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearUsuario } from "@/lib/reporte-test-utils";
import { AppError, ERROR_CODES } from "@/lib/errors";
import * as auth from "@/lib/auth";

let parentUser: Awaited<ReturnType<typeof crearUsuario>>;

async function crearReporte(estado: "PENDIENTE" | "CLASIFICADO", usuarioId: string, eliminado = false) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    return prisma.reporte.create({
        data: {
            identificador: "+573001112233",
            plataformaId: plataforma!.id,
            texto: "Texto de prueba del detalle.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            usuarioId,
            estado,
            eliminado,
        },
    });
}

async function crearClasificacionConVotos(reporteId: string) {
    const clasificacion = await prisma.clasificacionIA.create({
        data: {
            reporteId,
            categoria: "SOLICITUD_MATERIAL",
            confianza: 1,
            modeloUsado: "rubrica:m1+m2",
            latenciaMs: 100,
            categoriasSecundarias: [{ categoria: "CONTACTO_INSISTENTE", score: 0.5 }],
        },
    });
    await prisma.clasificacionRubricaVoto.createMany({
        data: [
            { clasificacionIAId: clasificacion.id, modelo: "m1", categoria: "SOLICITUD_MATERIAL", cumple: true, preguntasJson: ["¿Alguien pide fotos?"] },
            { clasificacionIAId: clasificacion.id, modelo: "m1", categoria: "CONTACTO_INSISTENTE", cumple: true, preguntasJson: [] },
            { clasificacionIAId: clasificacion.id, modelo: "m2", categoria: "SOLICITUD_MATERIAL", cumple: true, preguntasJson: ["¿Alguien pide fotos?"] },
            { clasificacionIAId: clasificacion.id, modelo: "m2", categoria: "CONTACTO_INSISTENTE", cumple: false, preguntasJson: [] },
        ],
    });
    return clasificacion;
}

function req(id: string) {
    return new Request(`http://localhost:5005/api/reportes/mis-reportes/${id}`);
}

function ctx(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("GET /api/reportes/mis-reportes/[id]", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        vi.restoreAllMocks();
        parentUser = await crearUsuario("PARENT");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(parentUser);
    });

    it("el dueño recibe info, matriz de rúbrica, porcentajes y análisis", async () => {
        const reporte = await crearReporte("CLASIFICADO", parentUser.id);
        await crearClasificacionConVotos(reporte.id);

        const res = await GET(req(reporte.id), ctx(reporte.id));
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.reporte.identificador).toBe("+573001112233");
        expect(body.reporte.plataforma).toBe("WhatsApp");
        expect(body.reporte.estadoVisual).toBe("Procesado");
        expect(body.reporte.ciudad).toBe("Bogotá");

        expect(body.clasificacion.categoria).toBe("SOLICITUD_MATERIAL");
        expect(body.clasificacion.categoriaLabel).toBe("Solicitud de material");
        expect(body.clasificacion.categoriasSecundarias).toEqual([{ categoria: "CONTACTO_INSISTENTE", score: 0.5 }]);

        expect(body.votosModelos).toHaveLength(2);
        const m1 = body.votosModelos.find((v: { modelo: string }) => v.modelo === "m1");
        expect(m1.categorias).toContainEqual({
            categoria: "SOLICITUD_MATERIAL",
            cumple: true,
            preguntasCumplidas: ["¿Alguien pide fotos?"],
        });

        expect(body.porcentajes.SOLICITUD_MATERIAL).toBe(1);
        expect(body.porcentajes.CONTACTO_INSISTENTE).toBe(0.5);

        expect(typeof body.analisis).toBe("string");
        expect(body.analisis).toContain("SOLICITUD_MATERIAL");
        // Nunca un "% de riesgo" global ni score de persona.
        expect(JSON.stringify(body)).not.toContain("riesgo");
        expect(body).not.toHaveProperty("score");
        expect(body).not.toHaveProperty("nivelRiesgo");
    });

    it("otro PARENT recibe 403 (detalle privado del dueño)", async () => {
        const otro = await crearUsuario("PARENT");
        const reporte = await crearReporte("CLASIFICADO", otro.id);

        const res = await GET(req(reporte.id), ctx(reporte.id));
        expect(res.status).toBe(403);
    });

    it("sin autenticación devuelve 401", async () => {
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(
            new AppError("No autenticado", ERROR_CODES.AUTH_INVALID, 401)
        );
        const reporte = await crearReporte("PENDIENTE", parentUser.id);

        const res = await GET(req(reporte.id), ctx(reporte.id));
        expect(res.status).toBe(401);
    });

    it("reporte sin clasificación devuelve clasificacion null y votos vacíos", async () => {
        const reporte = await crearReporte("PENDIENTE", parentUser.id);

        const res = await GET(req(reporte.id), ctx(reporte.id));
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.clasificacion).toBeNull();
        expect(body.votosModelos).toEqual([]);
        expect(body.porcentajes).toEqual({});
        expect(body.analisis).toBeNull();
        expect(body.reporte.estadoVisual).toBe("En proceso");
    });

    it("reporte inexistente o eliminado devuelve 404", async () => {
        const res = await GET(req("no-existe"), ctx("no-existe"));
        expect(res.status).toBe(404);

        const eliminado = await crearReporte("PENDIENTE", parentUser.id, true);
        const res2 = await GET(req(eliminado.id), ctx(eliminado.id));
        expect(res2.status).toBe(404);
    });
});
