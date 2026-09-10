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

    it("retorna respuesta uniforme para email no registrado", async () => {
        const res = await POST(makeRequest({ email: "no-registrado@example.com" }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.message).toBe(MENSAJE_EXITO);
        expect(data.emailSent).toBe(false);
    });

    it("retorna respuesta uniforme para email registrado", async () => {
        await crearUsuario("PARENT", "registrado@example.com");
        const res = await POST(makeRequest({ email: "registrado@example.com" }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.message).toBe(MENSAJE_EXITO);
    });

    // ── SPEC-609 (reparo 2) · CANDADO DE CONDUCTA: una cuenta de Google no recibe correo inútil ──
    it("SPEC-609: cuenta de Google sin contraseña → NO genera correo/token y responde «entra con Google»", async () => {
        const u = await crearUsuario("PARENT", "google.padre@example.com");
        // Cuenta creada por Google sin clave local: googleSub presente, passwordCreadaEn null.
        await prisma.usuario.update({ where: { id: u.id }, data: { googleSub: "g-sub-609", passwordCreadaEn: null } });

        const res = await POST(makeRequest({ email: "google.padre@example.com" }, "203.0.113.201"));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.emailSent).toBe(false);
        expect(data.message).toContain("entra con Google");
        expect(data.devToken, "no hay contraseña que restablecer: no se genera token").toBeUndefined();
        const tokens = await prisma.tokenRecuperacion.count({ where: { email: "google.padre@example.com" } });
        expect(tokens, "una cuenta de Google no genera token de restablecimiento").toBe(0);
    });

    it("SPEC-609 (contraprueba): cuenta con contraseña local SÍ genera el restablecimiento", async () => {
        await crearUsuario("PARENT", "local.padre@example.com"); // googleSub null → tiene clave local
        const res = await POST(makeRequest({ email: "local.padre@example.com" }, "203.0.113.202"));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.message).toBe(MENSAJE_EXITO); // mensaje genérico, no «entra con Google»
        const tokens = await prisma.tokenRecuperacion.count({ where: { email: "local.padre@example.com" } });
        expect(tokens, "una cuenta con contraseña local sí genera token").toBe(1);
    });

    it("SPEC-609: el borde de enumeración NO se abre para cuentas que no son de Google (inexistente == con-clave)", async () => {
        // Inexistente y cuenta-con-contraseña comparten el MISMO mensaje genérico: indistinguibles.
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

    it("en desarrollo expone devToken cuando el email falla; en producción NUNCA (BL-3)", async () => {
        await crearUsuario("PARENT", "bl3@example.com");

        const dev = await POST(makeRequest({ email: "bl3@example.com" }));
        const devData = await dev.json();
        expect(devData.emailSent).toBe(false);
        expect(devData.devToken).toBeDefined();

        const envOriginal = process.env.NODE_ENV;
        (process.env as { NODE_ENV: string }).NODE_ENV = "production";
        try {
            const prod = await POST(makeRequest({ email: "bl3@example.com" }, "203.0.113.111"));
            const prodData = await prod.json();
            expect(prodData.emailSent).toBe(false);
            expect(prodData.devToken).toBeUndefined();
        } finally {
            (process.env as { NODE_ENV: string }).NODE_ENV = envOriginal ?? "test";
        }
    });
});
