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
        { vigencia: "SIN_SUSCRIPCION", requiereConsentimiento: false, debeCambiarPassword: false, pasoCamino: null },
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
            { vigencia: "ACTIVA", requiereConsentimiento: false, debeCambiarPassword: false, pasoCamino: null },
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
            { vigencia: "ACTIVA", requiereConsentimiento: false, debeCambiarPassword: true, pasoCamino: null },
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
            { vigencia: "ACTIVA", requiereConsentimiento: true, debeCambiarPassword: false, pasoCamino: null },
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

// ────────────────────────────────────────────────────────────────────────────
// SPEC-339 (A-67) — El guardián del camino guiado del padre.
// ────────────────────────────────────────────────────────────────────────────
describe("SPEC-339 · guardián del camino", () => {
    async function reqPadreConPaso(
        pathname: string,
        pasoCamino: "permiso" | "datos" | "hijos" | "plan" | null,
        rol = "PARENT",
    ) {
        const token = await jwtParaRol(rol);
        const cookie = await firmarSesionEstado(
            { vigencia: "SIN_SUSCRIPCION", requiereConsentimiento: false, debeCambiarPassword: false, pasoCamino },
            JWT_SECRET_TEST,
        );
        return new NextRequest(`http://localhost:5005${pathname}`, {
            headers: { cookie: `token=${token}; ${NOMBRE_COOKIE}=${cookie}` },
        });
    }

    // Los cuatro estados: URL a mano → siempre al paso pendiente.
    const CASOS: Array<["permiso" | "datos" | "hijos" | "plan", string]> = [
        ["permiso", "/consentimiento"], // Paso 1 reusa la pantalla existente
        ["datos", "/camino/datos"],
        ["hijos", "/camino/hijos"],
        ["plan", "/camino/plan"],
    ];
    for (const [paso, destino] of CASOS) {
        it(`padre en paso "${paso}" escribe /dashboard/padre a mano → redirect a ${destino}`, async () => {
            const res = await middleware(await reqPadreConPaso("/dashboard/padre", paso));
            expect(res.status).toBe(307);
            expect(new URL(res.headers.get("location") ?? "").pathname).toBe(destino);
        });
    }

    it("padre con camino terminado (null) → next(), sin redirect del camino", async () => {
        const token = await jwtParaRol("PARENT");
        const cookie = await firmarSesionEstado(
            { vigencia: "ACTIVA", requiereConsentimiento: false, debeCambiarPassword: false, pasoCamino: null },
            JWT_SECRET_TEST,
        );
        const req = new NextRequest("http://localhost:5005/dashboard/padre", {
            headers: { cookie: `token=${token}; ${NOMBRE_COOKIE}=${cookie}` },
        });
        const res = await middleware(req);
        expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("/api/** gateada con camino incompleto → 403 JSON con destino, NUNCA redirect (SPEC-329)", async () => {
        const res = await middleware(await reqPadreConPaso("/api/padre/expediente", "hijos"));
        expect(res.status).toBe(403);
        expect(res.headers.get("location")).toBeNull();
        const json = await res.json();
        expect(json.error.code).toBe("CAMINO_INCOMPLETO");
        expect(json.error.redirectTo).toBe("/camino/hijos");
    });

    // T025 · un error acá no rompe una pantalla: cierra la app entera a un rol.
    for (const rol of ["ADMIN", "OPERADOR", "COMITE_VALIDACION", "SCHOOL_ADMIN"]) {
        it(`${rol} JAMÁS evalúa el camino, aun con pasoCamino en la cookie`, async () => {
            // Cookie deliberadamente envenenada con un paso: si el guardián
            // mirara solo la cookie y no el rol, este test lo caza.
            const res = await middleware(await reqPadreConPaso("/dashboard", "permiso", rol));
            const loc = res.headers.get("location");
            if (loc) {
                // Si otro guardián redirige (p.ej. vigencia de colegio), que no
                // sea NUNCA hacia el camino.
                expect(new URL(loc).pathname.startsWith("/camino")).toBe(false);
                expect(new URL(loc).pathname).not.toBe("/consentimiento");
            }
        });
    }

    // T068 · candado A: el padre nunca queda atrapado. Una por una.
    const NUNCA_TAPADAS = [
        "/api/auth/logout",
        "/cambiar-password",
        "/api/auth/cambiar-password",
        "/consentimiento",
        "/api/consentimiento",
        "/reportar",
        "/dashboard/padre/reportar",
        "/mis-reportes",
        "/api/padre/perfil",
        "/api/padre/hijos",
        "/api/padre/suscripcion",
        "/camino/datos",
        "/api/sesion/al-dia",
    ];
    for (const ruta of NUNCA_TAPADAS) {
        it(`padre a mitad del camino alcanza ${ruta} (no lo tapa el guardián)`, async () => {
            // "datos" y no "permiso": /consentimiento debe ser alcanzable incluso
            // cuando NO es el paso pendiente.
            const res = await middleware(await reqPadreConPaso(ruta, "datos"));
            const loc = res.headers.get("location");
            if (loc) {
                const path = new URL(loc).pathname;
                expect(path.startsWith("/camino"), `${ruta} redirigió al camino`).toBe(false);
            }
            if (res.status === 403) {
                const json = await res.json();
                expect(json.error?.code, `${ruta} bloqueada por el camino`).not.toBe("CAMINO_INCOMPLETO");
            }
        });
    }

    // T024/T069 · falla-CERRADA: cookie ilegible + padre + ruta gobernada = rebote.
    it("padre SIN cookie de estado en ruta gobernada → rebote único a /api/sesion/al-dia", async () => {
        const token = await jwtParaRol("PARENT");
        const req = new NextRequest("http://localhost:5005/dashboard/padre", {
            headers: { cookie: `token=${token}` }, // sin sesion_estado
        });
        const res = await middleware(req);
        expect(res.status).toBe(307);
        const url = new URL(res.headers.get("location") ?? "");
        expect(url.pathname).toBe("/api/sesion/al-dia");
        expect(url.searchParams.get("destino")).toBe("/dashboard/padre");
    });

    it("padre SIN cookie en ruta exenta (p.ej. /mis-reportes) → next(), sin rebote", async () => {
        const token = await jwtParaRol("PARENT");
        const req = new NextRequest("http://localhost:5005/mis-reportes", {
            headers: { cookie: `token=${token}` },
        });
        const res = await middleware(req);
        expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("los demás roles SIN cookie siguen fallando abierto, como siempre", async () => {
        const token = await jwtParaRol("ADMIN");
        const req = new NextRequest("http://localhost:5005/dashboard", {
            headers: { cookie: `token=${token}` },
        });
        const res = await middleware(req);
        expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("una cookie de ANTES del despliegue (sin pasoCamino) se descarta y rebota, no rompe", async () => {
        // Se firma un payload viejo a mano: sin el campo nuevo.
        const token = await jwtParaRol("PARENT");
        const { firmarSesionEstado: firmar } = await import("@/lib/routing/vigencia-cookie");
        // @ts-expect-error payload legado deliberado: así eran las cookies pre-SPEC-339
        const vieja = await firmar({ vigencia: "ACTIVA", requiereConsentimiento: false, debeCambiarPassword: false }, JWT_SECRET_TEST);
        const req = new NextRequest("http://localhost:5005/dashboard/padre", {
            headers: { cookie: `token=${token}; ${NOMBRE_COOKIE}=${vieja}` },
        });
        const res = await middleware(req);
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/api/sesion/al-dia");
    });
});
