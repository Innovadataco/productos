/**
 * SPEC-587 — GET /api/auth/oauth/google/callback (integración, BD real).
 *
 * fetch (token + userinfo) mockeado con vi.stubGlobal; Prisma es REAL (prohibido
 * mockearlo en integración, SPEC-174). Cubre: creación de cuenta PARENT (cookie
 * JWT + AuditLog + sesion_estado), login de existente (case-insensitive), rol
 * distinto manda, email_verified=false → 403 y state inválido/expirado → 400.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// `setSessionCookie` usa cookies() de next/headers, que fuera de un request de
// Next lanza — mismo mock que el test de /api/auth/registro/completar. Se
// captura `set` para verificar la cookie JWT sellada.
const cookiesSet = vi.fn();

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: () => undefined,
        set: cookiesSet,
    }),
}));

import { NextRequest } from "next/server";
import { GET } from "./route";
import { middleware } from "../../../../../../../middleware";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearParametrosReportes } from "@/lib/reporte-test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { firmarState, OAUTH_STATE_TTL_SEG } from "@/lib/auth-oauth";

interface UserinfoFixture {
    sub: string;
    email: string;
    email_verified: boolean;
    name?: string;
}

let userinfo: UserinfoFixture;
let tokenStatus: number;

const fetchMock = vi.fn(async (input: unknown): Promise<Response> => {
    const url = typeof input === "string" ? input : (input as Request).url;
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
        if (tokenStatus !== 200) return new Response("error del proveedor", { status: tokenStatus });
        return new Response(JSON.stringify({ access_token: "access-token-test", token_type: "Bearer" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }
    if (url.startsWith("https://www.googleapis.com/oauth2/v3/userinfo")) {
        return new Response(JSON.stringify(userinfo), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }
    return new Response("not found", { status: 404 });
});

function makeCallbackRequest(code: string, state: string | null, cookieState?: string): Request {
    const url = new URL("http://localhost:5005/api/auth/oauth/google/callback");
    url.searchParams.set("code", code);
    if (state !== null) url.searchParams.set("state", state);
    const headers: Record<string, string> = { "X-Forwarded-For": "203.0.113.50" };
    if (cookieState !== undefined) headers.cookie = `oauth_state=${encodeURIComponent(cookieState)}`;
    return new Request(url.toString(), { method: "GET", headers });
}

describe("GET /api/auth/oauth/google/callback (SPEC-587)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await resetRateLimitStore();
        vi.clearAllMocks();
        process.env.GOOGLE_CLIENT_ID ??= "test-client-id-google";
        process.env.GOOGLE_CLIENT_SECRET ??= "test-client-secret-google";
        userinfo = { sub: "google-sub-123", email: "nuevo.padre@example.com", email_verified: true, name: "Padre Nuevo" };
        tokenStatus = 200;
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("cuenta NUEVA: crea PARENT con email en minúsculas, JWT, sesion_estado y AuditLog; redirige a /consentimiento (Paso 1, SPEC-588)", async () => {
        userinfo = { sub: "google-sub-nuevo", email: "Nuevo.Padre@Example.COM", email_verified: true, name: "Padre Nuevo" };
        const state = firmarState();
        const res = await GET(makeCallbackRequest("code-123", state, state));

        expect(res.status).toBe(302);
        expect(res.headers.get("location")).toBe("http://localhost:5005/consentimiento");

        const creado = await prisma.usuario.findUnique({ where: { email: "nuevo.padre@example.com" } });
        expect(creado).not.toBeNull();
        expect(creado?.rol).toBe("PARENT");
        expect(creado?.estado).toBe("activo");
        expect(creado?.nombre).toBe("Padre Nuevo");
        // Sin clave local real: hash presente (schema lo exige) pero de un secreto aleatorio.
        expect(creado?.passwordHash).toMatch(/^\$2/);

        // Cookie JWT sellada vía cookies() con el sub del usuario.
        expect(cookiesSet).toHaveBeenCalled();
        const llamadoSesion = cookiesSet.mock.calls.find(([nombre]) => nombre === "token" || nombre === "__Host-token");
        expect(llamadoSesion).toBeDefined();
        const payload = await verifyToken(llamadoSesion?.[1] as string);
        expect(payload?.sub).toBe(creado?.id);

        // Cookie de estado de onboarding (directo al Paso 1, como /registro/completar).
        expect(res.headers.get("set-cookie") ?? "").toContain("sesion_estado=");

        // AuditLog de la mutación crítica, sin PII sensible en metadatos.
        const auditoria = await prisma.auditLog.findMany({ where: { accion: "USER_CREATE" } });
        expect(auditoria).toHaveLength(1);
        expect(auditoria[0].recursoId).toBe(creado?.id);
        const metadatos = auditoria[0].metadatos as { origen?: string; proveedorSub?: string; email?: string };
        expect(metadatos.origen).toBe("oauth_google");
        expect(metadatos.proveedorSub).toBe("google-sub-nuevo");
        expect(metadatos.email).toBeUndefined();
    });

    it("EXISTENTE: el email de Google con mayúsculas resuelve la cuenta (case-insensitive), registra sesión y redirige a su home", async () => {
        const existente = await crearUsuario("PARENT", "existente@example.com");
        userinfo = { sub: "google-sub-viejo", email: "Existente@Example.COM", email_verified: true, name: "Existente" };

        const state = firmarState();
        const res = await GET(makeCallbackRequest("code-456", state, state));

        expect(res.status).toBe(302);
        expect(res.headers.get("location")).toBe("http://localhost:5005/dashboard/padre");
        expect(await prisma.usuario.count()).toBe(1);

        const sesiones = await prisma.sesionLog.findMany({ where: { usuarioId: existente.id } });
        expect(sesiones).toHaveLength(1);
    });

    it("EXISTENTE con OTRO rol: el rol manda y redirige a su panel", async () => {
        await crearUsuario("OPERADOR", "operador@example.com");
        userinfo = { sub: "google-sub-op", email: "operador@example.com", email_verified: true };

        const state = firmarState();
        const res = await GET(makeCallbackRequest("code-789", state, state));

        expect(res.status).toBe(302);
        expect(res.headers.get("location")).toBe("http://localhost:5005/dashboard/admin");
        expect(await prisma.usuario.count()).toBe(1);
        // No es creación: sin AuditLog USER_CREATE.
        expect(await prisma.auditLog.count({ where: { accion: "USER_CREATE" } })).toBe(0);
    });

    // ── SPEC-608 (I-371) · CANDADO DE CONDUCTA: la cadena post-Google no pasa por /login ──────────
    // No basta con «responde 302»: se sigue el salto siguiente por el middleware real, que es donde
    // vivía el defecto. Con el estado sellado el destino —gateado o no— se sirve directo; sin sellar,
    // /dashboard/padre rebota a /api/sesion/al-dia y en prod el loop-cap terminaba en /login.
    function tokenSellado(): string {
        const call = cookiesSet.mock.calls.find(([n]) => n === "token" || n === "__Host-token");
        return call?.[1] as string;
    }
    async function saltoSiguiente(location: string, sesionEstado: string | undefined): Promise<string | null> {
        const cookie = [`token=${tokenSellado()}`, sesionEstado ? `sesion_estado=${sesionEstado}` : ""]
            .filter(Boolean)
            .join("; ");
        const res = await middleware(new NextRequest(location, { headers: { cookie } }));
        const loc = res.headers.get("location");
        return loc ? new URL(loc).pathname : null; // null = servido directo (next())
    }

    it("SPEC-608: cuenta EXISTENTE → sella sesion_estado y el destino gateado se sirve sin rebote ni /login", async () => {
        await crearUsuario("PARENT", "landing.existente@example.com");
        userinfo = { sub: "google-sub-land-ex", email: "landing.existente@example.com", email_verified: true };
        const state = firmarState();
        const res = await GET(makeCallbackRequest("code-land-ex", state, state));

        expect(res.headers.get("location")).toBe("http://localhost:5005/dashboard/padre");
        // El arreglo: el callback sella sesion_estado también para la cuenta existente.
        const sesionEstado = res.cookies.get("sesion_estado")?.value;
        expect(sesionEstado, "el callback debe sellar sesion_estado para no depender del rebote").toBeTruthy();

        // Se sigue la cadena: el middleware sobre /dashboard/padre con esas cookies NO rebota ni va a login.
        const destino = await saltoSiguiente("http://localhost:5005/dashboard/padre", sesionEstado);
        expect(destino, "la cadena no puede terminar en /login").not.toBe("/login");
        expect(destino, "con el estado sellado no puede depender del rebote a al-dia").not.toBe("/api/sesion/al-dia");
    });

    it("SPEC-608: cuenta NUEVA → /consentimiento se sirve directo (ruta de sesión), nunca /login", async () => {
        userinfo = { sub: "google-sub-land-new", email: "landing.nuevo@example.com", email_verified: true, name: "Nuevo" };
        const state = firmarState();
        const res = await GET(makeCallbackRequest("code-land-new", state, state));

        expect(res.headers.get("location")).toBe("http://localhost:5005/consentimiento");
        const sesionEstado = res.cookies.get("sesion_estado")?.value;
        const destino = await saltoSiguiente("http://localhost:5005/consentimiento", sesionEstado);
        expect(destino, "el nuevo no puede caer al login con la sesión ya creada").not.toBe("/login");
    });

    it("email_verified=false → 403 y no crea cuenta", async () => {
        userinfo = { sub: "google-sub-noverif", email: "sinverificar@example.com", email_verified: false };

        const state = firmarState();
        const res = await GET(makeCallbackRequest("code-x", state, state));

        expect(res.status).toBe(403);
        expect(await prisma.usuario.count()).toBe(0);
    });

    it("state que no coincide con la cookie → 400", async () => {
        const state = firmarState();
        const res = await GET(makeCallbackRequest("code-y", state, "otro-state"));
        expect(res.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("state alterado (firma inválida) → 400", async () => {
        const state = firmarState();
        const [datos, firma] = state.split(".");
        const corrupto = `${datos.startsWith("A") ? "B" : "A"}${datos.slice(1)}.${firma}`;
        const res = await GET(makeCallbackRequest("code-z", corrupto, corrupto));
        expect(res.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("state expirado → 400", async () => {
        const haceOnceMinutos = Date.now() - (OAUTH_STATE_TTL_SEG + 60) * 1000;
        const state = firmarState(haceOnceMinutos);
        const res = await GET(makeCallbackRequest("code-w", state, state));
        expect(res.status).toBe(400);
    });

    it("falta el code → 400", async () => {
        const state = firmarState();
        const url = new URL("http://localhost:5005/api/auth/oauth/google/callback");
        url.searchParams.set("state", state);
        const res = await GET(new Request(url.toString(), {
            method: "GET",
            headers: { cookie: `oauth_state=${encodeURIComponent(state)}` },
        }));
        expect(res.status).toBe(400);
    });

    it("Google devuelve error en el intercambio → 502 sin crear cuenta", async () => {
        tokenStatus = 400;
        const state = firmarState();
        const res = await GET(makeCallbackRequest("code-falla", state, state));
        expect(res.status).toBe(502);
        expect(await prisma.usuario.count()).toBe(0);
    });
});
