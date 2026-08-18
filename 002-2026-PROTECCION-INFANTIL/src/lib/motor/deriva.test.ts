/**
 * SPEC-172 (Pilar D.5) — Tests de integración del cálculo de deriva del motor.
 * BD real (regla arch:check (e): prohibido mockear el singleton de Prisma).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import type { CategoriaConducta } from "@prisma/client";
import {
    calcularDeriva,
    obtenerBaselineBanco,
    parsearRecallPorCategoria,
    semanaAnteriorBogota,
    lunesSemanaBogota,
} from "./deriva";

// Ventana de medición fija: semana operativa lun 3 ago → lun 10 ago 2026 (Bogotá).
const DESDE = new Date("2026-08-03T00:00:00.000-05:00");
const HASTA = new Date("2026-08-10T00:00:00.000-05:00");
const DENTRO = new Date("2026-08-05T15:00:00.000Z");
const FUERA = new Date("2026-07-20T15:00:00.000Z"); // dos semanas antes: fuera de la ventana

let seq = 0;

async function sembrarParametrosDeriva(overrides: Record<string, string> = {}) {
    const valores: Record<string, { valor: string; tipo: "INTEGER" | "BOOLEAN" | "STRING" }> = {
        "motor.deriva.enabled": { valor: "true", tipo: "BOOLEAN" },
        "motor.deriva.umbral_pp": { valor: "15", tipo: "INTEGER" },
        "motor.deriva.min_muestra": { valor: "20", tipo: "INTEGER" },
        "motor.deriva.ventana_dias": { valor: "7", tipo: "INTEGER" },
        "motor.deriva.email.destinatarios": { valor: "", tipo: "STRING" },
        "motor.deriva.email.siempre": { valor: "false", tipo: "BOOLEAN" },
    };
    for (const [clave, extra] of Object.entries(overrides)) {
        valores[clave] = { ...valores[clave]!, valor: extra };
    }
    await prisma.parametroSistema.createMany({
        data: Object.entries(valores).map(([clave, { valor, tipo }]) => ({
            clave,
            valor,
            tipo,
            categoria: "SYSTEM",
            esPublico: false,
        })),
    });
}

/**
 * Siembra `total` clasificaciones de producción en la ventana y cuelga
 * correcciones (confirmadas y/o no confirmadas) de las primeras: cada
 * CorreccionAdmin exige su propia ClasificacionIA (clasificacionId @unique).
 */
async function sembrarActividad(params: {
    categoria: CategoriaConducta;
    total: number;
    confirmadas?: number;
    noConfirmadas?: number;
    creadoEn?: Date;
    adminId?: string;
}) {
    const { categoria, total, confirmadas = 0, noConfirmadas = 0, creadoEn = DENTRO } = params;
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const clasificacionIds: string[] = [];
    for (let i = 0; i < total; i++) {
        seq += 1;
        const reporte = await prisma.reporte.create({
            data: {
                identificador: `+57300DER${seq}`,
                plataformaId: plataforma!.id,
                texto: "Texto de prueba de deriva (solo metadatos se miden)",
                fechaIncidente: creadoEn,
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
            },
        });
        const clasificacion = await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria,
                confianza: 0.8,
                modeloUsado: "ornith:9b",
                latenciaMs: 100,
                creadoEn,
            },
        });
        clasificacionIds.push(clasificacion.id);
    }
    const totalCorrecciones = confirmadas + noConfirmadas;
    if (totalCorrecciones > 0) {
        const adminId = params.adminId ?? (await crearUsuario("ADMIN")).id;
        for (let i = 0; i < totalCorrecciones; i++) {
            await prisma.correccionAdmin.create({
                data: {
                    clasificacionId: clasificacionIds[i]!,
                    categoriaOriginal: categoria,
                    categoriaCorregida: "SOLICITUD_ENCUENTRO",
                    adminId,
                    confirmada: i < confirmadas,
                    creadoEn,
                },
            });
        }
    }
}

async function sembrarRunBanco(
    recallPorCategoria: Record<string, number>,
    fechaFin: Date,
    estado = "COMPLETADA"
) {
    const admin = await crearUsuario("ADMIN");
    const porCategoria = Object.fromEntries(
        Object.entries(recallPorCategoria).map(([categoria, recall]) => [
            categoria,
            {
                precision: recall,
                recall,
                f1: recall,
                support: 10,
                aciertos: Math.round(recall * 10),
                fallos: 10 - Math.round(recall * 10),
            },
        ])
    );
    return prisma.simulacionRun.create({
        data: {
            modelo: "ornith:9b",
            totalCasos: 10,
            estado,
            fechaInicio: fechaFin,
            fechaFin,
            metricasJson: { accuracy: 0.9, porCategoria },
            creadoPorId: admin.id,
        },
    });
}

describe("motor/deriva (SPEC-172)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe("helpers de semana (America/Bogota, sin BD)", () => {
        it("miércoles: la semana anterior es el lunes-domingo recién cerrado", () => {
            const miercoles = new Date("2026-08-19T15:00:00.000Z"); // mié 10:00 Bogotá
            const s = semanaAnteriorBogota(miercoles);
            expect(s.desde.toISOString()).toBe("2026-08-10T05:00:00.000Z");
            expect(s.hasta.toISOString()).toBe("2026-08-17T05:00:00.000Z");
            expect(s.semanaInicio.toISOString()).toBe("2026-08-10T05:00:00.000Z");
        });

        it("lunes 00:00 Bogotá exacto: la semana anterior cierra en ese instante", () => {
            const lunesCero = new Date("2026-08-17T05:00:00.000Z");
            const s = semanaAnteriorBogota(lunesCero);
            expect(s.desde.toISOString()).toBe("2026-08-10T05:00:00.000Z");
            expect(s.hasta.toISOString()).toBe("2026-08-17T05:00:00.000Z");
        });

        it("domingo 23:30 Bogotá: la semana en curso aún no cierra", () => {
            const domingoNoche = new Date("2026-08-17T04:30:00.000Z"); // dom 23:30 Bogotá
            const s = semanaAnteriorBogota(domingoNoche);
            expect(s.desde.toISOString()).toBe("2026-08-03T05:00:00.000Z");
            expect(s.hasta.toISOString()).toBe("2026-08-10T05:00:00.000Z");
        });

        it("lunesSemanaBogota cruza de mes sin romperse (lunes cae en julio)", () => {
            const primeroAgosto = new Date("2026-08-01T15:00:00.000Z"); // sábado
            expect(lunesSemanaBogota(primeroAgosto).toISOString()).toBe("2026-07-27T05:00:00.000Z");
        });
    });

    describe("parsearRecallPorCategoria (type guards del JSON)", () => {
        it("extrae recall por categoría y descarta entradas mal formadas", () => {
            const mapa = parsearRecallPorCategoria({
                accuracy: 0.9,
                porCategoria: {
                    EXTORSION: { precision: 0.8, recall: 0.75, f1: 0.77, support: 4, aciertos: 3, fallos: 1 },
                    ROTA: { precision: "alta" },
                },
            });
            expect(mapa?.get("EXTORSION")).toBe(0.75);
            expect(mapa?.has("ROTA")).toBe(false);
        });

        it("devuelve null si la forma no es la del banco", () => {
            expect(parsearRecallPorCategoria(null)).toBeNull();
            expect(parsearRecallPorCategoria("texto")).toBeNull();
            expect(parsearRecallPorCategoria({ accuracy: 0.9 })).toBeNull();
        });
    });

    describe("obtenerBaselineBanco", () => {
        it("elige la COMPLETADA más reciente por fechaFin e ignora FALLIDA", async () => {
            await sembrarRunBanco({ EXTORSION: 0.5 }, new Date("2026-07-01T00:00:00.000Z"));
            const nueva = await sembrarRunBanco({ EXTORSION: 0.9 }, new Date("2026-08-01T00:00:00.000Z"));
            await sembrarRunBanco({ EXTORSION: 0.99 }, new Date("2026-08-08T00:00:00.000Z"), "FALLIDA");

            const baseline = await obtenerBaselineBanco();
            expect(baseline?.runId).toBe(nueva.id);
            expect(baseline?.porCategoria.get("EXTORSION")).toBe(0.9);
        });

        it("sin COMPLETADA devuelve null", async () => {
            await sembrarRunBanco({ EXTORSION: 0.9 }, new Date("2026-08-08T00:00:00.000Z"), "FALLIDA");
            expect(await obtenerBaselineBanco()).toBeNull();
        });
    });

    describe("calcularDeriva", () => {
        it("(a) aplica la fórmula exacta: brechaPp = (tasaCorreccion − (1 − accuracyBanco)) × 100", async () => {
            await sembrarParametrosDeriva({ "motor.deriva.min_muestra": "5" });
            await sembrarRunBanco({ OFRECIMIENTO_REGALOS: 0.9 }, new Date("2026-08-01T00:00:00.000Z"));
            await sembrarActividad({ categoria: "OFRECIMIENTO_REGALOS", total: 10, confirmadas: 2 });
            // Ruido fuera de la ventana: no debe mover ningún número.
            await sembrarActividad({ categoria: "OFRECIMIENTO_REGALOS", total: 3, confirmadas: 3, creadoEn: FUERA });

            const filas = await calcularDeriva(DESDE, HASTA, DESDE);
            const fila = filas.find((f) => f.categoria === "OFRECIMIENTO_REGALOS");

            expect(fila?.total).toBe(10);
            expect(fila?.correcciones).toBe(2);
            expect(fila?.tasaCorreccion).toBeCloseTo(0.2, 10);
            expect(fila?.accuracyBanco).toBe(0.9);
            // tasaCorreccion 0.2, error del banco 1 − 0.9 = 0.1 → brecha = 10 pp
            expect(fila?.brechaPp).toBeCloseTo((0.2 - (1 - 0.9)) * 100, 10);
            expect(fila?.brechaPp).toBeCloseTo(10, 6);
            expect(fila?.muestraInsuficiente).toBe(false);
            expect(fila?.alertada).toBe(false); // 10 pp no supera el umbral de 15
        });

        it("(b) solo cuentan las correcciones confirmadas", async () => {
            await sembrarParametrosDeriva({ "motor.deriva.min_muestra": "5" });
            await sembrarRunBanco({ EXTORSION: 0.8 }, new Date("2026-08-01T00:00:00.000Z"));
            await sembrarActividad({ categoria: "EXTORSION", total: 10, confirmadas: 2, noConfirmadas: 3 });

            const filas = await calcularDeriva(DESDE, HASTA, DESDE);
            const fila = filas.find((f) => f.categoria === "EXTORSION");

            expect(fila?.correcciones).toBe(2);
            expect(fila?.tasaCorreccion).toBeCloseTo(0.2, 10);
        });

        it("(c) min_muestra excluye: brecha alta no alerta con muestra insuficiente", async () => {
            await sembrarParametrosDeriva(); // min_muestra default 20
            await sembrarRunBanco({ DOXING: 0.9 }, new Date("2026-08-01T00:00:00.000Z"));
            await sembrarActividad({ categoria: "DOXING", total: 10, confirmadas: 5 });

            const filas = await calcularDeriva(DESDE, HASTA, DESDE);
            const fila = filas.find((f) => f.categoria === "DOXING");

            // brecha = (0.5 − 0.1) × 100 = 40 pp > umbral 15, pero total 10 < 20
            expect(fila?.brechaPp).toBeCloseTo(40, 6);
            expect(fila?.muestraInsuficiente).toBe(true);
            expect(fila?.alertada).toBe(false);

            // Control: con min_muestra=5 la misma brecha SÍ alerta.
            await prisma.parametroSistema.update({
                where: { clave: "motor.deriva.min_muestra" },
                data: { valor: "5" },
            });
            const filas2 = await calcularDeriva(DESDE, HASTA, DESDE);
            expect(filas2.find((f) => f.categoria === "DOXING")?.alertada).toBe(true);
        });

        it("(d) sin SimulacionRun COMPLETADA: accuracyBanco y brechaPp son null", async () => {
            await sembrarParametrosDeriva({ "motor.deriva.min_muestra": "5" });
            await sembrarRunBanco({ OFRECIMIENTO_REGALOS: 0.9 }, new Date("2026-08-08T00:00:00.000Z"), "FALLIDA");
            await sembrarActividad({ categoria: "OFRECIMIENTO_REGALOS", total: 10, confirmadas: 2 });

            const filas = await calcularDeriva(DESDE, HASTA, DESDE);
            const fila = filas.find((f) => f.categoria === "OFRECIMIENTO_REGALOS");

            expect(fila?.accuracyBanco).toBeNull();
            expect(fila?.brechaPp).toBeNull();
            expect(fila?.alertada).toBe(false);
        });

        it("(e) recalcular la misma semana hace upsert: no duplica y actualiza valores", async () => {
            await sembrarParametrosDeriva({ "motor.deriva.min_muestra": "5" });
            await sembrarRunBanco({ OFRECIMIENTO_REGALOS: 0.9 }, new Date("2026-08-01T00:00:00.000Z"));
            await sembrarActividad({ categoria: "OFRECIMIENTO_REGALOS", total: 10, confirmadas: 2 });

            await calcularDeriva(DESDE, HASTA, DESDE);

            // El mundo cambia: una corrección confirmada más dentro de la ventana.
            await sembrarActividad({ categoria: "OFRECIMIENTO_REGALOS", total: 1, confirmadas: 1 });
            const filas = await calcularDeriva(DESDE, HASTA, DESDE);

            const snapshots = await prisma.derivaMotorSnapshot.findMany({
                where: { semanaInicio: DESDE, categoria: "OFRECIMIENTO_REGALOS" },
            });
            expect(snapshots).toHaveLength(1);
            expect(snapshots[0]?.correcciones).toBe(3);
            expect(snapshots[0]?.total).toBe(11);
            expect(filas.find((f) => f.categoria === "OFRECIMIENTO_REGALOS")?.tasaCorreccion).toBeCloseTo(3 / 11, 10);
        });

        it("persiste una fila por categoría con actividad en la ventana", async () => {
            await sembrarParametrosDeriva({ "motor.deriva.min_muestra": "5" });
            await sembrarRunBanco({ OFRECIMIENTO_REGALOS: 0.9 }, new Date("2026-08-01T00:00:00.000Z"));
            await sembrarActividad({ categoria: "OFRECIMIENTO_REGALOS", total: 6, confirmadas: 1 });
            await sembrarActividad({ categoria: "EXTORSION", total: 8, confirmadas: 0 });

            const filas = await calcularDeriva(DESDE, HASTA, DESDE);
            expect(filas.map((f) => f.categoria)).toEqual(["EXTORSION", "OFRECIMIENTO_REGALOS"]);
            // EXTORSION no tiene recall en el banco → sin baseline para esa categoría.
            const extorsion = filas.find((f) => f.categoria === "EXTORSION");
            expect(extorsion?.accuracyBanco).toBeNull();
            expect(extorsion?.brechaPp).toBeNull();

            const count = await prisma.derivaMotorSnapshot.count({ where: { semanaInicio: DESDE } });
            expect(count).toBe(2);
        });
    });
});
