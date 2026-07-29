import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { getOllamaTimeoutMs } from "./ollama-config";
import { llamarOllamaStructured } from "./ollama-client";

const CLAVE_TIMEOUT = "ia.ollama.timeout_ms";
const DEFAULT_TIMEOUT_MS = 120_000;

async function fijarTimeoutParam(valor: string) {
    await prisma.parametroSistema.upsert({
        where: { clave: CLAVE_TIMEOUT },
        update: { valor },
        create: { clave: CLAVE_TIMEOUT, valor, tipo: "INTEGER", categoria: "SYSTEM" },
    });
}

const ollamaOkResponse = {
    model: "test:1b",
    created_at: new Date().toISOString(),
    response: "{}", // JSON válido: llamarOllamaStructured lo parsea
    done: true,
    prompt_eval_count: 3,
    eval_count: 2,
};

describe("getOllamaTimeoutMs", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("devuelve el valor del parámetro cuando es un entero positivo", async () => {
        await fijarTimeoutParam("45000");
        expect(await getOllamaTimeoutMs()).toBe(45000);

        await fijarTimeoutParam("60000");
        expect(await getOllamaTimeoutMs()).toBe(60000);
    });

    it("cae al default 120000 ms cuando el parámetro no existe", async () => {
        expect(await getOllamaTimeoutMs()).toBe(DEFAULT_TIMEOUT_MS);
    });

    it("cae al default cuando el valor es inválido (no numérico, cero, negativo, vacío)", async () => {
        for (const invalido of ["abc", "0", "-5000", ""]) {
            await fijarTimeoutParam(invalido);
            expect(await getOllamaTimeoutMs()).toBe(DEFAULT_TIMEOUT_MS);
        }
    });
});

describe("timeout aplicado a los fetch de /api/generate", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("cambiar el parámetro cambia el timeout pasado a AbortSignal.timeout", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ({
            ok: true,
            json: async () => ollamaOkResponse,
        })));
        const spyTimeout = vi.spyOn(AbortSignal, "timeout");

        await fijarTimeoutParam("45000");
        await llamarOllamaStructured("test:1b", "hola", { type: "object" });
        expect(spyTimeout).toHaveBeenCalledWith(45000);

        await fijarTimeoutParam("90000");
        await llamarOllamaStructured("test:1b", "hola", { type: "object" });
        expect(spyTimeout).toHaveBeenCalledWith(90000);
    });

    it("sin parámetro aplica el default de 120000 ms", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ({
            ok: true,
            json: async () => ollamaOkResponse,
        })));
        const spyTimeout = vi.spyOn(AbortSignal, "timeout");

        await llamarOllamaStructured("test:1b", "hola", { type: "object" });
        expect(spyTimeout).toHaveBeenCalledWith(DEFAULT_TIMEOUT_MS);
    });

    it("un fetch colgado aborta al vencer el timeout configurado", async () => {
        await fijarTimeoutParam("50");
        vi.stubGlobal("fetch", vi.fn(
            (_url: unknown, init?: { signal?: AbortSignal }) =>
                new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener("abort", () => {
                        reject(new DOMException("The operation timed out.", "TimeoutError"));
                    });
                })
        ));

        const inicio = Date.now();
        await expect(llamarOllamaStructured("test:1b", "hola", { type: "object" })).rejects.toThrow();
        // Abortó por el timeout de 50 ms, muy por debajo de una espera infinita.
        expect(Date.now() - inicio).toBeLessThan(5000);
    });
});
