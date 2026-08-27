/**
 * E-6 P4c: CSP con nonce solo para `/dashboard/**` en el middleware (src/proxy.ts).
 * El núcleo de autorización (src/lib/proxy.ts) no se toca; esto prueba la envoltura:
 * - /dashboard sin sesión (redirect del núcleo) lleva CSP con nonce + strict-dynamic (prod).
 * - /dashboard con sesión (paso libre) lleva CSP con nonce, distinto en cada request.
 * - Una ruta pública (/) no recibe CSP del middleware (conserva el estático de config).
 * - En desarrollo, /dashboard conserva unsafe-eval (HMR) y NO lleva nonce.
 */
import { describe, it, expect, afterEach } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
// SPEC-287 (002-PI-187): el CSP con nonce se fusionó en middleware.ts en la raíz;
// src/proxy.ts fue eliminado. El test sigue verificando el mismo contrato.
import { middleware as proxy } from "../middleware";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "test-secret-key-32-chars-long-12345678");

async function tokenPadre(): Promise<string> {
    return new SignJWT({ sub: "usuario-e2e", rol: "PARENT" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(SECRET);
}

function envProduccion() {
    const original = process.env.NODE_ENV;
    (process.env as { NODE_ENV: string }).NODE_ENV = "production";
    return () => {
        (process.env as { NODE_ENV: string }).NODE_ENV = original ?? "test";
    };
}

describe("E-6 P4c · CSP con nonce solo en /dashboard/**", () => {
    let restaurarEnv: () => void = () => undefined;

    afterEach(() => {
        restaurarEnv();
    });

    it("/dashboard sin sesión: el redirect lleva CSP con nonce + strict-dynamic (prod)", async () => {
        restaurarEnv = envProduccion();
        const res = await proxy(new NextRequest("http://localhost:5005/dashboard"));

        const csp = res.headers.get("Content-Security-Policy") ?? "";
        expect(csp).toContain("script-src 'self' 'nonce-");
        expect(csp).toContain("'strict-dynamic'");
        expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
        expect(csp).not.toContain("unsafe-eval");
    });

    it("/dashboard con sesión (paso libre): CSP con nonce, distinto por request", async () => {
        restaurarEnv = envProduccion();
        const token = await tokenPadre();
        const req = (n: number) =>
            new NextRequest("http://localhost:5005/dashboard", {
                headers: { cookie: `token=${token}` },
            });

        const res1 = await proxy(req(1));
        const res2 = await proxy(req(2));
        const csp1 = res1.headers.get("Content-Security-Policy") ?? "";
        const csp2 = res2.headers.get("Content-Security-Policy") ?? "";

        expect(csp1).toContain("script-src 'self' 'nonce-");
        expect(csp1).toContain("'strict-dynamic'");
        expect(csp2).toContain("script-src 'self' 'nonce-");
        expect(csp1, "el nonce cambia por request").not.toBe(csp2);
    });

    it("ruta pública (/): el middleware no toca el CSP (sin nonce)", async () => {
        restaurarEnv = envProduccion();
        const res = await proxy(new NextRequest("http://localhost:5005/"));

        const csp = res.headers.get("Content-Security-Policy");
        expect(csp, "las públicas conservan el CSP estático de next.config (el middleware no añade el suyo)").toBeNull();
    });

    it("en desarrollo, /dashboard conserva unsafe-eval (HMR) y NO lleva nonce", async () => {
        restaurarEnv = envProduccion();
        (process.env as { NODE_ENV: string }).NODE_ENV = "development";

        const res = await proxy(new NextRequest("http://localhost:5005/dashboard"));
        const csp = res.headers.get("Content-Security-Policy") ?? "";

        expect(csp).toContain("unsafe-eval");
        expect(csp).not.toContain("nonce-");
    });
});
