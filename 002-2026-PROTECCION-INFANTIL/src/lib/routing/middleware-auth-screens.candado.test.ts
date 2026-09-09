/**
 * SPEC-588 (I-3xx · vivo 06-09 con el OAuth) — CANDADO: las pantallas de
 * autenticación no se le ofrecen a una sesión válida.
 * SPEC-602 — generalización: la condición ya no es una terna hardcodeada en
 * el middleware sino `GUARDIAS_ACCESO.pantallasAuth` (fuente única, matching
 * exacto). NO es `GUARDIAS_ACCESO.sesion`: esa lista son rutas de
 * infraestructura de la sesión (logout, muros, refresh, /api/me) que deben
 * seguir alcanzables con JWT válido.
 *
 * Vivo: el dueño entró con «Continúa con Google», la sesión quedó creada
 * (USER_CREATE + JWT vivos) y aun así aterrizó en /login viendo el formulario
 * «Bienvenido / correo / contraseña». Cualquier rebote viejo, link compartido
 * o refresh de /login con sesión válida DEBE mandar al home del rol.
 *
 * Reglas del candado:
 *  - /login, /registro y /registro/inicio EXACTOS con JWT válido → 307 al home del rol.
 *  - ?mensaje=sesion queda EXENTO: es el terminal del loop-cap (SPEC-572);
 *    redirigirlo reabriría el bucle (home → middleware → rebote → /login → home).
 *  - Sin token: las rutas siguen públicas (next()), comportamiento intacto.
 *  - Rutas NO incluidas (/registro/crear-clave/<token>, /recuperar, /registro-colegio,
 *    /registro-profesional) siguen alcanzables CON sesión: soporte creando claves
 *    y usuarios cambiando la suya no se bloquean.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { middleware } from "../../../middleware";

const JWT_SECRET_TEST =
    process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32
        ? process.env.JWT_SECRET
        : "test-secret-32-chars-auth-screens!!";

beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET_TEST;
});

async function jwt(rol: string): Promise<string> {
    return new SignJWT({ sub: `usuario-${rol.toLowerCase()}`, rol })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h")
        .sign(new TextEncoder().encode(JWT_SECRET_TEST));
}

function req(pathname: string, cookie?: string): NextRequest {
    return new NextRequest(`http://localhost:5005${pathname}`, {
        headers: cookie ? { cookie } : {},
    });
}

describe("SPEC-588 · pantallas de auth con sesión válida → home del rol", () => {
    it("PARENT autenticado en /login → 307 a /dashboard/padre (no ve el formulario)", async () => {
        const res = await middleware(req("/login", `token=${await jwt("PARENT")}`));
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/dashboard/padre");
    });

    it("OPERADOR autenticado en /login → 307 a /dashboard/admin", async () => {
        const res = await middleware(req("/login", `token=${await jwt("OPERADOR")}`));
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/dashboard/admin");
    });

    it("PARENT autenticado en /registro/inicio → 307 a /dashboard/padre", async () => {
        const res = await middleware(req("/registro/inicio", `token=${await jwt("PARENT")}`));
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/dashboard/padre");
    });

    it("terminal ?mensaje=sesion (loop-cap SPEC-572) NO se redirige: pasa como público", async () => {
        const res = await middleware(req("/login?mensaje=sesion", `token=${await jwt("PARENT")}`));
        expect(res.headers.get("x-middleware-next"), "el terminal del loop-cap sigue siendo terminal").toBe("1");
    });

    it("sin token /login → next() (público intacto)", async () => {
        const res = await middleware(req("/login"));
        expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("sin token /registro → next() (público intacto)", async () => {
        const res = await middleware(req("/registro"));
        expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("/registro/crear-clave/<token> CON sesión → next() (flujo de creación de clave no se bloquea)", async () => {
        const res = await middleware(req("/registro/crear-clave/abc123", `token=${await jwt("PARENT")}`));
        expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("/recuperar CON sesión → next() (cambio de contraseña propio no se bloquea)", async () => {
        const res = await middleware(req("/recuperar", `token=${await jwt("PARENT")}`));
        expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("JWT inválido en /login → next() (se comporta como anónimo, el formulario es correcto)", async () => {
        const res = await middleware(req("/login", "token=jwt.basura.invalido"));
        expect(res.headers.get("x-middleware-next")).toBe("1");
    });
});

describe("SPEC-602 · generalización por GUARDIAS_ACCESO.pantallasAuth", () => {
    it.each([
        ["PARENT", "/dashboard/padre"],
        ["OPERADOR", "/dashboard/admin"],
        ["PROFESIONAL", "/dashboard/profesional"],
    ])("rol %s en /login → 307 a %s", async (rol, home) => {
        const res = await middleware(req("/login", `token=${await jwt(rol)}`));
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe(home);
    });

    it("PARENT autenticado en /registro → 307 a /dashboard/padre", async () => {
        const res = await middleware(req("/registro", `token=${await jwt("PARENT")}`));
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/dashboard/padre");
    });

    it("/registro-colegio CON sesión → next() (puerta de registro institucional no se bloquea)", async () => {
        const res = await middleware(req("/registro-colegio", `token=${await jwt("PARENT")}`));
        expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("/registro-profesional CON sesión → next() (puerta de registro profesional no se bloquea)", async () => {
        const res = await middleware(req("/registro-profesional", `token=${await jwt("PROFESIONAL")}`));
        expect(res.headers.get("x-middleware-next")).toBe("1");
    });
});
