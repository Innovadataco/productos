import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const update = vi.fn();
const upsert = vi.fn();
const execRaw = vi.fn(async () => 1);

vi.mock("@/lib/prisma", () => ({
    prisma: {
        bIConsultaLog: {
            findUnique: (a: unknown) => findUnique(a),
            update: (a: unknown) => update(a),
        },
        bICacheSemantico: { upsert: (a: unknown) => upsert(a) },
        $executeRawUnsafe: (...a: unknown[]) => execRaw(...(a as [])),
    },
}));

const vectorizarMock = vi.fn();
vi.mock("@/lib/bi/embedding", () => ({
    vectorizar: (...a: unknown[]) => vectorizarMock(...a),
}));

/* eslint-disable import/first */
import { POST as APROBAR } from "@/app/api/bi/aprobar/route";
import { POST as RECHAZAR } from "@/app/api/bi/rechazar/route";
/* eslint-enable */

beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    upsert.mockReset();
    vectorizarMock.mockReset();
});

function req(headers: Record<string, string>, body: unknown, url = "http://l/x") {
    return new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
    });
}

const H_ADMIN = { "x-user-id": "u1", "x-user-rol": "ADMIN" };
const H_NO_ADMIN = { "x-user-id": "u2", "x-user-rol": "SCHOOL_ADMIN" };

describe("POST /api/bi/aprobar", () => {
    it("401 sin rol ADMIN", async () => {
        const r = await APROBAR(req(H_NO_ADMIN, { consultaLogId: "log-1" }));
        expect(r.status).toBe(401);
    });

    it("400 sin consultaLogId", async () => {
        const r = await APROBAR(req(H_ADMIN, {}));
        expect(r.status).toBe(400);
    });

    it("404 con id inexistente", async () => {
        findUnique.mockResolvedValueOnce(null);
        const r = await APROBAR(req(H_ADMIN, { consultaLogId: "log-x" }));
        expect(r.status).toBe(404);
    });

    it("400 si consulta sin sqlGenerado", async () => {
        findUnique.mockResolvedValueOnce({ id: "log-1", preguntaNL: "q", sqlGenerado: null });
        const r = await APROBAR(req(H_ADMIN, { consultaLogId: "log-1" }));
        expect(r.status).toBe(400);
    });

    it("503 si embedding no disponible", async () => {
        findUnique.mockResolvedValueOnce({ id: "log-1", preguntaNL: "q", sqlGenerado: "SELECT" });
        vectorizarMock.mockResolvedValueOnce(null);
        const r = await APROBAR(req(H_ADMIN, { consultaLogId: "log-1" }));
        expect(r.status).toBe(503);
    });

    it("200 con id + embedding OK", async () => {
        findUnique.mockResolvedValueOnce({ id: "log-1", preguntaNL: "q", sqlGenerado: "SELECT 1" });
        vectorizarMock.mockResolvedValueOnce([0.1, 0.2]);
        upsert.mockResolvedValueOnce({ id: "c1" });
        const r = await APROBAR(req(H_ADMIN, { consultaLogId: "log-1" }));
        expect(r.status).toBe(200);
        const j = await r.json();
        expect(j.ok).toBe(true);
    });
});

describe("POST /api/bi/rechazar", () => {
    it("401 sin rol ADMIN", async () => {
        const r = await RECHAZAR(req(H_NO_ADMIN, { consultaLogId: "log-1" }));
        expect(r.status).toBe(401);
    });

    it("200 con id + razón", async () => {
        findUnique.mockResolvedValueOnce({ id: "log-1" });
        update.mockResolvedValueOnce({});
        const r = await RECHAZAR(req(H_ADMIN, { consultaLogId: "log-1", razon: "fecha incorrecta" }));
        expect(r.status).toBe(200);
        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ estado: "REVISION_HUMANA", error: "fecha incorrecta" }),
            }),
        );
    });

    it("200 sin razón usa 'sin_razon'", async () => {
        findUnique.mockResolvedValueOnce({ id: "log-1" });
        update.mockResolvedValueOnce({});
        await RECHAZAR(req(H_ADMIN, { consultaLogId: "log-1" }));
        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ error: "sin_razon" }),
            }),
        );
    });
});
