import { describe, it, expect, beforeEach, vi, afterAll } from "vitest";
import { unmockPrisma } from "@/lib/test-mocks/unmock-prisma";
import type { DbClient } from "../unit-of-work";

const mockCount = vi.hoisted(() => vi.fn());
const mockFindFirst = vi.hoisted(() => vi.fn());
const mockFindMany = vi.hoisted(() => vi.fn());
const mockFindUnique = vi.hoisted(() => vi.fn());
const mockQueryRaw = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
    prisma: {
        $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
        estudiante: { count: (...args: unknown[]) => mockCount(...args) },
        profesor: { count: (...args: unknown[]) => mockCount(...args) },
        curso: { count: (...args: unknown[]) => mockCount(...args) },
        materia: { count: (...args: unknown[]) => mockCount(...args) },
        reporte: { count: (...args: unknown[]) => mockCount(...args), findFirst: (...args: unknown[]) => mockFindFirst(...args) },
        alertaColegio: { count: (...args: unknown[]) => mockCount(...args), findMany: (...args: unknown[]) => mockFindMany(...args) },
        solicitudComite: { count: (...args: unknown[]) => mockCount(...args), findMany: (...args: unknown[]) => mockFindMany(...args) },
        integranteComite: { count: (...args: unknown[]) => mockCount(...args) },
        usuario: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
        colegio: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    },
}));

import {
    contarTamañoColegio,
    metricasReportesColegio,
    metricasComiteColegio,
    metricasAlertasColegio,
    calcularComparacionMedia,
} from "./analytics-colegio-helpers";

afterAll(async () => await unmockPrisma());

function makeMockDb(overrides: Partial<DbClient> = {}): DbClient {
    return {
        $queryRaw: mockQueryRaw,
        estudiante: { count: mockCount },
        profesor: { count: mockCount },
        curso: { count: mockCount },
        materia: { count: mockCount },
        reporte: { count: mockCount, findFirst: mockFindFirst },
        alertaColegio: { count: mockCount, findMany: mockFindMany },
        solicitudComite: { count: mockCount, findMany: mockFindMany },
        integranteComite: { count: mockCount },
        usuario: { findUnique: mockFindUnique },
        colegio: { findMany: mockFindMany },
        ...overrides,
    } as unknown as DbClient;
}

describe("analytics-colegio-helpers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCount.mockResolvedValue(0);
        mockFindFirst.mockResolvedValue(null);
        mockFindMany.mockResolvedValue([]);
        mockFindUnique.mockResolvedValue(null);
        mockQueryRaw.mockResolvedValue([]);
    });

    describe("contarTamañoColegio", () => {
        it("devuelve los conteos del colegio", async () => {
            mockCount
                .mockResolvedValueOnce(10)
                .mockResolvedValueOnce(5)
                .mockResolvedValueOnce(3)
                .mockResolvedValueOnce(8);
            const result = await contarTamañoColegio("colegio-1", makeMockDb());
            expect(result).toEqual({ alumnos: 10, profesores: 5, cursos: 3, materias: 8 });
        });
    });

    describe("metricasReportesColegio", () => {
        it("devuelve ceros cuando no hay tenantId", async () => {
            const result = await metricasReportesColegio(null, 30, makeMockDb());
            expect(result.total).toBe(0);
            expect(result.periodo).toBe(0);
            expect(result.spamTotal).toBe(0);
            expect(result.serie).toEqual([]);
        });

        it("agrega métricas de reportes con queryRaw", async () => {
            mockCount
                .mockResolvedValueOnce(100)
                .mockResolvedValueOnce(20)
                .mockResolvedValueOnce(5);
            mockFindFirst.mockResolvedValue({ creadoEn: new Date("2026-08-20T00:00:00Z") });
            mockQueryRaw
                .mockResolvedValueOnce([{ dia: new Date("2026-08-20T00:00:00Z"), total: 5 }])
                .mockResolvedValueOnce([{ categoria: "GROOMING", total: 3 }])
                .mockResolvedValueOnce([{ identificador: "+57300X", plataforma: "WhatsApp", total: 2 }]);

            const result = await metricasReportesColegio("tenant-1", 30, makeMockDb());
            expect(result.total).toBe(100);
            expect(result.periodo).toBe(20);
            expect(result.spamTotal).toBe(5);
            expect(result.porClasificacion).toEqual([{ categoria: "GROOMING", total: 3 }]);
            expect(result.topIdentificadores[0].identificador).toBe("+57300X");
        });

        it("usa 'Desconocida' cuando la plataforma es null", async () => {
            mockCount.mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValueOnce(0);
            mockFindFirst.mockResolvedValue(null);
            mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([
                { identificador: "nick", plataforma: null, total: 1 },
            ]);
            const result = await metricasReportesColegio("tenant-1", 30, makeMockDb());
            expect(result.topIdentificadores[0].plataforma).toBe("Desconocida");
        });
    });

    describe("metricasComiteColegio", () => {
        it("devuelve ceros cuando no hay cuenta de comité", async () => {
            const result = await metricasComiteColegio("colegio-1", makeMockDb());
            expect(result.integrantesActivos).toBe(0);
            expect(result.casosEscalados).toBe(0);
        });

        it("cuenta integrantes y casos cuando existe el comité", async () => {
            mockFindUnique.mockResolvedValue({ id: "comite-1" });
            mockCount
                .mockResolvedValueOnce(4)
                .mockResolvedValueOnce(10)
                .mockResolvedValueOnce(6);
            mockFindMany
                .mockResolvedValueOnce([
                    { numero: "SC-1", estado: "RESUELTA", creadoEn: new Date("2026-08-01T00:00:00Z"), resueltoEn: new Date("2026-08-02T00:00:00Z") },
                ])
                .mockResolvedValueOnce([
                    { creadoEn: new Date("2026-08-01T00:00:00Z"), resueltoEn: new Date("2026-08-02T00:00:00Z") },
                ]);

            const result = await metricasComiteColegio("colegio-1", makeMockDb());
            expect(result.integrantesActivos).toBe(4);
            expect(result.casosEscalados).toBe(10);
            expect(result.casosResueltos).toBe(6);
            expect(result.tiempoPromedioResolucionHoras).toBe(24);
            expect(result.ultimosCasos[0].numero).toBe("SC-1");
        });
    });

    describe("metricasAlertasColegio", () => {
        it("resume alertas del colegio", async () => {
            mockCount.mockResolvedValueOnce(7).mockResolvedValueOnce(3);
            mockFindMany.mockResolvedValue([
                { id: "alerta-1", estado: "abierta", tipoSujeto: "estudiante", creadoEn: new Date("2026-08-20T00:00:00Z") },
            ]);
            const result = await metricasAlertasColegio("colegio-1", makeMockDb());
            expect(result.total).toBe(7);
            expect(result.resueltas).toBe(3);
            expect(result.ultimasAlertas[0].id).toBe("alerta-1");
        });
    });

    describe("calcularComparacionMedia", () => {
        it("marca insuficientes cuando hay menos de 3 colegios activos", async () => {
            mockFindMany.mockResolvedValue([{ id: "c1", tenantId: "t1" }]);
            const result = await calcularComparacionMedia("c1", { alumnos: 1, profesores: 1, reportesTotal: 1, reportesUltimos30Dias: 1 }, makeMockDb());
            expect(result.insuficientes).toBe(true);
            expect(result.metricas).toEqual([]);
        });

        it("marca insuficientes cuando quedan menos de 2 colegios comparables", async () => {
            mockFindMany.mockResolvedValue([{ id: "c1", tenantId: "t1" }]);
            const result = await calcularComparacionMedia("c1", { alumnos: 1, profesores: 1, reportesTotal: 1, reportesUltimos30Dias: 1 }, makeMockDb());
            expect(result.insuficientes).toBe(true);
        });

        it("calcula medianas con suficientes colegios", async () => {
            mockFindMany.mockResolvedValue([
                { id: "c1", tenantId: "t1" },
                { id: "c2", tenantId: "t2" },
                { id: "c3", tenantId: "t3" },
            ]);
            mockCount.mockResolvedValue(1);

            const result = await calcularComparacionMedia("c1", { alumnos: 20, profesores: 10, reportesTotal: 4, reportesUltimos30Dias: 2 }, makeMockDb());
            expect(result.insuficientes).toBe(false);
            expect(result.metricas).toHaveLength(4);
            expect(result.metricas[0].valorColegio).toBe(20);
            expect(result.metricas[0].mediana).toBe(1);
        });
    });
});
