import { describe, it, expect, beforeEach, vi } from "vitest";
import { verificarWorkerSecret } from "./worker-auth";
import { comparacionSecretoConstante } from "./timing-safe";
import { ERROR_CODES } from "./errors";

// SPEC-898: envolvemos el SEAM de primera parte (delegando al real) para ASERTAR que
// worker-auth USA la comparación constante en tiempo. Un `!==` inline no lo llamaría →
// control positivo: revertir el fix deja el test «delega en la comparación constante» rojo.
// (Los builtins de Node no son espiables en ESM; por eso el seam es un módulo propio.)
vi.mock("./timing-safe", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./timing-safe")>();
    return { ...actual, comparacionSecretoConstante: vi.fn(actual.comparacionSecretoConstante) };
});

const SECRET = "worker-secret-test";

function requestConSecret(secret?: string): Request {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (secret !== undefined) headers.set("x-worker-secret", secret);
    return new Request("http://localhost:5005/api/reportes/procesar", { method: "POST", headers });
}

describe("verificarWorkerSecret", () => {
    beforeEach(() => {
        process.env.WORKER_SECRET = SECRET;
    });

    it("rechaza (403) cuando falta el header x-worker-secret", async () => {
        const result = verificarWorkerSecret(requestConSecret());
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.response.status).toBe(403);
            const body = await result.response.json();
            expect(body.error.code).toBe(ERROR_CODES.FORBIDDEN);
        }
    });

    it("rechaza (403) un secreto incorrecto", () => {
        const result = verificarWorkerSecret(requestConSecret("secreto-incorrecto"));
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.response.status).toBe(403);
    });

    it("acepta el secreto correcto", () => {
        const result = verificarWorkerSecret(requestConSecret(SECRET));
        expect(result.ok).toBe(true);
    });
});

// SPEC-898 · CANDADO. El test funcional de arriba pasa con `!==` y con la comparación
// constante (mismo resultado observable), así que acá se aserta el MECANISMO: que worker-auth
// delega en el seam constante en tiempo.
describe("verificarWorkerSecret · comparación timing-safe (SPEC-898)", () => {
    beforeEach(() => {
        process.env.WORKER_SECRET = SECRET;
        vi.mocked(comparacionSecretoConstante).mockClear();
    });

    it("delega en la comparación CONSTANTE en tiempo (no ===/!==)", () => {
        const result = verificarWorkerSecret(requestConSecret(SECRET));
        expect(result.ok).toBe(true);
        expect(vi.mocked(comparacionSecretoConstante)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(comparacionSecretoConstante)).toHaveBeenCalledWith(SECRET, SECRET);
    });
});

// SPEC-898 · comportamiento del seam: el GUARD de longitud (que `timingSafeEqual` exige, pues
// LANZA con largos distintos) corta sin excepción, y la comparación es exacta.
describe("comparacionSecretoConstante (SPEC-898)", () => {
    it("true si coincide exactamente", () => {
        expect(comparacionSecretoConstante("abc123", "abc123")).toBe(true);
    });

    it("false si difiere con la MISMA longitud", () => {
        expect(comparacionSecretoConstante("abc123", "abc124")).toBe(false);
    });

    it("false y SIN lanzar si la longitud difiere (guard antes de timingSafeEqual)", () => {
        expect(() => comparacionSecretoConstante("abc", "abcd")).not.toThrow();
        expect(comparacionSecretoConstante("abc", "abcd")).toBe(false);
    });

    it("false si el valor recibido es null (header ausente)", () => {
        expect(comparacionSecretoConstante(null, "abc123")).toBe(false);
    });
});
