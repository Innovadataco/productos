import { describe, it, expect, beforeEach, vi } from "vitest";

const mockSend = vi.hoisted(() => vi.fn());
const mockStart = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockCreateQueue = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockOn = vi.hoisted(() => vi.fn());
const mockQueryRaw = vi.hoisted(() => vi.fn());
const mockFindMany = vi.hoisted(() => vi.fn());
const mockParametroSistemaValor = vi.hoisted(() => vi.fn());

vi.mock("pg-boss", () => ({
    PgBoss: vi.fn().mockImplementation(() => ({
        start: mockStart,
        createQueue: mockCreateQueue,
        send: mockSend,
        on: mockOn,
    })),
}));

vi.mock("./prisma", () => ({
    prisma: {
        $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
        reporte: {
            findMany: (...args: unknown[]) => mockFindMany(...args),
        },
        parametroSistema: {
            findUnique: vi.fn(),
        },
    },
}));

vi.mock("./parametros", () => ({
    getParametroSistemaValor: (clave: string) => mockParametroSistemaValor(clave),
}));

import { sendReporte, getQueueStats, drainPending, getWorkerParams } from "./queue";

describe("queue.ts", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        mockParametroSistemaValor.mockResolvedValue(null);
        mockSend.mockResolvedValue("job-id-123");
        mockQueryRaw.mockResolvedValue([{ pendientes: 0 }]);
        mockFindMany.mockResolvedValue([]);
    });

    describe("getWorkerParams", () => {
        it("lee parámetros con defaults", async () => {
            mockParametroSistemaValor.mockImplementation((clave: string) => {
                if (clave === "worker.max_reintentos") return "5";
                if (clave === "worker.retry_delay_segundos") return "60";
                if (clave === "worker.concurrencia") return "4";
                if (clave === "worker.max_pendientes") return "50";
                return null;
            });

            const params = await getWorkerParams();
            expect(params.maxReintentos).toBe(5);
            expect(params.retryDelaySegundos).toBe(60);
            expect(params.concurrencia).toBe(4);
            expect(params.maxPendientes).toBe(50);
        });

        it("usa defaults cuando los parámetros no existen", async () => {
            const params = await getWorkerParams();
            expect(params.maxReintentos).toBe(3);
            expect(params.retryDelaySegundos).toBe(30);
            expect(params.concurrencia).toBe(2);
            expect(params.maxPendientes).toBe(100);
        });
    });

    describe("getQueueStats", () => {
        it("cuenta jobs pendientes de reporte-procesamiento", async () => {
            mockQueryRaw.mockResolvedValue([{ pendientes: 7 }]);
            const stats = await getQueueStats();
            expect(stats.pendientes).toBe(7);
        });
    });

    describe("sendReporte", () => {
        beforeEach(() => {
            mockParametroSistemaValor.mockImplementation((clave: string) => {
                if (clave === "worker.max_reintentos") return "3";
                if (clave === "worker.retry_delay_segundos") return "30";
                if (clave === "worker.max_pendientes") return "100";
                return null;
            });
        });

        it("encola con prioridad alta (10) para reportes autenticados", async () => {
            await sendReporte("reporte-1", { prioridadAlta: true });
            expect(mockSend).toHaveBeenCalledWith(
                "reporte-procesamiento",
                { reporteId: "reporte-1", intento: 0 },
                { priority: 10, retryLimit: 3, retryDelay: 30, retryBackoff: true }
            );
        });

        it("encola con prioridad baja (1) para reportes anónimos sin keyword", async () => {
            await sendReporte("reporte-2", { prioridadAlta: false });
            expect(mockSend).toHaveBeenCalledWith(
                "reporte-procesamiento",
                { reporteId: "reporte-2", intento: 0 },
                { priority: 1, retryLimit: 3, retryDelay: 30, retryBackoff: true }
            );
        });

        it("eleva anónimo con keyword de alto riesgo a prioridad alta", async () => {
            await sendReporte("reporte-3", { prioridadAlta: true });
            expect(mockSend).toHaveBeenCalledWith(
                "reporte-procesamiento",
                { reporteId: "reporte-3", intento: 0 },
                expect.objectContaining({ priority: 10 })
            );
        });

        it("aplica backpressure cuando los jobs pendientes alcanzan el límite", async () => {
            mockQueryRaw.mockResolvedValue([{ pendientes: 100 }]);
            const result = await sendReporte("reporte-4", { prioridadAlta: false });
            expect(result.encolado).toBe(false);
            expect(mockSend).not.toHaveBeenCalled();
        });
    });

    describe("drainPending", () => {
        beforeEach(() => {
            mockParametroSistemaValor.mockImplementation((clave: string) => {
                if (clave === "worker.max_reintentos") return "3";
                if (clave === "worker.retry_delay_segundos") return "30";
                if (clave === "worker.max_pendientes") return "100";
                return null;
            });
        });

        it("encola reportes pendientes respetando el cupo libre", async () => {
            mockQueryRaw.mockResolvedValue([{ pendientes: 95 }]);
            mockFindMany.mockResolvedValue([
                { id: "rep-1", prioridadAlta: false },
                { id: "rep-2", prioridadAlta: true },
                { id: "rep-3", prioridadAlta: false },
            ]);

            const result = await drainPending();
            expect(result.encolados).toBe(3);
            expect(mockSend).toHaveBeenCalledTimes(3);
        });

        it("no encola si no hay cupo disponible", async () => {
            mockQueryRaw.mockResolvedValue([{ pendientes: 100 }]);
            const result = await drainPending();
            expect(result.encolados).toBe(0);
            expect(mockFindMany).not.toHaveBeenCalled();
        });
    });
});
