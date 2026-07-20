import { describe, it, expect, beforeEach, vi } from "vitest";

const mockSimulacionRunFindUnique = vi.hoisted(() => vi.fn());
const mockSimulacionRunUpdate = vi.hoisted(() => vi.fn());
const mockSimulacionReporteCreate = vi.hoisted(() => vi.fn());
const mockReporteCreate = vi.hoisted(() => vi.fn());
const mockPlataformaFindUnique = vi.hoisted(() => vi.fn());
const mockSendReporte = vi.hoisted(() => vi.fn());
const mockGenerarNumeroSeguimiento = vi.hoisted(() => vi.fn());
const mockEncryptParameter = vi.hoisted(() => vi.fn());
const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
    prisma: {
        simulacionRun: {
            findUnique: (...args: unknown[]) => mockSimulacionRunFindUnique(...args),
            update: (...args: unknown[]) => mockSimulacionRunUpdate(...args),
        },
        simulacionReporte: {
            create: (...args: unknown[]) => mockSimulacionReporteCreate(...args),
        },
        reporte: {
            create: (...args: unknown[]) => mockReporteCreate(...args),
        },
        plataforma: {
            findUnique: (...args: unknown[]) => mockPlataformaFindUnique(...args),
        },
        $transaction: (fn: unknown) => {
            if (typeof fn === "function") {
                return fn({
                    reporte: { create: mockReporteCreate },
                    simulacionReporte: { create: mockSimulacionReporteCreate },
                });
            }
            return Promise.reject(new Error("$transaction no implementado"));
        },
    },
}));

vi.mock("@/lib/queue", () => ({
    sendReporte: (...args: unknown[]) => mockSendReporte(...args),
}));

vi.mock("@/lib/reporte-utils", () => ({
    generarNumeroSeguimiento: () => mockGenerarNumeroSeguimiento(),
}));

vi.mock("@/lib/param-encryption", () => ({
    encryptParameter: (val: string) => mockEncryptParameter(val),
}));

vi.mock("@/lib/logger", () => ({
    logger: {
        info: (...args: unknown[]) => mockLoggerInfo(...args),
        error: (...args: unknown[]) => mockLoggerError(...args),
    },
}));

import { crearReporteSimulacion, runSimulacionBatchCreator } from "./executor";

describe("executor.ts", () => {
    const casoCompleto = {
        texto: "Este es un texto de prueba con más de veinte caracteres",
        plataforma: "instagram",
        identificador: "usuario123",
        fechaIncidente: "2026-01-15T10:00:00Z",
        ciudad: "Bogotá",
        pais: "Colombia",
        edadVictima: 14,
        categoriaEsperada: "ACOSO",
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGenerarNumeroSeguimiento.mockReturnValue("RPT-TEST01");
        mockEncryptParameter.mockImplementation((val: string) => `enc:${val}`);
        mockSendReporte.mockResolvedValue(undefined);
        mockPlataformaFindUnique.mockResolvedValue({ id: "plataforma-1" });
        mockReporteCreate.mockResolvedValue({ id: "reporte-1" });
        mockSimulacionReporteCreate.mockResolvedValue({ id: "sim-rep-1" });
    });

    describe("crearReporteSimulacion", () => {
        it("crea un reporte con los campos reales del caso", async () => {
            mockSimulacionRunFindUnique.mockResolvedValue({ id: "run-1" });

            await crearReporteSimulacion("run-1", 1, casoCompleto, "ornith:9b");

            expect(mockReporteCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        fechaIncidente: new Date("2026-01-15T10:00:00Z"),
                        ciudad: "Bogotá",
                        pais: "Colombia",
                        edadVictima: 14,
                        esAnonimo: true,
                    }),
                })
            );
        });

        it("no inventa ciudad, pais ni fechaIncidente", async () => {
            mockSimulacionRunFindUnique.mockResolvedValue({ id: "run-1" });

            await crearReporteSimulacion("run-1", 1, casoCompleto, "ornith:9b");

            const data = mockReporteCreate.mock.calls[0][0].data;
            expect(data.ciudad).not.toBe("Simulación");
            expect(data.pais).not.toBe("Simulación");
            expect(data.fechaIncidente).toEqual(new Date("2026-01-15T10:00:00Z"));
        });

        it("guarda categoriaEsperada solo en SimulacionReporte", async () => {
            mockSimulacionRunFindUnique.mockResolvedValue({ id: "run-1" });

            await crearReporteSimulacion("run-1", 1, casoCompleto, "ornith:9b");

            const reporteData = mockReporteCreate.mock.calls[0][0].data;
            expect(reporteData.categoriaEsperada).toBeUndefined();
            expect(mockSimulacionReporteCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        categoriaEsperada: "ACOSO",
                    }),
                })
            );
        });

        it("encola el reporte con el modelo override", async () => {
            mockSimulacionRunFindUnique.mockResolvedValue({ id: "run-1" });

            await crearReporteSimulacion("run-1", 1, casoCompleto, "ornith:9b");

            expect(mockSendReporte).toHaveBeenCalledWith("reporte-1", { modeloClasificacion: "ornith:9b" });
        });

        it("funciona sin edadVictima ni categoriaEsperada", async () => {
            mockSimulacionRunFindUnique.mockResolvedValue({ id: "run-1" });
            const casoMinimo = { ...casoCompleto, edadVictima: undefined, categoriaEsperada: undefined };

            await crearReporteSimulacion("run-1", 1, casoMinimo, "ornith:9b");

            const data = mockReporteCreate.mock.calls[0][0].data;
            expect(data.edadVictima).toBeUndefined();
            expect(mockSimulacionReporteCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        categoriaEsperada: undefined,
                    }),
                })
            );
        });
    });

    describe("runSimulacionBatchCreator", () => {
        it("crea todos los reportes de una corrida", async () => {
            mockSimulacionRunFindUnique.mockResolvedValue({
                id: "run-1",
                estado: "PENDIENTE",
                casosJson: [casoCompleto, casoCompleto],
                metricasJson: {},
            });

            await runSimulacionBatchCreator("run-1", "ornith:9b");

            expect(mockReporteCreate).toHaveBeenCalledTimes(2);
            expect(mockSendReporte).toHaveBeenCalledTimes(2);
            expect(mockSimulacionRunUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        estado: "COMPLETADA",
                    }),
                })
            );
        });

        it("continúa si un caso falla y reporta el fallo en métricas", async () => {
            mockSimulacionRunFindUnique.mockResolvedValue({
                id: "run-1",
                estado: "PENDIENTE",
                casosJson: [casoCompleto, casoCompleto],
                metricasJson: {},
            });
            mockPlataformaFindUnique
                .mockResolvedValueOnce({ id: "plataforma-1" })
                .mockRejectedValueOnce(new Error("Plataforma no encontrada"));

            await runSimulacionBatchCreator("run-1", "ornith:9b");

            expect(mockReporteCreate).toHaveBeenCalledTimes(1);
            expect(mockSimulacionRunUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        estado: "COMPLETADA",
                        metricasJson: expect.objectContaining({ casosFallidos: 1 }),
                    }),
                })
            );
        });

        it("marca FALLIDA si todos los casos fallan", async () => {
            mockSimulacionRunFindUnique.mockResolvedValue({
                id: "run-1",
                estado: "PENDIENTE",
                casosJson: [casoCompleto],
                metricasJson: {},
            });
            mockPlataformaFindUnique.mockRejectedValue(new Error("Plataforma no encontrada"));

            await runSimulacionBatchCreator("run-1", "ornith:9b");

            expect(mockReporteCreate).not.toHaveBeenCalled();
            expect(mockSimulacionRunUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        estado: "FALLIDA",
                    }),
                })
            );
        });

        it("no crea reportes si la corrida está CANCELADA", async () => {
            mockSimulacionRunFindUnique.mockResolvedValue({
                id: "run-1",
                estado: "CANCELADA",
                casosJson: [casoCompleto],
                metricasJson: {},
            });

            await runSimulacionBatchCreator("run-1", "ornith:9b");

            expect(mockReporteCreate).not.toHaveBeenCalled();
            expect(mockSimulacionRunUpdate).not.toHaveBeenCalled();
        });

        it("marca FALLIDA si no hay casos", async () => {
            mockSimulacionRunFindUnique.mockResolvedValue({
                id: "run-1",
                estado: "PENDIENTE",
                casosJson: [],
                metricasJson: {},
            });

            await runSimulacionBatchCreator("run-1", "ornith:9b");

            expect(mockSimulacionRunUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        estado: "FALLIDA",
                    }),
                })
            );
        });
    });
});
