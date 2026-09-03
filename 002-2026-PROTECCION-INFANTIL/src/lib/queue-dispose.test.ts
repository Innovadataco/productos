/**
 * SPEC-375 — `disposeBoss` fija el cierre limpio del singleton de pg-boss.
 *
 * Sin cierre limpio: el pool y los schedulers internos de pg-boss mantienen
 * el event loop abierto y el fork de vitest no puede salir → el shard queda
 * colgado en CI hasta el timeout general. Estos tests fijan las tres
 * garantías del helper.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("disposeBoss (SPEC-375)", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it("nunca inicializado → no hace nada (no invoca stop)", async () => {
        const stopMock = vi.fn();
        vi.doMock("pg-boss", () => ({
            PgBoss: vi.fn(() => ({ start: vi.fn(), stop: stopMock })),
        }));
        const { disposeBoss } = await import("./queue");
        await disposeBoss();
        expect(stopMock).not.toHaveBeenCalled();
    });

    it("tras start → stop se llama con {graceful:false, close:true}", async () => {
        const stopMock = vi.fn().mockResolvedValue(undefined);
        const startMock = vi.fn().mockResolvedValue(undefined);
        vi.doMock("pg-boss", () => ({
            PgBoss: vi.fn(() => ({ start: startMock, stop: stopMock })),
        }));
        const { ensureStarted, disposeBoss } = await import("./queue");
        await ensureStarted();
        await disposeBoss();
        expect(startMock).toHaveBeenCalledTimes(1);
        expect(stopMock).toHaveBeenCalledTimes(1);
        expect(stopMock).toHaveBeenCalledWith({ graceful: false, close: true });
    });

    it("dispose es idempotente: dos llamadas → un solo stop", async () => {
        const stopMock = vi.fn().mockResolvedValue(undefined);
        vi.doMock("pg-boss", () => ({
            PgBoss: vi.fn(() => ({ start: vi.fn().mockResolvedValue(undefined), stop: stopMock })),
        }));
        const { ensureStarted, disposeBoss } = await import("./queue");
        await ensureStarted();
        await disposeBoss();
        await disposeBoss();
        expect(stopMock).toHaveBeenCalledTimes(1);
    });

    it("stop que rechaza NO propaga (el shutdown no debe fallar el fork)", async () => {
        const stopMock = vi.fn().mockRejectedValue(new Error("pool ya cerrado"));
        vi.doMock("pg-boss", () => ({
            PgBoss: vi.fn(() => ({ start: vi.fn().mockResolvedValue(undefined), stop: stopMock })),
        }));
        const { ensureStarted, disposeBoss } = await import("./queue");
        await ensureStarted();
        await expect(disposeBoss()).resolves.toBeUndefined();
        expect(stopMock).toHaveBeenCalledTimes(1);
    });

    it("al importar queue.ts se registra en globalThis.__pi_test_disposers", async () => {
        const stopMock = vi.fn();
        vi.doMock("pg-boss", () => ({
            PgBoss: vi.fn(() => ({ start: vi.fn(), stop: stopMock })),
        }));
        const registro = (globalThis as unknown as {
            __pi_test_disposers?: Set<() => Promise<void>>;
        });
        registro.__pi_test_disposers = new Set();
        const modulo = await import("./queue");
        expect(registro.__pi_test_disposers.size).toBe(1);
        expect(registro.__pi_test_disposers.has(modulo.disposeBoss)).toBe(true);
    });
});
