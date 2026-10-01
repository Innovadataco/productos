/**
 * SPEC-812 (pieza 2) · CANDADO de la consulta de PENDIENTES REALES de derivación de dataset.
 *
 * Planta los TRES estados + el trabajo EN VUELO y afirma que la consulta devuelve SOLO el estado 1:
 *   1 · pendiente REAL (sin fila, sin marca, más VIEJA que la holgura)   → SÍ
 *   2 · omitido a propósito (datasetOmitidoEn presente)                   → NO (no es falla: privacidad 807)
 *   3 · derivado (fila de DatasetEntrenamiento)                          → NO
 *   4 · EN VUELO (recién creada, más JOVEN que la holgura)               → NO  ← el que muerde en prod
 * Si devolviera el 2 o el 4, sería la fábrica de falsas alarmas que la spec existe para evitar.
 *
 * Y un control de que la HOLGURA deriva del parámetro vivo ia.ollama.timeout_ms: subir el timeout saca
 * de «pendiente» a una corrección que con el timeout chico sí lo era (si la holgura estuviera clavada,
 * no se movería).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPlataforma } from "@/lib/reporte-test-utils";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { encryptParameter } from "@/lib/param-encryption";
import { correccionesSinDataset } from "./correcciones-sin-dataset";

const MIN = 60_000;
let contador = 0;

async function seedTimeout(ms: number): Promise<void> {
    await prisma.parametroSistema.upsert({
        where: { clave: "ia.ollama.timeout_ms" },
        update: { valor: String(ms) },
        create: { clave: "ia.ollama.timeout_ms", valor: String(ms), tipo: "INTEGER", categoria: "SYSTEM", esPublico: false },
    });
}

async function crearCorreccion(opts: {
    adminId: string;
    plataformaId: string;
    edadMs: number; // antigüedad: creadoEn = now - edadMs
    omitido?: boolean; // estado 2
    conDataset?: boolean; // estado 3
}): Promise<string> {
    contador += 1;
    const reporte = await crearReporteFixture(prisma, {
        data: {
            identificador: `+57300DS${String(contador).padStart(4, "0")}`,
            plataformaId: opts.plataformaId,
            texto: "Texto de prueba para pendientes de dataset.",
            textoOriginal: encryptParameter("Texto original de prueba."),
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            estado: "CLASIFICADO",
            numeroSeguimiento: `RPT-DS${String(contador).padStart(4, "0")}`,
        },
    });
    const clasificacion = await prisma.clasificacionIA.create({
        data: { reporteId: reporte.id, categoria: "CONTACTO_INSISTENTE", confianza: 0.8, modeloUsado: "test-modelo", latenciaMs: 100 },
    });
    const correccion = await prisma.correccionAdmin.create({
        data: {
            clasificacionId: clasificacion.id,
            categoriaOriginal: "CONTACTO_INSISTENTE",
            categoriaCorregida: "CONTACTO_INSISTENTE",
            adminId: opts.adminId,
            creadoEn: new Date(Date.now() - opts.edadMs),
            ...(opts.omitido ? { datasetOmitidoEn: new Date() } : {}),
        },
    });
    if (opts.conDataset) {
        await prisma.datasetEntrenamiento.create({
            data: {
                texto: "ejemplo anonimizado",
                clasificacionCorrecta: "CONTACTO_INSISTENTE",
                fuente: "correccion_admin",
                correccionId: correccion.id,
                textoAnonimizado: true,
            },
        });
    }
    return correccion.id;
}

describe("SPEC-812 · correccionesSinDataset (pendientes reales)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("devuelve SOLO el estado 1; NO el 2 (omitido), ni el 3 (derivado), ni el 4 (en vuelo)", async () => {
        await seedTimeout(60_000); // holgura = 120 s
        const admin = await crearUsuario("ADMIN");
        const pf = await crearPlataforma();
        const estado1 = await crearCorreccion({ adminId: admin.id, plataformaId: pf.id, edadMs: 30 * MIN });
        await crearCorreccion({ adminId: admin.id, plataformaId: pf.id, edadMs: 30 * MIN, omitido: true });
        await crearCorreccion({ adminId: admin.id, plataformaId: pf.id, edadMs: 30 * MIN, conDataset: true });
        await crearCorreccion({ adminId: admin.id, plataformaId: pf.id, edadMs: 5_000 }); // en vuelo (5 s < 120 s)

        const pendientes = await correccionesSinDataset(prisma);
        expect(pendientes.map((p) => p.correccionId)).toEqual([estado1]);
    });

    it("vacío sin error cuando no hay pendientes", async () => {
        await seedTimeout(60_000);
        const admin = await crearUsuario("ADMIN");
        const pf = await crearPlataforma();
        await crearCorreccion({ adminId: admin.id, plataformaId: pf.id, edadMs: 30 * MIN, omitido: true }); // solo un estado 2
        expect(await correccionesSinDataset(prisma)).toEqual([]);
    });

    it("la holgura DERIVA del parámetro: subir el timeout saca de «pendiente» a una corrección en el límite", async () => {
        const admin = await crearUsuario("ADMIN");
        const pf = await crearPlataforma();
        const id = await crearCorreccion({ adminId: admin.id, plataformaId: pf.id, edadMs: 5 * MIN }); // 5 min

        await seedTimeout(60_000); // holgura 120 s → 5 min la supera → pendiente
        expect((await correccionesSinDataset(prisma)).map((p) => p.correccionId)).toEqual([id]);

        await seedTimeout(600_000); // holgura 1200 s = 20 min → 5 min NO la supera → en vuelo, excluida
        expect(await correccionesSinDataset(prisma)).toEqual([]);
    });
});
