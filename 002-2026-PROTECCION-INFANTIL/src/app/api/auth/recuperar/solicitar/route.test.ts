import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearParametrosReportes } from "@/lib/reporte-test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";

const MENSAJE_EXITO = "Si el email está registrado, recibirás un enlace para restablecer tu contraseña.";

const rateLimitDisabled = process.env.DISABLE_RATE_LIMIT === "true";

function makeRequest(body: unknown, ip = "203.0.113.10"): Request {
    return new Request("http://localhost:5005/api/auth/recuperar/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify(body),
    });
}

/**
 * Estas pruebas corren en NO-PROD (camino SÍNCRONO): la ruta espera el trabajo y expone `devToken` en
 * fallo de envío para el arnés (no puede leer el correo). La UNIFORMIDAD de enumeración es propiedad de
 * PRODUCCIÓN (cuerpo byte-idéntico, sin devToken, tiempo plano) y la fija el candado
 * `recuperar-solicitar-sin-enumeracion.candado.test.ts` (SPEC-630), que fuerza NODE_ENV=production.
 */
describe("POST /api/auth/recuperar/solicitar", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await resetRateLimitStore();
        if (rateLimitDisabled) {
            process.env.DISABLE_RATE_LIMIT = "false";
        }
    });

    afterEach(() => {
        if (rateLimitDisabled) {
            process.env.DISABLE_RATE_LIMIT = "true";
        }
    });

    it("rechaza email inválido con VALIDATION_ERROR", async () => {
        const res = await POST(makeRequest({ email: "no-es-email" }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("email no registrado: 200 con el mensaje genérico y SIN campos de estado (emailSent/metodo fuera)", async () => {
        const res = await POST(makeRequest({ email: "no-registrado@example.com" }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.message).toBe(MENSAJE_EXITO);
        // SPEC-630: el cuerpo ya no delata existencia — sin `emailSent` ni `metodo`, y sin token (no hay cuenta).
        expect(data.emailSent, "emailSent salió del cuerpo (era oráculo de existencia)").toBeUndefined();
        expect(data.metodo, "metodo salió del cuerpo").toBeUndefined();
        expect(data.devToken, "sin cuenta no hay token").toBeUndefined();
    });

    it("email registrado con clave local: 200, mensaje genérico, y (no-prod) devToken en fallo de envío", async () => {
        await crearUsuario("PARENT", "registrado@example.com");
        const res = await POST(makeRequest({ email: "registrado@example.com" }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.message).toBe(MENSAJE_EXITO);
        expect(data.emailSent, "sin emailSent también para el existente").toBeUndefined();
        // No-prod: el arnés obtiene el token porque el envío falla sin proveedor real.
        expect(data.devToken, "no-prod expone el token para el arnés").toBeDefined();
        const tokens = await prisma.tokenRecuperacion.count({ where: { email: "registrado@example.com" } });
        expect(tokens, "la cuenta con clave local sí genera token").toBe(1);
    });

    // SPEC-647 (D-136): Google salió del producto; ya no hay cuentas sin clave local ni rama
    // `solo_google`. Toda cuenta registrada se trata igual (crea token + envía). La no-enumeración se
    // preserva por el cuerpo constante (abajo) y el candado de SPEC-630.

    it("el mensaje es idéntico para inexistente y cuenta-con-clave (indistinguibles por texto)", async () => {
        const inexistente = await (await POST(makeRequest({ email: "no.existe@example.com" }, "203.0.113.203"))).json();
        await crearUsuario("PARENT", "con.clave@example.com");
        const conClave = await (await POST(makeRequest({ email: "con.clave@example.com" }, "203.0.113.204"))).json();
        expect(inexistente.message).toBe(MENSAJE_EXITO);
        expect(conClave.message).toBe(MENSAJE_EXITO);
        expect(conClave.message).not.toContain("Google");
    });

    it("bloquea tras exceder el límite por IP", async () => {
        const ip = "203.0.113.50";
        for (let i = 0; i < 5; i++) {
            const res = await POST(makeRequest({ email: `ip-${i}@example.com` }, ip));
            expect(res.status).toBe(200);
        }

        const blocked = await POST(makeRequest({ email: "bloqueado@example.com" }, ip));
        expect(blocked.status).toBe(429);
        const data = await blocked.json();
        expect(data.error.code).toBe("RATE_LIMITED");
        expect(blocked.headers.get("X-RateLimit-Limit")).toBe("5");
        expect(blocked.headers.get("Retry-After")).toBeDefined();
    });

    it("bloquea tras exceder el límite por email", async () => {
        const email = "mismo-email@example.com";
        for (let i = 0; i < 5; i++) {
            const res = await POST(makeRequest({ email }, `203.0.113.${60 + i}`));
            expect(res.status).toBe(200);
        }

        const blocked = await POST(makeRequest({ email }, "203.0.113.99"));
        expect(blocked.status).toBe(429);
        const data = await blocked.json();
        expect(data.error.code).toBe("RATE_LIMITED");
    });

    it("no-prod expone devToken en fallo de envío (el arnés lo necesita; prod NUNCA — ver candado BL-3)", async () => {
        await crearUsuario("PARENT", "bl3@example.com");
        const dev = await POST(makeRequest({ email: "bl3@example.com" }));
        const devData = await dev.json();
        expect(devData.devToken, "no-prod: token disponible para el arnés").toBeDefined();
        expect(devData.emailSent, "sin emailSent en ningún caso").toBeUndefined();
    });
});
