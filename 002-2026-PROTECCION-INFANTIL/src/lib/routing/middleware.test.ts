/**
 * SPEC-287 (002-PI-187 · cierra I-141) — Journey: NO hay bucle de vigencia.
 *
 * Ejercita el middleware directamente con NextRequest para reproducir el
 * escenario exacto que rompió I-141:
 *   (a) PARENT sin vigencia entrando a /dashboard/padre/suscripcion → NextResponse.next() (cero redirect).
 *   (b) SCHOOL_ADMIN sin vigencia entrando a /dashboard/colegio/suscripcion → next() (cero redirect).
 *   (c) PARENT sin vigencia entrando a /dashboard/padre → un solo redirect a /dashboard/padre/suscripcion.
 *
 * Corre en el pool de journeys de Vitest (single-thread, BD real). El middleware
 * lee la cookie firmada `sesion_estado`; el test la genera con el helper real.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../../middleware";
import { firmarSesionEstado, NOMBRE_COOKIE } from "@/lib/routing/vigencia-cookie";
import { SignJWT } from "jose";

const JWT_SECRET_TEST =
    process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32
        ? process.env.JWT_SECRET
        : "test-secret-32-chars-loop-vigencia!!";

beforeAll(() => {
    // Asegura que el middleware use el mismo secret que el test.
    process.env.JWT_SECRET = JWT_SECRET_TEST;
});

async function jwtParaRol(rol: string, sub = "usuario-loop"): Promise<string> {
    return new SignJWT({ sub, rol })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h")
        .sign(new TextEncoder().encode(JWT_SECRET_TEST));
}

async function requestConSesionSinVigencia(pathname: string, rol: string): Promise<NextRequest> {
    const token = await jwtParaRol(rol);
    const sesionEstadoCookie = await firmarSesionEstado(
        { vigencia: "SIN_SUSCRIPCION", requiereConsentimiento: false, debeCambiarPassword: false },
        JWT_SECRET_TEST,
    );
    return new NextRequest(`http://localhost:5005${pathname}`, {
        headers: {
            cookie: `token=${token}; ${NOMBRE_COOKIE}=${sesionEstadoCookie}`,
        },
    });
}

describe("SPEC-287 · loop de vigencia (I-141) NO se reproduce", () => {
    it("(a) PARENT sin vigencia en /dashboard/padre/suscripcion → next() (cero redirect)", async () => {
        const req = await requestConSesionSinVigencia("/dashboard/padre/suscripcion", "PARENT");
        const res = await middleware(req);
        // El middleware debe dejar pasar (la ruta está en vigencia.PARENT.exentas).
        expect(res.status, "NO debe ser 3xx redirect").not.toBe(307);
        expect(res.status, "NO debe ser 3xx redirect").not.toBe(302);
        // NextResponse.next() lleva el header interno x-middleware-next.
        expect(res.headers.get("x-middleware-next"), "middleware debe dejar pasar").toBe("1");
    });

    it("(b) SCHOOL_ADMIN sin vigencia en /dashboard/colegio/suscripcion → next() (cero redirect)", async () => {
        const req = await requestConSesionSinVigencia("/dashboard/colegio/suscripcion", "SCHOOL_ADMIN");
        const res = await middleware(req);
        expect(res.status).not.toBe(307);
        expect(res.status).not.toBe(302);
        expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("(c) PARENT sin vigencia en /dashboard/padre → UN redirect a /dashboard/padre/suscripcion", async () => {
        const req = await requestConSesionSinVigencia("/dashboard/padre", "PARENT");
        const res = await middleware(req);
        expect(res.status).toBe(307);
        const location = res.headers.get("location") ?? "";
        expect(new URL(location).pathname).toBe("/dashboard/padre/suscripcion");
    });

    it("(d) COMITE_CONVIVENCIA sin vigencia en /dashboard/colegio → redirect a colegio/suscripcion (una vez)", async () => {
        const req = await requestConSesionSinVigencia("/dashboard/colegio", "COMITE_CONVIVENCIA");
        const res = await middleware(req);
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/dashboard/colegio/suscripcion");
    });

    it("(e) PARENT con vigencia ACTIVA en /dashboard/padre → next() (comportamiento transparente)", async () => {
        const token = await jwtParaRol("PARENT");
        const cookie = await firmarSesionEstado(
            { vigencia: "ACTIVA", requiereConsentimiento: false, debeCambiarPassword: false },
            JWT_SECRET_TEST,
        );
        const req = new NextRequest("http://localhost:5005/dashboard/padre", {
            headers: { cookie: `token=${token}; ${NOMBRE_COOKIE}=${cookie}` },
        });
        const res = await middleware(req);
        expect(res.status).not.toBe(307);
        expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("(f) usuario con debeCambiarPassword=true en /dashboard/padre → redirect a /cambiar-password", async () => {
        const token = await jwtParaRol("PARENT");
        const cookie = await firmarSesionEstado(
            { vigencia: "ACTIVA", requiereConsentimiento: false, debeCambiarPassword: true },
            JWT_SECRET_TEST,
        );
        const req = new NextRequest("http://localhost:5005/dashboard/padre", {
            headers: { cookie: `token=${token}; ${NOMBRE_COOKIE}=${cookie}` },
        });
        const res = await middleware(req);
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/cambiar-password");
    });

    it("(g) usuario con requiereConsentimiento=true en /dashboard/padre → redirect a /consentimiento", async () => {
        const token = await jwtParaRol("PARENT");
        const cookie = await firmarSesionEstado(
            { vigencia: "ACTIVA", requiereConsentimiento: true, debeCambiarPassword: false },
            JWT_SECRET_TEST,
        );
        const req = new NextRequest("http://localhost:5005/dashboard/padre", {
            headers: { cookie: `token=${token}; ${NOMBRE_COOKIE}=${cookie}` },
        });
        const res = await middleware(req);
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/consentimiento");
    });

    it("(h) anónimo en /dashboard/padre → redirect a /login", async () => {
        const req = new NextRequest("http://localhost:5005/dashboard/padre");
        const res = await middleware(req);
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/login");
    });

    it("(i) ruta pública / con o sin sesión → next()", async () => {
        const req = new NextRequest("http://localhost:5005/");
        const res = await middleware(req);
        expect(res.status).not.toBe(307);
        expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("(j) ruta pública /reportar sin sesión → next()", async () => {
        const req = new NextRequest("http://localhost:5005/reportar");
        const res = await middleware(req);
        expect(res.status).not.toBe(307);
        expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    // SC-06 · SPEC-318: cookie sesion_estado ausente → fail-open (no expulsa)
    it("(k) SC-06 autenticado sin cookie sesion_estado → next() (guards inactivos, no expulsa)", async () => {
        const token = await jwtParaRol("PARENT");
        // Sin NOMBRE_COOKIE en el header — simula usuario autenticado pero sin cookie de estado
        const req = new NextRequest("http://localhost:5005/dashboard/padre", {
            headers: { cookie: `token=${token}` },
        });
        const res = await middleware(req);
        // El middleware NO debe redirigir ni expulsar: sin cookie, los guards no corren (fail-open)
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
        // No debe redirigir a /consentimiento ni a /cambiar-password
        const location = res.headers.get("location") ?? "";
        expect(location).not.toContain("/consentimiento");
        expect(location).not.toContain("/cambiar-password");
    });
});
