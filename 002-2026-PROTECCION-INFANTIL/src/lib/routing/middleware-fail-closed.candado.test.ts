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
