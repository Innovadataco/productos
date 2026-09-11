import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearParametrosReportes } from "@/lib/reporte-test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";

const MENSAJE_EXITO = "Si el email es válido, recibirás un código de verificación.";

const rateLimitDisabled = process.env.DISABLE_RATE_LIMIT === "true";

function makeRequest(body: unknown, ip = "203.0.113.20"): Request {
    return new Request("http://localhost:5005/api/auth/verificar/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify(body),
    });
}

/**
 * NO-PROD (camino SÍNCRONO): la ruta espera el trabajo y expone `devCode` en fallo de envío para el
 * arnés. La UNIFORMIDAD de enumeración es propiedad de PRODUCCIÓN (cuerpo byte-idéntico, sin devCode,
 * tiempo plano) y la fija `verificar-solicitar-sin-enumeracion.candado.test.ts` (SPEC-641), que fuerza
 * NODE_ENV=production.
 */
describe("POST /api/auth/verificar/solicitar", { timeout: 30_000 }, () => {
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

    it("rechaza email inválido", async () => {
        const res = await POST(makeRequest({ email: "no-es-email" }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("email registrado: 202, mensaje genérico SIN emailSent + avisa al buzón (I-226/SPEC-338)", async () => {
        await crearUsuario("PARENT", "registrado-verificar@example.com");
        // El motor necesita la plantilla + regla del aviso "ya tenés una cuenta".
        await prisma.notificacionPlantilla.create({
            data: {
                clave: "auth.cuenta_existente.email",
                canal: "EMAIL",
                asunto: "Ya tenés una cuenta con este correo",
                cuerpoMarkdown: "Entrá: {{urlLogin}}\nRecuperá tu clave: {{urlRecuperar}}",
            },
        });
        await prisma.notificacionRegla.create({
            data: {
                evento: "auth.cuenta_existente",
                rol: "ALL",
                offset: "+0m",
                canal: "EMAIL",
                plantillaClave: "auth.cuenta_existente.email",
                obligatoria: true,
            },
        });

        const res = await POST(makeRequest({ email: "registrado-verificar@example.com" }));
        expect(res.status).toBe(202);
        const data = await res.json();
        // Anti-enumeración: la pantalla NO revela existencia — mensaje genérico y SIN `emailSent`.
        expect(data.message).toBe(MENSAJE_EXITO);
        expect(data.emailSent, "emailSent salió del cuerpo (era el delator por PRESENCIA)").toBeUndefined();

        // I-226: pero el buzón SÍ recibe el aviso "ya tenés una cuenta".
        const notif = await prisma.notificacion.findFirst({
            where: { evento: "auth.cuenta_existente", destinatarioEmail: "registrado-verificar@example.com" },
            orderBy: { createdAt: "desc" },
        });
        expect(notif).not.toBeNull();
        expect(notif?.plantillaClave).toBe("auth.cuenta_existente.email");
        expect(notif?.canal).toBe("EMAIL");
    });

    it("email no registrado: 202, mensaje genérico SIN emailSent, y (no-prod) devCode en fallo de envío", async () => {
        const res = await POST(makeRequest({ email: "nuevo-verificar@example.com" }));
        expect(res.status).toBe(202);
        const data = await res.json();
        expect(data.message).toBe(MENSAJE_EXITO);
        expect(data.emailSent, "sin emailSent también para el nuevo").toBeUndefined();
        expect(data.devCode, "no-prod expone el código para el arnés").toBeDefined();

        const codes = await prisma.codigoVerificacion.count({ where: { email: "nuevo-verificar@example.com" } });
        expect(codes).toBe(1);
    });

    it("bloquea tras exceder el límite por IP", async () => {
        const ip = "203.0.113.70";
        for (let i = 0; i < 5; i++) {
            const res = await POST(makeRequest({ email: `ip-${i}@example.com` }, ip));
            expect(res.status).toBe(202);
        }

        const blocked = await POST(makeRequest({ email: "bloqueado@example.com" }, ip));
        expect(blocked.status).toBe(429);
        const data = await blocked.json();
        expect(data.error.code).toBe("RATE_LIMITED");
        expect(blocked.headers.get("X-RateLimit-Limit")).toBe("5");
    });

    it("bloquea tras exceder el límite por email", async () => {
        // Email registrado para que el endpoint no cree códigos y el único límite sea el rate limit por id.
        const email = "registrado-rl-email@example.com";
        await crearUsuario("PARENT", email);
        for (let i = 0; i < 5; i++) {
            const res = await POST(makeRequest({ email }, `203.0.113.${80 + i}`));
            expect(res.status).toBe(202);
        }

        const blocked = await POST(makeRequest({ email }, "203.0.113.99"));
        expect(blocked.status).toBe(429);
        const data = await blocked.json();
        expect(data.error.code).toBe("RATE_LIMITED");
    });

    it("no-prod expone devCode en fallo de envío (el arnés lo necesita; prod NUNCA — ver candado BL-3)", async () => {
        const res = await POST(makeRequest({ email: "bl3-nonprod@example.com" }, "203.0.113.112"));
        expect(res.status).toBe(202);
        const data = await res.json();
        expect(data.devCode, "no-prod: código disponible para el arnés").toBeDefined();
        expect(data.emailSent, "sin emailSent en ningún caso").toBeUndefined();
    });
});
