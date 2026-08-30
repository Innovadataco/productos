import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const preguntarMock = vi.fn();
vi.mock("@/lib/bi/motor", () => ({ preguntar: (...args: unknown[]) => preguntarMock(...args) }));

// SPEC-035 · el endpoint ahora exige sesión; estos tests de comportamiento del
// motor usan una sesión válida (el 401 sin sesión se cubre en
// bi-operacion-guard.test.tsx).
vi.mock("@/lib/auth/sesion", () => ({
    sesionDeRequest: async () => ({ id: "u1", rol: "ADMIN" }),
}));

// eslint-disable-next-line import/first
import { POST } from "@/app/api/bi/preguntar/route";

beforeEach(() => preguntarMock.mockReset());

function req(body: unknown) {
    return new Request("http://localhost/api/bi/preguntar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
    });
}

describe("POST /api/bi/preguntar", () => {
    it("400 con body inválido (falta preguntaNL)", async () => {
        const res = await POST(req({ rol: "ADMIN" }));
        expect(res.status).toBe(400);
        const j = await res.json();
        expect(j.error).toBe("preguntaNL_requerida");
    });

    it("400 con json malformado", async () => {
        const res = await POST(req("no-es-json{"));
        expect(res.status).toBe(400);
    });

    it("200 con body válido", async () => {
        preguntarMock.mockResolvedValueOnce({
            estado: "OK",
            plantilla: "un-numero",
            llamadasLlm: 0,
            latenciaMs: 3,
            cacheHit: true,
        });
        const res = await POST(req({ preguntaNL: "cuántos", rol: "ADMIN" }));
        expect(res.status).toBe(200);
        const j = await res.json();
        expect(j.estado).toBe("OK");
    });

    it("500 con motor throw", async () => {
        preguntarMock.mockRejectedValueOnce(new Error("boom"));
        const res = await POST(req({ preguntaNL: "cuántos", rol: "ADMIN" }));
        expect(res.status).toBe(500);
    });

    it("rechaza rol inválido", async () => {
        const res = await POST(req({ preguntaNL: "cuántos", rol: "PIRATA" }));
        expect(res.status).toBe(400);
    });
});
