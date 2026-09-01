/**
 * SPEC-339 (A-67) — el rebote que cierra la falla-abierta del camino.
 *
 * El caso feliz importa menos que el infeliz: si el re-sellado falla, esta ruta
 * PROMETE no producir un segundo rebote — termina en /login con la sesión
 * cerrada. Candado B de Calidad: probado acá, no supuesto.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
    verifyAuth: vi.fn(),
    buildSesionEstadoValue: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
    verifyAuth: mocks.verifyAuth,
}));

vi.mock("@/lib/routing/sesion-estado-emitter", () => ({
    buildSesionEstadoValue: mocks.buildSesionEstadoValue,
}));

import { firmarSesionEstado } from "@/lib/routing/vigencia-cookie";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { GET } from "./route";

const SECRETO = process.env.JWT_SECRET ?? "";

function req(destino?: string) {
    const url = new URL("http://localhost:5005/api/sesion/al-dia");
    if (destino !== undefined) url.searchParams.set("destino", destino);
    return new Request(url);
}

async function cookieFirmada(pasoCamino: "permiso" | "datos" | "hijos" | "plan" | null) {
    return firmarSesionEstado(
        { vigencia: "ACTIVA", requiereConsentimiento: false, debeCambiarPassword: false, pasoCamino },
        SECRETO,
    );
}

describe("GET /api/sesion/al-dia (SPEC-339)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.verifyAuth.mockResolvedValue({ id: "u1", rol: "PARENT" });
    });

    it("camino terminado → re-sella y devuelve al destino pedido", async () => {
        mocks.buildSesionEstadoValue.mockResolvedValue(await cookieFirmada(null));
        const res = await GET(req("/dashboard/padre/expedientes"));
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/dashboard/padre/expedientes");
        expect(res.headers.get("set-cookie")).toContain("sesion_estado=");
    });

    it("camino incompleto → re-sella y devuelve al paso pendiente, no al destino", async () => {
        mocks.buildSesionEstadoValue.mockResolvedValue(await cookieFirmada("hijos"));
        const res = await GET(req("/dashboard/padre/expedientes"));
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/camino/hijos");
    });

    it("un rol que no es padre → siempre al destino (el camino no lo toca)", async () => {
        mocks.verifyAuth.mockResolvedValue({ id: "a1", rol: "ADMIN" });
        // Cookie envenenada con un paso: el rol manda, no la cookie.
        mocks.buildSesionEstadoValue.mockResolvedValue(await cookieFirmada("permiso"));
        const res = await GET(req("/dashboard"));
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/dashboard");
    });

    // SPEC-342 (BUG3): defensa contra redirección abierta POR URL — incluye la
    // barra invertida que el chequeo de prefijos dejaba pasar.
    for (const malo of [
        "https://evil.example.com",
        "//evil.example.com",
        "evil",
        "/\\evil.example.com",
        "/\\/evil.example.com",
        "/\\@evil.example.com",
    ]) {
        it(`destino externo "${malo}" se descarta y cae al panel`, async () => {
            mocks.buildSesionEstadoValue.mockResolvedValue(await cookieFirmada(null));
            const res = await GET(req(malo));
            const url = new URL(res.headers.get("location") ?? "");
            // SPEC-342: la base ya no es request.url (candado 22v3) — lo que
            // importa: jamás el host malicioso, y el destino cae al panel.
            expect(url.hostname).not.toContain("evil");
            expect(url.pathname).toBe("/dashboard/padre");
        });
    }

    // ── Candado B · el camino infeliz, probado uno por uno ──────────────────
    it("re-sellado que LANZA → /login con la sesión cerrada, jamás un segundo rebote", async () => {
        mocks.buildSesionEstadoValue.mockRejectedValue(new Error("base caída"));
        const res = await GET(req("/dashboard/padre"));
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/login");
        // La sesión se cierra: sin cookie fresca, volver a una ruta gobernada
        // produciría el segundo rebote que esta ruta promete no dar.
        const setCookie = res.headers.get("set-cookie") ?? "";
        expect(setCookie).toContain("token=;");
    });

    it("cookie recién firmada ilegible (secreto roto) → /login, no un bucle", async () => {
        mocks.buildSesionEstadoValue.mockResolvedValue("basura-sin-firma");
        const res = await GET(req("/dashboard/padre"));
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/login");
    });

    it("sin sesión válida → /login", async () => {
        mocks.verifyAuth.mockRejectedValue(new AppError("No autenticado", ERROR_CODES.AUTH_INVALID, 401));
        const res = await GET(req("/dashboard/padre"));
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/login");
    });

    // SPEC-342 (candado 22v3): la base del redirect JAMÁS es request.url —
    // en Docker sale 0.0.0.0 y el navegador muere en un callejón.
    it("Docker: el Location usa x-forwarded-host, nunca el bind interno", async () => {
        mocks.buildSesionEstadoValue.mockResolvedValue(await cookieFirmada(null));
        const url = new URL("http://0.0.0.0:3000/api/sesion/al-dia");
        url.searchParams.set("destino", "/dashboard/padre");
        const res = await GET(
            new Request(url, { headers: { "x-forwarded-host": "pi.innovadataco.com", "x-forwarded-proto": "https" } })
        );
        const loc = new URL(res.headers.get("location") ?? "");
        expect(loc.origin).toBe("https://pi.innovadataco.com");
        expect(loc.pathname).toBe("/dashboard/padre");
    });

    it("Docker sin proxy: cae a PI_BASE_URL/dominio, jamás 0.0.0.0 — también en el camino infeliz", async () => {
        mocks.buildSesionEstadoValue.mockRejectedValue(new Error("base caída"));
        const res = await GET(new Request("http://0.0.0.0:3000/api/sesion/al-dia?destino=/dashboard/padre"));
        const loc = new URL(res.headers.get("location") ?? "");
        expect(loc.hostname).not.toBe("0.0.0.0");
        expect(loc.pathname).toBe("/login");
    });

    // Calidad: el sellado que LANZA (no solo el false mockeado).
    it("re-sellado que lanza una excepción → /login, sin segundo rebote", async () => {
        mocks.buildSesionEstadoValue.mockImplementation(() => {
            throw new Error("sin conexión");
        });
        const res = await GET(new Request("http://localhost:5005/api/sesion/al-dia?destino=/x"));
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/login");
    });
});
