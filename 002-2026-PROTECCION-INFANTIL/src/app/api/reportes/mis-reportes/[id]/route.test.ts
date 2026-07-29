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

/**
 * Clasificación con su traza de rúbrica persistida: dos conductas CONFIRMADAS
 * (principal + secundaria, ambas ya superaron el umbral en el motor) y votos
 * de una categoría DESCARTADA (COMPARTIMIENTO_SEXUAL, cumple=false) que solo
 * viven en la traza y NUNCA deben salir hacia el padre (spec 116).
 */
async function crearClasificacionConVotos(reporteId: string) {
    const clasificacion = await prisma.clasificacionIA.create({
        data: {
            reporteId,
            categoria: "SOLICITUD_MATERIAL",
            confianza: 1,
            modeloUsado: "rubrica:m1+m2",
            latenciaMs: 100,
            categoriasSecundarias: [{ categoria: "CONTACTO_INSISTENTE", score: 1 }],
        },
    });
    await prisma.clasificacionRubricaVoto.createMany({
        data: [
            { clasificacionIAId: clasificacion.id, modelo: "m1", categoria: "SOLICITUD_MATERIAL", cumple: true, preguntasJson: ["¿Alguien pide fotos?"] },
            { clasificacionIAId: clasificacion.id, modelo: "m1", categoria: "COMPARTIMIENTO_SEXUAL", cumple: false, preguntasJson: [] },
            { clasificacionIAId: clasificacion.id, modelo: "m2", categoria: "SOLICITUD_MATERIAL", cumple: true, preguntasJson: ["¿Alguien pide fotos?"] },
            { clasificacionIAId: clasificacion.id, modelo: "m2", categoria: "COMPARTIMIENTO_SEXUAL", cumple: false, preguntasJson: [] },
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

    it("el dueño recibe SOLO las conductas confirmadas y un mensaje en lenguaje humano", async () => {
        const reporte = await crearReporte("CLASIFICADO", parentUser.id);
        await crearClasificacionConVotos(reporte.id);

        const res = await GET(req(reporte.id), ctx(reporte.id));
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.reporte.identificador).toBe("+573001112233");
        expect(body.reporte.plataforma).toBe("WhatsApp");
        expect(body.reporte.estadoVisual).toBe("Procesado");
        expect(body.reporte.ciudad).toBe("Bogotá");

        // Conductas confirmadas (principal + secundaria), con label humano.
        expect(body.clasificacion.conductas).toEqual([
            { categoria: "SOLICITUD_MATERIAL", label: "Solicitud de material" },
            { categoria: "CONTACTO_INSISTENTE", label: "Contacto insistente" },
        ]);

        // Mensaje con plantilla determinista (D-23): hallazgo + recomendación.
        expect(typeof body.clasificacion.mensaje).toBe("string");
        expect(body.clasificacion.mensaje).toContain("posibles solicitudes de fotos o videos íntimos");
        expect(body.clasificacion.mensaje).toContain("posible contacto insistente");
        expect(body.clasificacion.mensaje).not.toContain("BORRADOR");
    });

    it("la respuesta NO expone la traza técnica: modelos, votos, porcentajes, scores ni categorías descartadas", async () => {
        const reporte = await crearReporte("CLASIFICADO", parentUser.id);
        await crearClasificacionConVotos(reporte.id);

        const res = await GET(req(reporte.id), ctx(reporte.id));
        const body = await res.json();

        // Propiedades técnicas ausentes del contrato.
        expect(body).not.toHaveProperty("votosModelos");
        expect(body).not.toHaveProperty("porcentajes");
        expect(body).not.toHaveProperty("analisis");
        expect(body.clasificacion).not.toHaveProperty("confianza");
        expect(body.clasificacion).not.toHaveProperty("categoriasSecundarias");
        expect(body.clasificacion).not.toHaveProperty("score");

        // Barrido de contenido: ni nombres de modelos, ni umbrales, ni la
        // categoría descartada, ni lenguaje de riesgo/score.
        const raw = JSON.stringify(body);
        expect(raw).not.toContain("m1");
        expect(raw).not.toContain("m2");
        expect(raw).not.toMatch(/umbral|porcentaje|voto/i);
        expect(raw).not.toMatch(/COMPARTIMIENTO_SEXUAL|Compartimiento/i);
        expect(raw).not.toMatch(/riesgo|gravedad|confianza/i);
    });

    it("SPAM y OTRO nunca aparecen como conductas del padre", async () => {
        const reporte = await crearReporte("CLASIFICADO", parentUser.id);
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "SOLICITUD_MATERIAL",
                confianza: 1,
                modeloUsado: "rubrica:m1+m2",
                latenciaMs: 100,
                categoriasSecundarias: [
                    { categoria: "SPAM", score: 1 },
                    { categoria: "OTRO", score: 1 },
                ],
            },
        });

        const res = await GET(req(reporte.id), ctx(reporte.id));
        const body = await res.json();

        expect(body.clasificacion.conductas).toEqual([
            { categoria: "SOLICITUD_MATERIAL", label: "Solicitud de material" },
        ]);
    });

    it("sin conductas confirmadas (OTRO): mensaje institucional neutro", async () => {
        const reporte = await crearReporte("CLASIFICADO", parentUser.id);
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "OTRO",
                confianza: 0,
                modeloUsado: "rubrica:m1+m2",
                latenciaMs: 100,
                categoriasSecundarias: [],
            },
        });

        const res = await GET(req(reporte.id), ctx(reporte.id));
        const body = await res.json();

        expect(body.clasificacion.conductas).toEqual([]);
        expect(body.clasificacion.mensaje).toContain("no encontramos conductas concretas");
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

    it("reporte sin clasificación devuelve clasificacion null", async () => {
        const reporte = await crearReporte("PENDIENTE", parentUser.id);

        const res = await GET(req(reporte.id), ctx(reporte.id));
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.clasificacion).toBeNull();
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
