import { describe, it, expect, beforeEach } from "vitest";
import { verificarWorkerSecret } from "./worker-auth";
import { ERROR_CODES } from "./errors";

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
