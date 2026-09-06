/**
 * SPEC-572 (I-236) · CANDADO DE CONDUCTA — los tres muros (consentimiento, cambio de contraseña,
 * vigencia) y todo /api/** DEBEN fallar CERRADO cuando la cookie firmada `sesion_estado` está
 * AUSENTE, aunque el JWT siga siendo válido.
 *
 * El defecto: los muros vivían dentro de `if (estado)`, y `estado` derivaba de una cookie que el
 * CLIENTE controla. Borrarla apagaba los tres muros indefinidamente. Regla: ausente = desconocido,
 * y desconocido CIERRA (rebote de re-derivación en páginas; 403 JSON en /api/**), no abre.
 *
 * Ancla: cada `it` fija un muro con una ruta representativa. Uno por muro + uno para /api/**.
 * Mutación (verificada aparte): si se quita el cierre fail-closed del middleware, los CUATRO mueren.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../../middleware";
import { SignJWT } from "jose";
import { firmarSesionEstado, NOMBRE_COOKIE } from "@/lib/routing/vigencia-cookie";

const JWT_SECRET_TEST =
    process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32
        ? process.env.JWT_SECRET
        : "test-secret-32-chars-fail-closed-572!!";

beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET_TEST;
});

async function jwt(rol: string): Promise<string> {
    return new SignJWT({ sub: "u-572", rol })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h")
        .sign(new TextEncoder().encode(JWT_SECRET_TEST));
}

/** JWT válido, pero SIN la cookie `sesion_estado` (el escenario del adversario que la borra). */
async function reqSinEstado(pathname: string, rol: string): Promise<NextRequest> {
    const token = await jwt(rol);
    return new NextRequest(`http://localhost:5005${pathname}`, {
        headers: { cookie: `token=${token}` },
    });
}

/**
 * Igual que `reqSinEstado`, pero la URL trae `?_rv=1`: es el estado en que vuelve el
 * navegador tras un rebote a `/api/sesion/al-dia` cuyo re-sello NO pegó (cookie rechazada,
 * reloj adelantado, secure sobre http). JWT válido, cookie de estado AÚN ausente, marca puesta.
 */
async function reqReboteFallido(pathname: string, rol: string): Promise<NextRequest> {
    const token = await jwt(rol);
    const url = new URL(`http://localhost:5005${pathname}`);
    url.searchParams.set("_rv", "1");
    return new NextRequest(url, { headers: { cookie: `token=${token}` } });
}

describe("SPEC-572 · fail-closed sin cookie sesion_estado (I-236)", () => {
    it("(muro 1 · consentimiento) titular PARENT en ruta gateada SIN cookie → NO pasa (rebote a re-derivar)", async () => {
        const res = await middleware(await reqSinEstado("/dashboard/padre", "PARENT"));
        expect(res.headers.get("x-middleware-next"), "NO debe dejar pasar (fail-open)").not.toBe("1");
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/api/sesion/al-dia");
    });

    it("(muro 2 · cambio de password) ADMIN (cuyo ÚNICO muro es password) SIN cookie → NO pasa", async () => {
        // ADMIN no es titular, no tiene camino ni vigencia: si pasara, sería el muro de password
        // el que se estaría evadiendo. Rebota a re-derivar.
        const res = await middleware(await reqSinEstado("/dashboard/admin", "ADMIN"));
        expect(res.headers.get("x-middleware-next"), "NO debe dejar pasar (fail-open del muro de password)").not.toBe("1");
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/api/sesion/al-dia");
    });

    it("(muro 3 · vigencia) rol con vigencia (PARENT) en ruta gateada SIN cookie → NO pasa", async () => {
        const res = await middleware(await reqSinEstado("/dashboard/padre/home", "PARENT"));
        expect(res.headers.get("x-middleware-next"), "NO debe dejar pasar (fail-open del muro de vigencia)").not.toBe("1");
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/api/sesion/al-dia");
    });

    it("(/api/** ) ruta de API gateada SIN cookie → 403 JSON SESION_ESTADO_REQUERIDO, nunca 302 (SPEC-329)", async () => {
        const res = await middleware(await reqSinEstado("/api/padre/hijos", "PARENT"));
        expect(res.status, "un fetch no sigue redirects: debe ser 403, no 3xx").toBe(403);
        const body = (await res.json()) as { error?: { code?: string } };
        expect(body?.error?.code).toBe("SESION_ESTADO_REQUERIDO");
    });
});

/**
 * SPEC-572 (loop-cap, revisión CEO) · CANDADO DE CONDUCTA — "con el re-sello roto, no hay bucle".
 *
 * El rebote fail-closed re-sella y devuelve al destino con `?_rv=1`. Si la cookie NO pega en el
 * cliente, el destino vuelve al middleware SIN estado y CON la marca. El endpoint no ve ese fallo
 * (cree que re-selló bien); la marca es la única señal que sobrevive. Sin tope, cada vuelta manda
 * a `/api/sesion/al-dia` otra vez → 307 infinito que deja al usuario fuera.
 *
 * Ancla: MISMA ruta gateada, un rebote (sin marca) vs. un rebote fallido (con marca). El primero
 * va a `al-dia` (el fail-closed original sigue vivo); el segundo corta a `/login`, terminal.
 * Mutación (verificada aparte): si se quita el chequeo de `marcaRebote`, el segundo caso vuelve a
 * `al-dia` — el bucle — y este candado muere.
 */
describe("SPEC-572 · loop-cap: con el re-sello roto, no hay bucle", () => {
    it("primer rebote (sin marca) todavía va a /api/sesion/al-dia — el fail-closed no se rompió", async () => {
        const res = await middleware(await reqSinEstado("/dashboard/padre", "PARENT"));
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/api/sesion/al-dia");
    });

    it("rebote fallido (con `_rv=1`) y cookie AÚN ausente → corta a /login, NO rebota otra vez", async () => {
        const res = await middleware(await reqReboteFallido("/dashboard/padre", "PARENT"));
        expect(res.status).toBe(307);
        const loc = new URL(res.headers.get("location") ?? "");
        expect(loc.pathname, "NO puede volver a rebotar a al-dia: sería el bucle").not.toBe("/api/sesion/al-dia");
        expect(loc.pathname).toBe("/login");
        expect(loc.searchParams.get("mensaje"), "aterriza en algo que le habla").toBe("sesion");
        // La sesión se cierra: sin cookie fresca, seguir gobernado rebotaría de nuevo.
        expect(res.headers.get("set-cookie") ?? "", "cierra la sesión colgada").toContain("sesion_estado=;");
    });

    it("con `_rv=1` PERO cookie válida presente (re-sello SÍ pegó) → pasa normal, la marca es inerte", async () => {
        // Regresión: cuando el re-sello sí prendió, el destino trae `_rv=1` como residuo. NO debe
        // cortar nada: `estado` presente → los muros de arriba deciden y la sesión sana pasa. Si el
        // loop-cap disparara con la cookie presente, rompería toda navegación tras un rebote exitoso.
        const token = await jwt("PARENT");
        const estado = await firmarSesionEstado(
            { vigencia: "ACTIVA", requiereConsentimiento: false, debeCambiarPassword: false, pasoCamino: null },
            JWT_SECRET_TEST,
        );
        const url = new URL("http://localhost:5005/dashboard/padre");
        url.searchParams.set("_rv", "1");
        const res = await middleware(
            new NextRequest(url, { headers: { cookie: `token=${token}; ${NOMBRE_COOKIE}=${estado}` } }),
        );
        expect(res.headers.get("x-middleware-next"), "sesión sana con la marca residual DEBE pasar").toBe("1");
    });
});
