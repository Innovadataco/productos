import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { workerLogger, _invalidateWorkerLoggerCache, type WorkerLogger } from "./worker-logger";
import { prisma } from "@/lib/prisma";
import { getParametroSistemaValor } from "@/lib/parametros";

/**
 * Tests unitarios del helper workerLogger (SPEC-193 Fase 5).
 * No usan base de datos: se mockean prisma.workerLog.create y la lectura de
 * parámetros de sistema. El logger de consola se silencia para no ensuciar la
 * salida de los tests.
 */

vi.mock("@/lib/prisma", () => ({
    prisma: {
        workerLog: {
            create: vi.fn().mockResolvedValue({ id: "log-id" }),
        },
    },
}));

vi.mock("@/lib/parametros", () => ({
    getParametroSistemaValor: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/logger", () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

const createMock = vi.mocked(prisma.workerLog.create);
const getParamMock = vi.mocked(getParametroSistemaValor);

function setConfig(enabled: boolean, nivelMinimo: string) {
    getParamMock.mockImplementation(async (clave: string) => {
        if (clave === "monitoreo.logs.enabled") return enabled ? "true" : "false";
        if (clave === "monitoreo.logs.nivel_minimo") return nivelMinimo;
        return null;
    });
}

describe("workerLogger (SPEC-193 Fase 5)", () => {
    beforeEach(() => {
        _invalidateWorkerLoggerCache();
        createMock.mockClear();
        getParamMock.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("persiste en BD cuando monitoreo.logs.enabled=true y nivel >= mínimo", async () => {
        setConfig(true, "INFO");
        await workerLogger.info("mensaje de prueba", { extra: 1 });

        expect(createMock).toHaveBeenCalledTimes(1);
        expect(createMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    servicio: "worker",
                    nivel: "INFO",
                    mensaje: "mensaje de prueba",
                    contextoJson: { extra: 1 },
                }),
            })
        );
    });

    it("persiste niveles superiores al mínimo", async () => {
        setConfig(true, "WARN");
        await workerLogger.error("error crítico");

        expect(createMock).toHaveBeenCalledTimes(1);
        expect(createMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    servicio: "worker",
                    nivel: "ERROR",
                    mensaje: "error crítico",
                }),
            })
        );
    });

    it("NO persiste cuando el nivel es menor al mínimo", async () => {
        setConfig(true, "WARN");
        await workerLogger.info("solo info");

        expect(createMock).not.toHaveBeenCalled();
    });

    it("NO persiste cuando monitoreo.logs.enabled=false", async () => {
        setConfig(false, "DEBUG");
        await workerLogger.error("no se guarda");

        expect(createMock).not.toHaveBeenCalled();
    });

    it("NO lanza si la escritura a BD falla", async () => {
        setConfig(true, "INFO");
        createMock.mockRejectedValueOnce(new Error("base de datos caida"));

        await expect(workerLogger.info("mensaje seguro")).resolves.toBeUndefined();
        expect(createMock).toHaveBeenCalledTimes(1);
    });

    it(".child() hereda el servicio por defecto y permite override", async () => {
        setConfig(true, "INFO");
        const hijo = workerLogger.child({ servicio: "worker-reportes" });

        await hijo.warn("desde el hijo");

        expect(createMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    servicio: "worker-reportes",
                    nivel: "WARN",
                    mensaje: "desde el hijo",
                }),
            })
        );
    });

    it(".child() mantiene independencia del logger padre", async () => {
        setConfig(true, "INFO");
        const hijo = workerLogger.child({ servicio: "pi-app" });

        await workerLogger.info("padre");
        await hijo.info("hijo");

        expect(createMock).toHaveBeenCalledTimes(2);
        expect(createMock).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                data: expect.objectContaining({ servicio: "worker", mensaje: "padre" }),
            })
        );
        expect(createMock).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                data: expect.objectContaining({ servicio: "pi-app", mensaje: "hijo" }),
            })
        );
    });

    it("usa WARN como fallback cuando el nivel mínimo configurado es inválido", async () => {
        setConfig(true, "NO_VALIDO");
        await workerLogger.warn("debe persistir con fallback");
        await workerLogger.info("no debe persistir con fallback warn");

        expect(createMock).toHaveBeenCalledTimes(1);
        expect(createMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    nivel: "WARN",
                    mensaje: "debe persistir con fallback",
                }),
            })
        );
    });

    it("cachea la configuración y la invalidación la vuelve a leer", async () => {
        setConfig(true, "INFO");
        await workerLogger.info("primero");
        expect(getParamMock).toHaveBeenCalledTimes(2);

        // Sin invalidar, el cache evita nuevas lecturas.
        await workerLogger.info("segundo");
        expect(getParamMock).toHaveBeenCalledTimes(2);

        // Tras invalidar vuelve a leer.
        _invalidateWorkerLoggerCache();
        await workerLogger.info("tercero");
        expect(getParamMock).toHaveBeenCalledTimes(4);
    });

    it("todos los niveles válidos respetan el umbral DEBUG", async () => {
        setConfig(true, "DEBUG");
        await workerLogger.debug("debug");
        await workerLogger.info("info");
        await workerLogger.warn("warn");
        await workerLogger.error("error");

        expect(createMock).toHaveBeenCalledTimes(4);
    });
});
