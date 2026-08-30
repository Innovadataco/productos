// @vitest-environment node
// jose 6 (webapi) rechaza el Uint8Array del jsdom polyfill; env node usa el
// Uint8Array nativo y el import de jose lo reconoce.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";

const SECRET = "test-secret-solo-para-vitest-32chars-abc12345";
const BI_BASE = "http://localhost:3001";

let origSecret: string | undefined;
let origBi: string | undefined;

beforeEach(() => {
    origSecret = process.env.JWT_SECRET;
    origBi = process.env.BI_BASE_URL;
    process.env.JWT_SECRET = SECRET;
    process.env.BI_BASE_URL = BI_BASE;
});
afterEach(() => {
    if (origSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = origSecret;
    if (origBi === undefined) delete process.env.BI_BASE_URL;
    else process.env.BI_BASE_URL = origBi;
});

async function signEphemeral(
    payload: Record<string, unknown>,
    ttl = "60s",
): Promise<string> {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(ttl)
        .sign(new TextEncoder().encode(SECRET));
}

async function loadRoute() {
    return await import("@/app/api/auth/link/route");
}

function makeReq(
    params: Record<string, string>,
    headers?: Record<string, string>,
): Request {
    const qs = new URLSearchParams(params).toString();
    return new Request(`${BI_BASE}/api/auth/link?${qs}`, { headers });
}

function locHeader(res: Response): string {
    return res.headers.get("location") ?? "";
}

function setCookieHeader(res: Response): string {
    return res.headers.get("set-cookie") ?? "";
}

describe("GET /api/auth/link", () => {
    it("sin token → 302 a /login-error?reason=invalid_token", async () => {
        const { GET } = await loadRoute();
        const res = await GET(makeReq({}));
        expect(res.status).toBe(302);
        expect(locHeader(res)).toContain("/login-error?reason=invalid_token");
    });

    it("token con firma inválida → invalid_token", async () => {
        const { GET } = await loadRoute();
        const res = await GET(makeReq({ token: "no-es-un-jwt-valido.foo.bar" }));
        expect(res.status).toBe(302);
        expect(locHeader(res)).toContain("reason=invalid_token");
    });

    it("token válido pero linkTo != 'bi' → bad_claim", async () => {
        const jwt = await signEphemeral({
            sub: "u1",
            role: "ADMIN",
            linkTo: "otra-app",
        });
        const { GET } = await loadRoute();
        const res = await GET(makeReq({ token: jwt }));
        expect(res.status).toBe(302);
        expect(locHeader(res)).toContain("reason=bad_claim");
    });

    it("token válido sin sub → bad_claim", async () => {
        const jwt = await signEphemeral({ role: "ADMIN", linkTo: "bi" });
        const { GET } = await loadRoute();
        const res = await GET(makeReq({ token: jwt }));
        expect(res.status).toBe(302);
        expect(locHeader(res)).toContain("reason=bad_claim");
    });

    it("token válido sin role → bad_claim", async () => {
        const jwt = await signEphemeral({ sub: "u1", linkTo: "bi" });
        const { GET } = await loadRoute();
        const res = await GET(makeReq({ token: jwt }));
        expect(res.status).toBe(302);
        expect(locHeader(res)).toContain("reason=bad_claim");
    });

    it("flujo OK → 302 a /dashboard + cookie session con atributos correctos", async () => {
        const jwt = await signEphemeral({
            sub: "u42",
            role: "ADMIN",
            email: "admin@x",
            linkTo: "bi",
        });
        const { GET } = await loadRoute();
        const res = await GET(makeReq({ token: jwt }));
        expect(res.status).toBe(302);
        expect(locHeader(res)).toBe(`${BI_BASE}/dashboard`);
        const sc = setCookieHeader(res);
        expect(sc).toContain("session=");
        expect(sc.toLowerCase()).toContain("httponly");
        expect(sc.toLowerCase()).toContain("samesite=lax");
        expect(sc.toLowerCase()).toContain("path=/");
        expect(sc).toContain("Max-Age=86400");
        // La cookie session debe verificar con el mismo secreto y no incluir
        // linkTo (candado adicional del D-029.1).
        const raw = sc.split(";")[0]?.split("=").slice(1).join("=") ?? "";
        const { payload } = await jwtVerify(
            raw,
            new TextEncoder().encode(SECRET),
        );
        expect(payload.sub).toBe("u42");
        expect(payload.role).toBe("ADMIN");
        expect(payload.email).toBe("admin@x");
        expect(payload.linkTo).toBeUndefined();
        expect(payload.exp).toBeGreaterThan(
            Math.floor(Date.now() / 1000) + 60 * 60 * 23,
        );
    });

    it("returnTo=/dashboard/algo → 302 a /dashboard/algo", async () => {
        const jwt = await signEphemeral({
            sub: "u1",
            role: "ADMIN",
            linkTo: "bi",
        });
        const { GET } = await loadRoute();
        const res = await GET(
            makeReq({ token: jwt, returnTo: "/dashboard/algo" }),
        );
        expect(res.status).toBe(302);
        expect(locHeader(res)).toBe(`${BI_BASE}/dashboard/algo`);
    });

    it("returnTo=https://evil.com/x → ignorado silenciosamente → /dashboard", async () => {
        const jwt = await signEphemeral({
            sub: "u1",
            role: "ADMIN",
            linkTo: "bi",
        });
        const { GET } = await loadRoute();
        const res = await GET(
            makeReq({ token: jwt, returnTo: "https://evil.com/x" }),
        );
        expect(res.status).toBe(302);
        expect(locHeader(res)).toBe(`${BI_BASE}/dashboard`);
    });

    it("returnTo=/etc/passwd (fuera whitelist) → ignorado → /dashboard", async () => {
        const jwt = await signEphemeral({
            sub: "u1",
            role: "ADMIN",
            linkTo: "bi",
        });
        const { GET } = await loadRoute();
        const res = await GET(makeReq({ token: jwt, returnTo: "/etc/passwd" }));
        expect(res.status).toBe(302);
        expect(locHeader(res)).toBe(`${BI_BASE}/dashboard`);
    });

    it("SPEC-030 · x-forwarded-host en el request → redirect usa ese host público (no el env)", async () => {
        const jwt = await signEphemeral({
            sub: "u1",
            role: "ADMIN",
            linkTo: "bi",
        });
        const { GET } = await loadRoute();
        const res = await GET(
            makeReq(
                { token: jwt, returnTo: "/dashboard" },
                {
                    "x-forwarded-host": "bi.innovadataco.com",
                    "x-forwarded-proto": "https",
                },
            ),
        );
        expect(res.status).toBe(302);
        expect(locHeader(res)).toBe("https://bi.innovadataco.com/dashboard");
    });
});
