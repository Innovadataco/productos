/**
 * SPEC-172 (Pilar D.5) — Tests de integración del GET /api/admin/motor/deriva.
 * BD real; solo se mockea verifyAuth (regla arch:check (e): prisma jamás).
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

const URL = "http://localhost:5005/api/admin/motor/deriva";

const SEMANA_RECIENTE = new Date("2026-08-10T05:00:00.000Z"); // lunes (Bogotá)
const SEMANA_VIEJA = new Date("2026-08-03T05:00:00.000Z");

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
    return admin;
}

async function sembrarParametros(overrides: Record<string, string> = {}) {
    const valores: Record<string, string> = {
        "motor.deriva.umbral_pp": "15",
        "motor.deriva.min_muestra": "20",
        ...overrides,
    };
    await prisma.parametroSistema.createMany({
        data: Object.entries(valores).map(([clave, valor]) => ({
            clave,
            valor,
            tipo: "INTEGER",
            categoria: "SYSTEM",
            esPublico: false,
        })),
    });
}

async function sembrarSnapshot(semanaInicio: Date) {
    await prisma.derivaMotorSnapshot.createMany({
        data: [
            {
                semanaInicio,
                categoria: "EXTORSION",
                total: 40,
                correcciones: 2,
                tasaCorreccion: 0.05,
                accuracyBanco: 0.92,
                brechaPp: -3,
                alertada: false,
            },
            {
                semanaInicio,
                categoria: "OFRECIMIENTO_REGALOS",
                total: 10,
                correcciones: 4,
                tasaCorreccion: 0.4,
                accuracyBanco: 0.9,
                brechaPp: 30,
                alertada: true,
            },
        ],
    });
}

async function sembrarRunBanco(fechaFin: Date) {
    const admin = await crearUsuario("ADMIN");
    return prisma.simulacionRun.create({
        data: {
            modelo: "ornith:9b",
            totalCasos: 10,
            estado: "COMPLETADA",
            fechaInicio: fechaFin,
            fechaFin,
            metricasJson: {
                accuracy: 0.9,
                porCategoria: {
                    EXTORSION: { precision: 0.92, recall: 0.92, f1: 0.92, support: 10, aciertos: 9, fallos: 1 },
                },
            },
            creadoPorId: admin.id,
        },
    });
}

describe("GET /api/admin/motor/deriva (SPEC-172)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("401 sin autenticación", async () => {
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(new AppError("No autenticado", ERROR_CODES.AUTH_INVALID, 401));
        const res = await GET(new Request(URL));
        expect(res.status).toBe(401);
    });

    it("403 con rol PARENT (verifyAuth exige ADMIN)", async () => {
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403));
        const res = await GET(new Request(URL));
        expect(res.status).toBe(403);
    });

    it("sin snapshot devuelve filas vacías, sinBaseline y mensaje", async () => {
        await autenticarAdmin();

        const res = await GET(new Request(URL));
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.filas).toEqual([]);
        expect(body.sinBaseline).toBe(true);
        expect(typeof body.mensaje).toBe("string");
    });

    it("devuelve solo la semana más reciente, con baseline, umbrales y sin PII", async () => {
        await autenticarAdmin();
        await sembrarParametros();
        const fechaFinBanco = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 días
        const run = await sembrarRunBanco(fechaFinBanco);
        await sembrarSnapshot(SEMANA_VIEJA);
        await sembrarSnapshot(SEMANA_RECIENTE);

        const res = await GET(new Request(URL));
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.semanaInicio).toBe(SEMANA_RECIENTE.toISOString());
        expect(body.filas).toHaveLength(2);
        expect(body.filas.map((f: { categoria: string }) => f.categoria)).toEqual([
            "EXTORSION",
            "OFRECIMIENTO_REGALOS",
        ]);
        expect(body.baseline).toEqual({
            baselineFecha: fechaFinBanco.toISOString(),
            baselineRunId: run.id,
            baselineVieja: false,
        });
        expect(body.umbrales).toEqual({ umbralPp: 15, minMuestra: 20 });

        // Sin PII ni textos: el DTO expone exactamente estas claves agregadas.
        for (const fila of body.filas) {
            expect(Object.keys(fila).sort()).toEqual([
                "accuracyBanco",
                "alertada",
                "brechaPp",
                "categoria",
                "correcciones",
                "muestraInsuficiente",
                "tasaCorreccion",
                "total",
            ]);
        }
        // muestraInsuficiente se deriva del umbral vigente (min_muestra=20).
        const extorsion = body.filas.find((f: { categoria: string }) => f.categoria === "EXTORSION");
        expect(extorsion.muestraInsuficiente).toBe(false);
        const regalos = body.filas.find((f: { categoria: string }) => f.categoria === "OFRECIMIENTO_REGALOS");
        expect(regalos.muestraInsuficiente).toBe(true);
    });

    it("baselineVieja=true cuando el banco tiene más de 30 días", async () => {
        await autenticarAdmin();
        await sembrarParametros();
        await sembrarRunBanco(new Date(Date.now() - 40 * 24 * 60 * 60 * 1000));
        await sembrarSnapshot(SEMANA_RECIENTE);

        const res = await GET(new Request(URL));
        const body = await res.json();
        expect(body.baseline.baselineVieja).toBe(true);
    });

    it("sin run COMPLETADA el baseline sale en null y baselineVieja en false", async () => {
        await autenticarAdmin();
        await sembrarParametros();
        await sembrarSnapshot(SEMANA_RECIENTE);

        const res = await GET(new Request(URL));
        const body = await res.json();
        expect(body.baseline).toEqual({ baselineFecha: null, baselineRunId: null, baselineVieja: false });
    });
});
