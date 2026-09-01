/**
 * SPEC-339 (A-67) — POST /api/auth/registro/solicitar.
 *
 * Lo más importante acá es la anti-enumeración (SPEC-338): las respuestas para
 * correo nuevo y correo existente tienen que ser INDISTINGUIBLES byte a byte.
 * Y T080 (Calidad · R2-11): el correo caído no le cuesta el token al padre.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    enviarEnlaceRegistro: vi.fn(),
    enviarEmailCuentaExistente: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
    enviarEnlaceRegistro: mocks.enviarEnlaceRegistro,
    enviarEmailCuentaExistente: mocks.enviarEmailCuentaExistente,
}));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearParametrosReportes } from "@/lib/reporte-test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";

const rateLimitDisabled = process.env.DISABLE_RATE_LIMIT === "true";

function makeRequest(body: unknown, ip = "203.0.113.21"): Request {
    return new Request("http://localhost:5005/api/auth/registro/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify(body),
    });
}

describe("POST /api/auth/registro/solicitar (SPEC-339)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await resetRateLimitStore();
        vi.clearAllMocks();
        mocks.enviarEnlaceRegistro.mockResolvedValue(undefined);
        mocks.enviarEmailCuentaExistente.mockResolvedValue(undefined);
        if (rateLimitDisabled) process.env.DISABLE_RATE_LIMIT = "false";
    });

    afterEach(() => {
        if (rateLimitDisabled) process.env.DISABLE_RATE_LIMIT = "true";
    });

    it("correo nuevo → 202, crea el token (solo hash) y manda el enlace", async () => {
        const res = await POST(makeRequest({ email: "nuevo@example.com" }));
        expect(res.status).toBe(202);

        const tokens = await prisma.tokenRegistro.findMany({ where: { email: "nuevo@example.com" } });
        expect(tokens).toHaveLength(1);
        expect(tokens[0].usado).toBe(false);

        expect(mocks.enviarEnlaceRegistro).toHaveBeenCalledOnce();
        const [, tokenEnClaro] = mocks.enviarEnlaceRegistro.mock.calls[0];
        // El token en claro que viaja en el correo NUNCA se persiste.
        expect(tokens[0].tokenHash).not.toBe(tokenEnClaro);
        expect(tokens[0].tokenHash).not.toContain(tokenEnClaro);
    });

    it("ANTI-ENUMERACIÓN: correo nuevo y existente responden byte a byte igual", async () => {
        await crearUsuario("PARENT", "existente@example.com");

        const resNuevo = await POST(makeRequest({ email: "nuevo2@example.com" }, "203.0.113.22"));
        const resExistente = await POST(makeRequest({ email: "existente@example.com" }, "203.0.113.23"));

        expect(resNuevo.status).toBe(resExistente.status);
        expect(await resNuevo.text()).toBe(await resExistente.text());
    });

    it("correo existente → NO crea token; el aviso va al buzón (SPEC-338)", async () => {
        await crearUsuario("PARENT", "yaesta@example.com");
        const res = await POST(makeRequest({ email: "yaesta@example.com" }));
        expect(res.status).toBe(202);

        expect(await prisma.tokenRegistro.count({ where: { email: "yaesta@example.com" } })).toBe(0);
        expect(mocks.enviarEmailCuentaExistente).toHaveBeenCalledWith("yaesta@example.com");
        expect(mocks.enviarEnlaceRegistro).not.toHaveBeenCalled();
    });

    // T080 · Calidad R2-11.
    it("CORREO CAÍDO: el token queda creado y la respuesta no cambia — puede pedir de nuevo", async () => {
        mocks.enviarEnlaceRegistro.mockRejectedValue(new Error("proveedor caído"));
        const res = await POST(makeRequest({ email: "sinsuerte@example.com" }));

        expect(res.status).toBe(202);
        expect(await prisma.tokenRegistro.count({ where: { email: "sinsuerte@example.com" } })).toBe(1);

        // Y el reintento funciona: invalida el anterior y crea uno nuevo.
        mocks.enviarEnlaceRegistro.mockResolvedValue(undefined);
        const res2 = await POST(makeRequest({ email: "sinsuerte@example.com" }, "203.0.113.24"));
        expect(res2.status).toBe(202);
        const tokens = await prisma.tokenRegistro.findMany({
            where: { email: "sinsuerte@example.com" },
            orderBy: { creadoEn: "asc" },
        });
        expect(tokens).toHaveLength(2);
        expect(tokens[0].usado).toBe(true); // el viejo quedó invalidado
        expect(tokens[1].usado).toBe(false);
    });

    it("pedir de nuevo invalida el enlace anterior: un solo enlace vivo por correo", async () => {
        await POST(makeRequest({ email: "repite@example.com" }, "203.0.113.25"));
        await POST(makeRequest({ email: "repite@example.com" }, "203.0.113.26"));
        const vivos = await prisma.tokenRegistro.count({ where: { email: "repite@example.com", usado: false } });
        expect(vivos).toBe(1);
    });

    it("rechaza email inválido con 400", async () => {
        const res = await POST(makeRequest({ email: "no-es-email" }));
        expect(res.status).toBe(400);
    });

    it("NO toca el flujo del código de 6 dígitos: cero CodigoVerificacion creados", async () => {
        await POST(makeRequest({ email: "nuevo3@example.com" }));
        expect(await prisma.codigoVerificacion.count()).toBe(0);
    });
});
