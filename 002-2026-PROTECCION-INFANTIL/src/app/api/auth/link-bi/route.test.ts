import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { jwtVerify } from "jose";
import { GET } from "./route";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { Usuario } from "@prisma/client";

// CI genera su propio .env.test (heredoc en ci.yml) sin BI_BASE_URL — la ruta
// solo la necesita en runtime (dentro de GET), así que fijarla acá hace el
// test independiente de qué .env.test cargue el runner.
process.env.BI_BASE_URL ||= "https://bi.innovadataco.com";

const USUARIO: Usuario = {
    id: "user-1",
    email: "padre@example.com",
    rol: "PARENT",
} as Usuario;

function req(returnTo?: string, headers?: Record<string, string>) {
    const qs = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
    return new Request(`http://localhost:5005/api/auth/link-bi${qs}`, headers ? { headers } : undefined);
}

async function decodificarToken(url: string) {
    const token = new URL(url).searchParams.get("token");
    if (!token) throw new Error("token ausente en la URL de redirect");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload;
}

describe("GET /api/auth/link-bi (SPEC-310)", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe("US1 · sesión PI válida", () => {
        it("returnTo válido → 302 a BI con JWT (sub/email/role/linkTo/exp)", async () => {
            vi.spyOn(auth, "verifyAuth").mockResolvedValue(USUARIO);

            const res = await GET(req("https://bi.innovadataco.com/dashboard"));

            expect(res.status).toBe(302);
            const location = res.headers.get("location")!;
            expect(location.startsWith("https://bi.innovadataco.com/api/auth/link?token=")).toBe(true);
            expect(location).toContain("returnTo=" + encodeURIComponent("https://bi.innovadataco.com/dashboard"));

            const payload = await decodificarToken(location);
            expect(payload.sub).toBe("user-1");
            expect(payload.email).toBe("padre@example.com");
            expect(payload.role).toBe("PARENT");
            expect(payload).not.toHaveProperty("roles");
            expect(payload.linkTo).toBe("bi");
            const ahora = Math.floor(Date.now() / 1000);
            expect(payload.exp).toBeGreaterThanOrEqual(ahora + 55);
            expect(payload.exp).toBeLessThanOrEqual(ahora + 65);
        });
    });

    describe("US2 · sin sesión PI válida", () => {
        it("sin cookie / verifyAuth rechaza → 302 a /login encadenando returnTo", async () => {
            vi.spyOn(auth, "verifyAuth").mockRejectedValue(
                new AppError("No autenticado", ERROR_CODES.AUTH_INVALID, 401)
            );

            const res = await GET(req("https://bi.innovadataco.com/reportes"));

            expect(res.status).toBe(302);
            const location = res.headers.get("location")!;
            const url = new URL(location);
            expect(url.pathname).toBe("/login");
            const returnToParam = url.searchParams.get("returnTo")!;
            expect(returnToParam).toContain("/api/auth/link-bi");
            expect(decodeURIComponent(returnToParam)).toContain("returnTo=https://bi.innovadataco.com/reportes");
        });

        it("token expirado (AppError AUTH_EXPIRED) → mismo camino a /login", async () => {
            vi.spyOn(auth, "verifyAuth").mockRejectedValue(
                new AppError("Token inválido o expirado", ERROR_CODES.AUTH_EXPIRED, 401)
            );

            const res = await GET(req());

            expect(res.status).toBe(302);
            expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
        });

        describe("SPEC-313 · host público real del redirect a /login (nunca 0.0.0.0)", () => {
            const envOriginal = process.env.PI_BASE_URL;

            beforeEach(() => {
                vi.spyOn(auth, "verifyAuth").mockRejectedValue(
                    new AppError("No autenticado", ERROR_CODES.AUTH_INVALID, 401)
                );
            });

            afterEach(() => {
                if (envOriginal === undefined) delete process.env.PI_BASE_URL;
                else process.env.PI_BASE_URL = envOriginal;
            });

            it("con x-forwarded-host → Location usa ese host", async () => {
                const res = await GET(
                    req(undefined, { "x-forwarded-host": "pi.innovadataco.com", "x-forwarded-proto": "https" })
                );

                const location = res.headers.get("location")!;
                expect(location.startsWith("https://pi.innovadataco.com/login")).toBe(true);
                expect(location).not.toContain("0.0.0.0");
            });

            it("sin header, con PI_BASE_URL env → Location usa esa env", async () => {
                process.env.PI_BASE_URL = "https://test.pi.example";

                const res = await GET(req());

                const location = res.headers.get("location")!;
                expect(location.startsWith("https://test.pi.example/login")).toBe(true);
                expect(location).not.toContain("0.0.0.0");
            });

            it("sin header ni env → Location usa el fallback hardcode", async () => {
                delete process.env.PI_BASE_URL;

                const res = await GET(req());

                const location = res.headers.get("location")!;
                expect(location.startsWith("https://pi.innovadataco.com/login")).toBe(true);
                expect(location).not.toContain("0.0.0.0");
            });

            it("assert defensivo: request.url con host interno NUNCA se filtra al Location", async () => {
                delete process.env.PI_BASE_URL;
                const reqInterno = new Request("http://0.0.0.0:3000/api/auth/link-bi");

                const res = await GET(reqInterno);

                expect(res.headers.get("location")).not.toContain("0.0.0.0");
            });
        });
    });

    describe("US3 · defensa open redirect", () => {
        beforeEach(() => {
            vi.spyOn(auth, "verifyAuth").mockResolvedValue(USUARIO);
        });

        it("host ajeno → redirect a BI usa el default, no el host recibido", async () => {
            const res = await GET(req("https://atacante.com/robar"));
            const location = res.headers.get("location")!;
            expect(location).toContain(encodeURIComponent("https://bi.innovadataco.com/dashboard"));
            expect(location).not.toContain("atacante.com");
        });

        it("esquema javascript: → redirect a BI usa el default", async () => {
            const res = await GET(req("javascript:alert(1)"));
            const location = res.headers.get("location")!;
            expect(location).toContain(encodeURIComponent("https://bi.innovadataco.com/dashboard"));
        });

        it("URL protocol-relative → redirect a BI usa el default", async () => {
            const res = await GET(req("//atacante.com"));
            const location = res.headers.get("location")!;
            expect(location).toContain(encodeURIComponent("https://bi.innovadataco.com/dashboard"));
            expect(location).not.toContain("atacante.com");
        });

        it("returnTo ausente → redirect a BI usa el default", async () => {
            const res = await GET(req());
            const location = res.headers.get("location")!;
            expect(location).toContain(encodeURIComponent("https://bi.innovadataco.com/dashboard"));
        });

        it("host de desarrollo permitido → se preserva tal cual", async () => {
            const res = await GET(req("http://localhost:3001/dashboard"));
            const location = res.headers.get("location")!;
            expect(location).toContain(encodeURIComponent("http://localhost:3001/dashboard"));
        });
    });
});
