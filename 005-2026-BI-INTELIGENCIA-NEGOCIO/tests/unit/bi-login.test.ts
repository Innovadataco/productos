// @vitest-environment node
// jose 6 (webapi) rechaza el Uint8Array del polyfill de jsdom; env node usa el
// Uint8Array nativo que jose reconoce (mismo motivo que el test de link).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { jwtVerify } from "jose";

// SPEC-036 · login/logout propios de BI. Sin mocks del handler: ejercemos la
// ruta real (lee env EN REQUEST TIME, firma/borra la cookie `session`).

const BASE = "https://bi.innovadataco.com";
const SECRET = "secreto-de-prueba-fuerte-32-chars-min-ok";

function reqLogin(body: Record<string, string>): Request {
    return new Request(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

function loc(res: Response): string {
    return res.headers.get("location") ?? "";
}
function setCookie(res: Response): string {
    return res.headers.get("set-cookie") ?? "";
}

beforeEach(() => {
    vi.stubEnv("BI_BASE_URL", BASE);
    vi.stubEnv("JWT_SECRET", SECRET);
    vi.stubEnv("BI_AUTH_USER", "jelkin");
    vi.stubEnv("BI_AUTH_PASSWORD", "clave-buena");
    vi.stubEnv("NODE_ENV", "production");
});

describe("POST /api/auth/login (SPEC-036)", () => {
    it("credenciales correctas → 302 al returnTo + cookie session firmada", async () => {
        const { POST } = await import("@/app/api/auth/login/route");
        const res = await POST(
            reqLogin({ usuario: "jelkin", password: "clave-buena", returnTo: "/operacion" }),
        );
        expect(res.status).toBe(302);
        expect(loc(res)).toBe(`${BASE}/operacion`);
        const cookie = setCookie(res);
        expect(cookie).toMatch(/session=/);
        expect(cookie).toMatch(/HttpOnly/i);
        expect(cookie).toMatch(/Secure/i); // NODE_ENV=production
        // La cookie es un JWT verificable con el mismo shape que lee sesionDeRequest.
        const token = cookie.match(/session=([^;]+)/)?.[1] ?? "";
        const { payload } = await jwtVerify(token, new TextEncoder().encode(SECRET));
        expect(payload.sub).toBe("jelkin");
        expect(payload.role).toBe("ADMIN");
    });

    it("password incorrecto → 302 a /login?error=1 SIN cookie", async () => {
        const { POST } = await import("@/app/api/auth/login/route");
        const res = await POST(reqLogin({ usuario: "jelkin", password: "mala", returnTo: "/chat" }));
        expect(res.status).toBe(302);
        expect(loc(res)).toContain("/login?error=1");
        expect(setCookie(res)).not.toMatch(/session=[^;]/); // ninguna cookie de sesión
    });

    it("usuario incorrecto → mismo error genérico (no filtra cuál falló)", async () => {
        const { POST } = await import("@/app/api/auth/login/route");
        const res = await POST(reqLogin({ usuario: "otro", password: "clave-buena" }));
        expect(loc(res)).toContain("/login?error=1");
        expect(setCookie(res)).not.toMatch(/session=[^;]/);
    });

    it("returnTo malicioso se sanea a /dashboard en el error", async () => {
        const { POST } = await import("@/app/api/auth/login/route");
        const res = await POST(
            reqLogin({ usuario: "x", password: "y", returnTo: "https://evil.com/x" }),
        );
        expect(loc(res)).toContain("returnTo=%2Fdashboard");
    });

    it("env faltante (config incompleta) → error genérico, sin cookie", async () => {
        vi.stubEnv("BI_AUTH_PASSWORD", "");
        const { POST } = await import("@/app/api/auth/login/route");
        const res = await POST(reqLogin({ usuario: "jelkin", password: "clave-buena" }));
        expect(loc(res)).toContain("/login?error=1");
        expect(setCookie(res)).not.toMatch(/session=[^;]/);
    });

    // El corazón de la §6.4: la clave se lee EN REQUEST TIME. Cambiarla entre
    // dos POST (sin re-importar el módulo) hace que la VIEJA falle y la NUEVA
    // sirva — prueba unit del "editar .env + reiniciar, sin rebuild".
    it("clave leída en request time: cambiarla invalida la vieja y valida la nueva", async () => {
        const { POST } = await import("@/app/api/auth/login/route");

        const ok1 = await POST(reqLogin({ usuario: "jelkin", password: "clave-buena" }));
        expect(setCookie(ok1)).toMatch(/session=/);

        vi.stubEnv("BI_AUTH_PASSWORD", "clave-nueva");

        const vieja = await POST(reqLogin({ usuario: "jelkin", password: "clave-buena" }));
        expect(loc(vieja)).toContain("/login?error=1");
        expect(setCookie(vieja)).not.toMatch(/session=[^;]/);

        const nueva = await POST(reqLogin({ usuario: "jelkin", password: "clave-nueva" }));
        expect(setCookie(nueva)).toMatch(/session=/);
        expect(loc(nueva)).toBe(`${BASE}/dashboard`);
    });
});

describe("POST /api/auth/logout (SPEC-036)", () => {
    it("borra la cookie session (maxAge 0) y redirige a /login", async () => {
        const { POST } = await import("@/app/api/auth/logout/route");
        const res = await POST();
        expect(res.status).toBe(302);
        expect(loc(res)).toBe(`${BASE}/login`);
        const cookie = setCookie(res);
        expect(cookie).toMatch(/session=;?/);
        expect(cookie).toMatch(/Max-Age=0/i);
    });
});
