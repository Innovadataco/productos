import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma, crearPaisCiudad, crearParametrosExpediente } from "@/lib/reporte-test-utils";
import { armarVotacionExpediente, type ClasificacionConVotos } from "./votacion";

const MODELOS = ["gemma2:27b", "qwen2.5:14b", "aya-expanse:32b"];

async function crearReporteConClasificacion() {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const reporte = await prisma.reporte.create({
        data: {
            identificador: "+57300TEST000",
            plataformaId: plataforma!.id,
            texto: "Texto anonimizado de prueba de la votación.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            estado: "CLASIFICADO",
            numeroSeguimiento: `RPT-${Date.now()}`,
            clasificacion: {
                create: {
                    categoria: "SOLICITUD_MATERIAL",
                    confianza: 0.67,
                    contienePii: false,
                    piiDetectada: [],
                    modeloUsado: "rubrica:gemma2:27b+qwen2.5:14b+aya-expanse:32b",
                    latenciaMs: 1240,
                    promptTokens: 3210,
                    responseTokens: 96,
                    usoCascada: false,
                    // Campo redundante (deuda): el expediente NO debe leerlo nunca.
                    votos: { ruido: "este Json no es fuente de votos" },
                    rubricaVotos: {
                        create: [
                            { modelo: MODELOS[0], categoria: "SOLICITUD_MATERIAL", cumple: true,
                                preguntasJson: ["¿Alguien pide fotos, videos o material visual a otra persona?", "¿La persona a quien se le pide es menor de edad?"] },
                            { modelo: MODELOS[1], categoria: "SOLICITUD_MATERIAL", cumple: true,
                                preguntasJson: ["¿Alguien pide fotos, videos o material visual a otra persona?"] },
                            { modelo: MODELOS[2], categoria: "SOLICITUD_MATERIAL", cumple: false, preguntasJson: [] },
                        ],
                    },
                },
            },
        },
        include: { clasificacion: { include: { rubricaVotos: true } } },
    });
    return reporte.clasificacion! as ClasificacionConVotos;
}

describe("votacion (T021) — matriz y detalle pregunta por pregunta", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        await crearPaisCiudad();
        await crearParametrosExpediente();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("arma la matriz modelos×categorías solo desde ClasificacionRubricaVoto", async () => {
        const clasificacion = await crearReporteConClasificacion();
        const votacion = await armarVotacionExpediente(clasificacion);
        expect(votacion.matriz).toEqual({
            SOLICITUD_MATERIAL: { "gemma2:27b": 1, "qwen2.5:14b": 1, "aya-expanse:32b": 0 },
        });
        expect(votacion.categorias).toEqual(["SOLICITUD_MATERIAL"]);
        expect(votacion.confianza).toBe(0.67);
        expect(votacion.latenciaMs).toBe(1240);
        expect(votacion.promptTokens).toBe(3210);
        expect(votacion.responseTokens).toBe(96);
        // El Json redundante `votos` no se usa: no aparece en la salida.
        expect(JSON.stringify(votacion)).not.toContain("ruido");
    });

    it("detalle por pregunta: texto/tipo del parámetro en vivo, votos de la tabla", async () => {
        const clasificacion = await crearReporteConClasificacion();
        const votacion = await armarVotacionExpediente(clasificacion);
        const detalle = votacion.detallePorCategoria.find((d) => d.categoria === "SOLICITUD_MATERIAL")!;
        expect(detalle.preguntas).toHaveLength(2);

        const decisiva = detalle.preguntas[0];
        expect(decisiva.texto).toBe("¿Alguien pide fotos, videos o material visual a otra persona?");
        expect(decisiva.tipo).toBe("decisiva");
        expect(decisiva.votosPorModelo).toEqual({ "gemma2:27b": 1, "qwen2.5:14b": 1, "aya-expanse:32b": 0 });

        const contexto = detalle.preguntas[1];
        expect(contexto.texto).toBe("¿La persona a quien se le pide es menor de edad?");
        expect(contexto.tipo).toBe("contexto");
        expect(contexto.votosPorModelo).toEqual({ "gemma2:27b": 1, "qwen2.5:14b": 0, "aya-expanse:32b": 0 });
    });

    it("editar el parámetro cambia el texto de la pregunta en la salida sin desplegar", async () => {
        const clasificacion = await crearReporteConClasificacion();
        const param = await prisma.parametroSistema.findUnique({ where: { clave: "ia.rubrica.preguntas" } });
        const sets = JSON.parse(param!.valor) as Record<string, Array<{ texto: string; activo: boolean; tipo: string }>>;
        sets.SOLICITUD_MATERIAL[0].texto = "¿El texto describe una petición explícita de material visual?";
        await prisma.parametroSistema.update({
            where: { clave: "ia.rubrica.preguntas" },
            data: { valor: JSON.stringify(sets) },
        });

        const votacion = await armarVotacionExpediente(clasificacion);
        const detalle = votacion.detallePorCategoria.find((d) => d.categoria === "SOLICITUD_MATERIAL")!;
        expect(detalle.preguntas[0].texto).toBe("¿El texto describe una petición explícita de material visual?");
        // El texto nuevo no coincide verbatim con lo que votaron los modelos: no cumplida = 0.
        expect(detalle.preguntas[0].votosPorModelo).toEqual({ "gemma2:27b": 0, "qwen2.5:14b": 0, "aya-expanse:32b": 0 });
    });

    it("motor legacy (sin ClasificacionRubricaVoto): matriz y detalle vacíos", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300TEST000",
                plataformaId: plataforma!.id,
                texto: "Texto de reporte legacy sin votos de rúbrica.",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                estado: "CLASIFICADO",
                numeroSeguimiento: `RPT-${Date.now()}`,
                clasificacion: {
                    create: {
                        categoria: "OTRO",
                        confianza: 0.5,
                        modeloUsado: "ornith:9b",
                        latenciaMs: 800,
                    },
                },
            },
            include: { clasificacion: { include: { rubricaVotos: true } } },
        });
        const votacion = await armarVotacionExpediente(reporte.clasificacion! as ClasificacionConVotos);
        expect(votacion.matriz).toEqual({});
        expect(votacion.detallePorCategoria).toEqual([]);
        expect(votacion.categorias).toEqual(["OTRO"]);
        expect(votacion.confianza).toBe(0.5);
    });
});
