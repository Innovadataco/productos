import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma, crearPaisCiudad, crearParametrosExpediente } from "@/lib/reporte-test-utils";
import { armarExpedienteEtapas, obtenerConfigEtapas } from "./expediente";
import { encryptParameter } from "@/lib/param-encryption";

async function crearReporteBase() {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    return prisma.reporte.create({
        data: {
            identificador: "+57300TEST000",
            plataformaId: plataforma!.id,
            texto: "Texto anonimizado de prueba del expediente.",
            textoOriginal: encryptParameter("Texto original con nombre propio de prueba."),
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            estado: "CLASIFICADO",
            numeroSeguimiento: `RPT-${Date.now()}`,
            fuente: {
                create: {
                    pesoAplicado: 0.65,
                    cuentaDiasAntiguedad: 12,
                    reportesPrevios: 2,
                    reportesConfirmados: 1,
                    reportesDescartados: 0,
                    ipHash: "iphash-de-prueba",
                    fingerprintHash: "fphash-de-prueba",
                },
            },
        },
    });
}

describe("expediente (T020) — ensamblador de etapas", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        await crearPaisCiudad();
        await crearParametrosExpediente();
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("arma las 10 etapas en el orden del parámetro", async () => {
        const reporte = await crearReporteBase();
        const etapas = await armarExpedienteEtapas(reporte.id);
        expect(etapas).not.toBeNull();
        expect(etapas!).toHaveLength(10);
        expect(etapas!.map((e) => e.orden)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(etapas!.map((e) => e.clave)).toEqual([
            "recepcion", "peso_fuente", "embedding", "deduplicacion", "guardas",
            "contexto_rag", "clasificacion", "anonimizacion", "decision", "finalizacion",
        ]);
        const recepcion = etapas![0];
        expect(recepcion.nombre).toBe("Recepción");
        expect(recepcion.campos.numeroSeguimiento).toBe(reporte.numeroSeguimiento);
        expect(recepcion.campos.plataforma).toBe("WhatsApp");
        expect(recepcion.fechaHora).not.toBeNull();
    });

    it("degrada elegante: etapas Capa 2 sin pasos quedan sinInstrumentar", async () => {
        const reporte = await crearReporteBase();
        const etapas = await armarExpedienteEtapas(reporte.id);
        const capa2 = etapas!.filter((e) => e.capa === 2);
        expect(capa2.length).toBeGreaterThan(0);
        for (const etapa of capa2) {
            expect(etapa.sinInstrumentar).toBe(true);
        }
        const capa1 = etapas!.filter((e) => e.capa === 1);
        for (const etapa of capa1) {
            expect(etapa.sinInstrumentar).toBe(false);
        }
    });

    it("etapas Capa 2 con pasos instrumentados muestran sus datos", async () => {
        const reporte = await crearReporteBase();
        await prisma.pasoProcesamiento.create({
            data: {
                reporteId: reporte.id,
                etapa: "deduplicacion",
                veredicto: "sin_duplicado",
                detalle: { scoreSimilitud: 0.41, threshold: 0.92 },
            },
        });
        const etapas = await armarExpedienteEtapas(reporte.id);
        const dedup = etapas!.find((e) => e.clave === "deduplicacion")!;
        expect(dedup.sinInstrumentar).toBe(false);
        expect(dedup.campos.scoreSimilitud).toBe(0.41);
        expect(dedup.fechaHora).not.toBeNull();
    });

    it("renombrar una etapa en el parámetro se refleja en la salida", async () => {
        const reporte = await crearReporteBase();
        const config = await obtenerConfigEtapas();
        const renombrada = config.map((e) =>
            e.clave === "guardas" ? { ...e, nombre: "Guardas renombradas por experto" } : e
        );
        await prisma.parametroSistema.update({
            where: { clave: "admin.expediente.etapas" },
            data: { valor: JSON.stringify(renombrada) },
        });
        const etapas = await armarExpedienteEtapas(reporte.id);
        const guardas = etapas!.find((e) => e.clave === "guardas")!;
        expect(guardas.nombre).toBe("Guardas renombradas por experto");
    });

    it("campos gated se omiten sin revelar y se incluyen con revelar", async () => {
        const reporte = await crearReporteBase();

        const sinRevelar = await armarExpedienteEtapas(reporte.id);
        const fuenteGated = sinRevelar!.find((e) => e.clave === "peso_fuente")!;
        expect(fuenteGated.gated).toBe(true);
        expect(fuenteGated.campos.ipHash).toBeUndefined();
        const anonGated = sinRevelar!.find((e) => e.clave === "anonimizacion")!;
        expect(anonGated.gated).toBe(true);
        expect(anonGated.campos.textoOriginal).toBeUndefined();

        const conRevelar = await armarExpedienteEtapas(reporte.id, { revelar: true });
        const fuenteRev = conRevelar!.find((e) => e.clave === "peso_fuente")!;
        expect(fuenteRev.gated).toBe(false);
        expect(fuenteRev.campos.ipHash).toBe("iphash-de-prueba");
        const anonRev = conRevelar!.find((e) => e.clave === "anonimizacion")!;
        expect(anonRev.campos.textoOriginal).toBe("Texto original con nombre propio de prueba.");
    });
});
