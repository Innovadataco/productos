/**
 * SPEC-329 (002-PI-229): los tres guardianes de estado del middleware (Pasos 4/5/6)
 * distinguen ahora rutas de API. Para `/api/**` gateadas devuelven JSON 403 con `code`
 * (no un redirect 302 HTML que un fetch seguiría y confundiría con éxito). Las pantallas
 * (no-api) siguen redirigiendo con 302 al `destino` — CONTRAPRUEBA obligatoria (candado 24 v2).
 */
import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { firmarSesionEstado, type SesionEstadoPayload } from "@/lib/routing/vigencia-cookie";

const SECRET = process.env.JWT_SECRET ?? "test-secret-key-32-chars-long-12345678";

async function token(rol: string): Promise<string> {
    return new SignJWT({ sub: "user-329", rol }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode(SECRET));
}

/** Request con sesión (JWT) + estado firmado que dispara el guardián indicado. */
async function req(pathname: string, rol: string, estado: Omit<SesionEstadoPayload, "iat">): Promise<NextRequest> {
    const jwt = await token(rol);
    const sesionEstado = await firmarSesionEstado(estado, SECRET);
    return new NextRequest(`http://localhost:5005${pathname}`, {
        method: pathname.startsWith("/api/") ? "POST" : "GET",
        headers: { cookie: `token=${jwt}; sesion_estado=${sesionEstado}` },
    });
}

const VIGENTE = { vigencia: "ACTIVA" as const, requiereConsentimiento: false, debeCambiarPassword: false };

describe("SPEC-329 · guardianes del middleware devuelven JSON 403 en /api/ (no redirect)", () => {
    it("Paso 4 consentimiento · POST /api/ gateado → 403 JSON con code, NO 302", async () => {
        const estado = { ...VIGENTE, requiereConsentimiento: true };
        const res = await middleware(await req("/api/padre/expediente", "PARENT", estado));
        expect(res.status).toBe(403);
        expect(res.headers.get("location")).toBeNull(); // no es un redirect
        const json = await res.json();
        expect(json.error.code).toBe("CONSENTIMIENTO_REQUERIDO");
        expect(json.error.redirectTo).toBe("/consentimiento");
    });

    it("Paso 4 consentimiento · CONTRAPRUEBA: GET /dashboard gateado SIGUE en 302", async () => {
        const estado = { ...VIGENTE, requiereConsentimiento: true };
        const res = await middleware(await req("/dashboard/padre", "PARENT", estado));
        expect([302, 307, 308]).toContain(res.status); // sigue siendo un redirect HTML
        expect(res.headers.get("location")).toContain("/consentimiento");
    });

    it("Paso 5 cambiar-password · POST /api/ gateado → 403 JSON con code, NO 302", async () => {
        const estado = { ...VIGENTE, debeCambiarPassword: true };
        const res = await middleware(await req("/api/padre/expediente", "PARENT", estado));
        expect(res.status).toBe(403);
        expect(res.headers.get("location")).toBeNull();
        const json = await res.json();
        expect(json.error.code).toBe("CAMBIO_PASSWORD_REQUERIDO");
        expect(json.error.redirectTo).toBe("/cambiar-password");
    });

    it("Paso 5 cambiar-password · CONTRAPRUEBA: GET /dashboard gateado SIGUE en 302", async () => {
        const estado = { ...VIGENTE, debeCambiarPassword: true };
        const res = await middleware(await req("/dashboard/padre", "PARENT", estado));
        expect([302, 307, 308]).toContain(res.status);
        expect(res.headers.get("location")).toContain("/cambiar-password");
    });

    it("Paso 6 vigencia · POST /api/ gateado → 403 JSON con code, NO 302", async () => {
        const estado = { ...VIGENTE, vigencia: "SIN_SUSCRIPCION" as const };
        const res = await middleware(await req("/api/padre/expediente", "PARENT", estado));
        expect(res.status).toBe(403);
        expect(res.headers.get("location")).toBeNull();
        const json = await res.json();
        expect(json.error.code).toBe("VIGENCIA_REQUERIDA");
        expect(json.error.redirectTo).toBe("/dashboard/padre/suscripcion");
    });

    it("Paso 6 vigencia · CONTRAPRUEBA: GET /dashboard gateado SIGUE en 302", async () => {
        const estado = { ...VIGENTE, vigencia: "SIN_SUSCRIPCION" as const };
        const res = await middleware(await req("/dashboard/padre", "PARENT", estado));
        expect([302, 307, 308]).toContain(res.status);
        expect(res.headers.get("location")).toContain("/dashboard/padre/suscripcion");
    });
});
