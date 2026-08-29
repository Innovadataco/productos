// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { SignJWT } from "jose";

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

const TEST_SECRET = "test-secret-local-bi-spec001";

beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
});

beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    upsert.mockReset();
    vectorizarMock.mockReset();
});

async function tokenParaRol(rol: string, sub = "u1"): Promise<string> {
    return new SignJWT({ role: rol, sub })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(new TextEncoder().encode(TEST_SECRET));
}

async function tokenFirmadoConSecretDistinto(): Promise<string> {
    return new SignJWT({ role: "ADMIN", sub: "atacante" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(new TextEncoder().encode("otro-secret-que-no-es-el-nuestro"));
}

function req(headers: Record<string, string>, body: unknown, url = "http://l/x") {
    return new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
    });
}

describe("POST /api/bi/aprobar · autenticación JWT (fix R-A-047)", () => {
    it("401 sin Authorization header ni cookie", async () => {
        const r = await APROBAR(req({}, { consultaLogId: "log-1" }));
        expect(r.status).toBe(401);
    });

    it("401 con solo x-user-rol=ADMIN (header spoof ya NO basta)", async () => {
        const r = await APROBAR(req({ "x-user-rol": "ADMIN", "x-user-id": "atacante" }, { consultaLogId: "log-1" }));
        expect(r.status).toBe(401);
    });

    it("401 con Bearer inválido", async () => {
        const r = await APROBAR(req({ authorization: "Bearer no-es-un-jwt" }, { consultaLogId: "log-1" }));
        expect(r.status).toBe(401);
    });

    it("401 con JWT firmado con secret distinto", async () => {
        const jwt = await tokenFirmadoConSecretDistinto();
        const r = await APROBAR(req({ authorization: `Bearer ${jwt}` }, { consultaLogId: "log-1" }));
        expect(r.status).toBe(401);
    });

    it("401 con JWT válido pero rol != ADMIN", async () => {
        const jwt = await tokenParaRol("SCHOOL_ADMIN");
        const r = await APROBAR(req({ authorization: `Bearer ${jwt}` }, { consultaLogId: "log-1" }));
        expect(r.status).toBe(401);
    });

    it("400 con JWT ADMIN pero sin consultaLogId", async () => {
        const jwt = await tokenParaRol("ADMIN");
        const r = await APROBAR(req({ authorization: `Bearer ${jwt}` }, {}));
        expect(r.status).toBe(400);
    });

    it("404 con id inexistente", async () => {
        findUnique.mockResolvedValueOnce(null);
        const jwt = await tokenParaRol("ADMIN");
        const r = await APROBAR(req({ authorization: `Bearer ${jwt}` }, { consultaLogId: "log-x" }));
        expect(r.status).toBe(404);
    });

    it("400 si consulta sin sqlGenerado", async () => {
        findUnique.mockResolvedValueOnce({ id: "log-1", preguntaNL: "q", sqlGenerado: null });
        const jwt = await tokenParaRol("ADMIN");
        const r = await APROBAR(req({ authorization: `Bearer ${jwt}` }, { consultaLogId: "log-1" }));
        expect(r.status).toBe(400);
    });

    it("503 si embedding no disponible", async () => {
        findUnique.mockResolvedValueOnce({ id: "log-1", preguntaNL: "q", sqlGenerado: "SELECT" });
        vectorizarMock.mockResolvedValueOnce(null);
        const jwt = await tokenParaRol("ADMIN");
        const r = await APROBAR(req({ authorization: `Bearer ${jwt}` }, { consultaLogId: "log-1" }));
        expect(r.status).toBe(503);
    });

    it("200 con JWT ADMIN + embedding OK · aprobadoPor viene del sub del JWT", async () => {
        findUnique.mockResolvedValueOnce({ id: "log-1", preguntaNL: "q", sqlGenerado: "SELECT 1" });
        vectorizarMock.mockResolvedValueOnce([0.1, 0.2]);
        upsert.mockResolvedValueOnce({ id: "c1" });
        const jwt = await tokenParaRol("ADMIN", "gerencia@innovadataco.com");
        const r = await APROBAR(req({ authorization: `Bearer ${jwt}` }, { consultaLogId: "log-1" }));
        expect(r.status).toBe(200);
        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                create: expect.objectContaining({ aprobadoPor: "gerencia@innovadataco.com" }),
            }),
        );
    });

    it("200 con JWT en cookie session", async () => {
        findUnique.mockResolvedValueOnce({ id: "log-1", preguntaNL: "q", sqlGenerado: "SELECT 1" });
        vectorizarMock.mockResolvedValueOnce([0.1, 0.2]);
        upsert.mockResolvedValueOnce({ id: "c1" });
        const jwt = await tokenParaRol("ADMIN");
        const r = await APROBAR(req({ cookie: `session=${jwt}; otra=x` }, { consultaLogId: "log-1" }));
        expect(r.status).toBe(200);
    });
});

describe("POST /api/bi/rechazar · autenticación JWT (fix R-A-047)", () => {
    it("401 sin JWT", async () => {
        const r = await RECHAZAR(req({}, { consultaLogId: "log-1" }));
        expect(r.status).toBe(401);
    });

    it("401 con solo header x-user-rol=ADMIN", async () => {
        const r = await RECHAZAR(req({ "x-user-rol": "ADMIN" }, { consultaLogId: "log-1" }));
        expect(r.status).toBe(401);
    });

    it("200 con JWT ADMIN + razón · guarda razón en error", async () => {
        findUnique.mockResolvedValueOnce({ id: "log-1" });
        update.mockResolvedValueOnce({});
        const jwt = await tokenParaRol("ADMIN");
        const r = await RECHAZAR(req({ authorization: `Bearer ${jwt}` }, { consultaLogId: "log-1", razon: "fecha incorrecta" }));
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
        const jwt = await tokenParaRol("ADMIN");
        await RECHAZAR(req({ authorization: `Bearer ${jwt}` }, { consultaLogId: "log-1" }));
        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ error: "sin_razon" }),
            }),
        );
    });
});
