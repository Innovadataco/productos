/**
 * SPEC-598 (08-09-2026) — «Crear contraseña» para cuentas OAuth sin clave local.
 *
 * Happy path (código válido → clave creada, login con ella, audit y aviso),
 * código inválido/expirado/de otro propósito, confirmación distinta, y rechazo
 * de cuentas que NO son OAuth-sin-clave (las de siempre usan «Cambiar»).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import { POST } from "./route";
import { POST as postCodigo } from "./codigo/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import { firmarCodigoCrearPassword } from "@/lib/routing/stepup-sello";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name, value: mockToken } : undefined,
        set: (_name: string, _value: string) => {
            // no-op para tests
        },
    }),
}));

const URL_CREAR = "http://localhost:5005/api/auth/crear-password";

/** Cuenta OAuth como las que crea SPEC-587: googleSub + hash aleatorio (passwordCreadaEn null). */
async function crearPadreOAuth(email: string) {
    const padre = await crearUsuario("PARENT", email);
    await prisma.usuario.update({
        where: { id: padre.id },
        data: { googleSub: `sub-${email}` },
    });
    return prisma.usuario.findUniqueOrThrow({ where: { id: padre.id } });
}

/** Código con expiración forzada (mismo formato HMAC, ya vencido). */
function codigoExpirado(usuarioId: string): string {
    const secret = process.env.JWT_SECRET ?? "";
    const iat = Math.floor(Date.now() / 1000) - 20 * 60;
    const payload = { sub: usuarioId, proposito: "crear_password", iat, exp: iat + 10 * 60 };
    const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const sig = createHmac("sha256", secret).update(payloadB64).digest();
    return `${payloadB64}.${sig.toString("base64url")}`;
}

/**
 * Código de OTRO propósito (mismo formato HMAC, firma válida). SPEC-606: el
 * step-up del texto ya no usa este formato — «stepup_email» queda como el
 * propósito ajeno canónico que «Crear contraseña» debe rechazar.
 */
function codigoPropositoAjeno(usuarioId: string): string {
    const secret = process.env.JWT_SECRET ?? "";
    const iat = Math.floor(Date.now() / 1000);
    const payload = { sub: usuarioId, proposito: "stepup_email", iat, exp: iat + 10 * 60 };
    const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const sig = createHmac("sha256", secret).update(payloadB64).digest();
    return `${payloadB64}.${sig.toString("base64url")}`;
}

describe("POST /api/auth/crear-password (SPEC-598)", { timeout: 60_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("crea la contraseña con código válido: hash + passwordCreadaEn + audit + login con la nueva", async () => {
        const padre = await crearPadreOAuth("oauth-crear@test.local");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const codigo = firmarCodigoCrearPassword(padre.id, process.env.JWT_SECRET ?? "");

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                URL_CREAR,
                { codigo, passwordNueva: "ClavePropia123", passwordConfirmar: "ClavePropia123" },
                mockToken
            )
        );
        expect(res.status).toBe(200);

        const actualizado = await prisma.usuario.findUnique({ where: { id: padre.id } });
        expect(actualizado?.passwordHash).not.toBe(padre.passwordHash);
        expect(actualizado?.passwordCreadaEn).not.toBeNull();

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "USUARIO_CAMBIO_PASSWORD", recursoId: padre.id },
        });
        expect(audit).not.toBeNull();

        // La cuenta queda con AMBOS métodos: la nueva clave local sirve para login.
        const { AutenticacionService } = await import("@/lib/dal/services/autenticacion");
        const login = await new AutenticacionService().login("oauth-crear@test.local", "ClavePropia123");
        expect(login.ok).toBe(true);
    });

    it("rechaza código inválido con 401 y no toca la cuenta", async () => {
        const padre = await crearPadreOAuth("oauth-invalido@test.local");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                URL_CREAR,
                { codigo: "codigo.falso", passwordNueva: "ClavePropia123", passwordConfirmar: "ClavePropia123" },
                mockToken
            )
        );
        expect(res.status).toBe(401);

        const actualizado = await prisma.usuario.findUnique({ where: { id: padre.id } });
        expect(actualizado?.passwordHash).toBe(padre.passwordHash);
        expect(actualizado?.passwordCreadaEn).toBeNull();
    });

    it("rechaza código vencido con 401", async () => {
        const padre = await crearPadreOAuth("oauth-vencido@test.local");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                URL_CREAR,
                { codigo: codigoExpirado(padre.id), passwordNueva: "ClavePropia123", passwordConfirmar: "ClavePropia123" },
                mockToken
            )
        );
        expect(res.status).toBe(401);
    });

    it("rechaza un código de OTRO propósito con 401: los códigos no se reciclan", async () => {
        const padre = await crearPadreOAuth("oauth-cruzado@test.local");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const codigoAjeno = codigoPropositoAjeno(padre.id);

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                URL_CREAR,
                { codigo: codigoAjeno, passwordNueva: "ClavePropia123", passwordConfirmar: "ClavePropia123" },
                mockToken
            )
        );
        expect(res.status).toBe(401);
    });

    it("rechaza cuando la confirmación no coincide (400)", async () => {
        const padre = await crearPadreOAuth("oauth-confirm@test.local");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const codigo = firmarCodigoCrearPassword(padre.id, process.env.JWT_SECRET ?? "");

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                URL_CREAR,
                { codigo, passwordNueva: "ClavePropia123", passwordConfirmar: "OtraClave123" },
                mockToken
            )
        );
        expect(res.status).toBe(400);
    });

    it("rechaza cuenta que NO es OAuth (409): esas usan «Cambiar contraseña»", async () => {
        const user = await crearUsuario("PARENT", "email-normal@test.local", "Password123");
        mockToken = await crearTokenUsuario(user.id, "PARENT");
        const codigo = firmarCodigoCrearPassword(user.id, process.env.JWT_SECRET ?? "");

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                URL_CREAR,
                { codigo, passwordNueva: "ClavePropia123", passwordConfirmar: "ClavePropia123" },
                mockToken
            )
        );
        expect(res.status).toBe(409);

        const actualizado = await prisma.usuario.findUnique({ where: { id: user.id } });
        expect(actualizado?.passwordHash).toBe(user.passwordHash);
    });

    it("rechaza cuenta OAuth que YA creó contraseña (409): desde ahí es «Cambiar»", async () => {
        const padre = await crearPadreOAuth("oauth-con-clave@test.local");
        await prisma.usuario.update({
            where: { id: padre.id },
            data: { passwordCreadaEn: new Date() },
        });
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const codigo = firmarCodigoCrearPassword(padre.id, process.env.JWT_SECRET ?? "");

        const res = await POST(
            crearRequestAutenticado(
                "POST",
                URL_CREAR,
                { codigo, passwordNueva: "ClavePropia123", passwordConfirmar: "ClavePropia123" },
                mockToken
            )
        );
        expect(res.status).toBe(409);
    });

    it("rechaza sin autenticación (401)", async () => {
        const res = await POST(
            new Request(URL_CREAR, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo: "x", passwordNueva: "ClavePropia123", passwordConfirmar: "ClavePropia123" }),
            })
        );
        expect(res.status).toBe(401);
    });
});

describe("POST /api/auth/crear-password/codigo (SPEC-598)", { timeout: 60_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
        // Plantilla + regla del evento (autocontenido, mismo patrón que SPEC-592).
        await prisma.notificacionPlantilla.upsert({
            where: { clave: "auth.crear_password.codigo.email" },
            update: { activa: true },
            create: {
                clave: "auth.crear_password.codigo.email",
                canal: "EMAIL",
                asunto: "Tu código para crear tu contraseña",
                cuerpoMarkdown: "Código: {{codigo}} (vence en {{vigenciaMinutos}} minutos).",
                variablesSchema: {},
            },
        });
        await prisma.notificacionRegla.create({
            data: {
                evento: "auth.crear_password.codigo",
                rol: "PARENT",
                offset: "+0m",
                canal: "EMAIL",
                plantillaClave: "auth.crear_password.codigo.email",
            },
        });
    });

    it("cuenta OAuth sin clave: envía el código (200, enviado true)", async () => {
        const padre = await crearPadreOAuth("oauth-codigo@test.local");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await postCodigo(
            crearRequestAutenticado("POST", "http://localhost:5005/api/auth/crear-password/codigo", {}, mockToken)
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.enviado).toBe(true);
        expect(data.vigenciaMinutos).toBe(10);
    });

    it("cuenta no-OAuth: 409 con mensaje que orienta a «Cambiar contraseña»", async () => {
        const user = await crearUsuario("PARENT", "email-codigo@test.local", "Password123");
        mockToken = await crearTokenUsuario(user.id, "PARENT");

        const res = await postCodigo(
            crearRequestAutenticado("POST", "http://localhost:5005/api/auth/crear-password/codigo", {}, mockToken)
        );
        expect(res.status).toBe(409);
    });
});
