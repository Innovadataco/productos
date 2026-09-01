/**
 * SPEC-339 (A-67) — POST /api/auth/registro/completar.
 *
 * El enlace se consume UNA vez, la cuenta nace con la sesión iniciada y la
 * cookie de estado sellada (directo al Paso 1, sin rebote), y el correo caído
 * no deshace nada (T080).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    enviarBienvenidaPadre: vi.fn(),
    enviarEnlaceRegistro: vi.fn(),
    enviarEmailCuentaExistente: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
    enviarBienvenidaPadre: mocks.enviarBienvenidaPadre,
    enviarEnlaceRegistro: mocks.enviarEnlaceRegistro,
    enviarEmailCuentaExistente: mocks.enviarEmailCuentaExistente,
}));

// `setSessionCookie` usa cookies() de next/headers, que fuera de un request de
// Next lanza — mismo mock que el test de verificar/completar.
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: () => undefined,
        set: vi.fn(),
    }),
}));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearParametrosReportes } from "@/lib/reporte-test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { RegistroEnlaceService } from "@/lib/dal/services/registro-enlace";

function makeRequest(body: unknown, ip = "203.0.113.30"): Request {
    return new Request("http://localhost:5005/api/auth/registro/completar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify(body),
    });
}

/** Crea un enlace válido y devuelve el token en claro. */
async function crearEnlace(email: string): Promise<string> {
    const r = await new RegistroEnlaceService().solicitarEnlace(email);
    if (!r.ok || r.tipo !== "ok") throw new Error("no se pudo crear el enlace de prueba");
    return r.token;
}

const PASS = "Segura123";

describe("POST /api/auth/registro/completar (SPEC-339)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await resetRateLimitStore();
        vi.clearAllMocks();
        mocks.enviarBienvenidaPadre.mockResolvedValue(undefined);
    });

    it("enlace válido → 201, cuenta PARENT creada, token consumido y bienvenida enviada", async () => {
        const token = await crearEnlace("padre@example.com");
        const res = await POST(makeRequest({ token, password: PASS, passwordConfirmacion: PASS }));

        expect(res.status).toBe(201);
        const user = await prisma.usuario.findUnique({ where: { email: "padre@example.com" } });
        expect(user?.rol).toBe("PARENT");
        expect(await prisma.tokenRegistro.count({ where: { email: "padre@example.com", usado: false } })).toBe(0);
        expect(mocks.enviarBienvenidaPadre).toHaveBeenCalledWith("padre@example.com");
    });

    it("la respuesta sale con la cookie de estado sellada — directo al Paso 1, sin rebote", async () => {
        const token = await crearEnlace("sellado@example.com");
        const res = await POST(makeRequest({ token, password: PASS, passwordConfirmacion: PASS }));
        expect(res.headers.get("set-cookie") ?? "").toContain("sesion_estado=");
    });

    it("el mismo enlace dos veces → la segunda 410 y NO crea nada (un solo uso)", async () => {
        const token = await crearEnlace("dosveces@example.com");
        await POST(makeRequest({ token, password: PASS, passwordConfirmacion: PASS }));

        const res2 = await POST(makeRequest({ token, password: PASS, passwordConfirmacion: PASS }, "203.0.113.31"));
        expect(res2.status).toBe(410);
        expect(await prisma.usuario.count({ where: { email: "dosveces@example.com" } })).toBe(1);
    });

    it("enlace vencido → 410 con mensaje sereno", async () => {
        const token = await crearEnlace("tarde@example.com");
        await prisma.tokenRegistro.updateMany({
            where: { email: "tarde@example.com" },
            data: { expiraEn: new Date(Date.now() - 1000) },
        });
        const res = await POST(makeRequest({ token, password: PASS, passwordConfirmacion: PASS }));
        expect(res.status).toBe(410);
        const json = await res.json();
        expect(json.error.message).toContain("Pide uno nuevo");
    });

    it("enlace inexistente → 410", async () => {
        const res = await POST(makeRequest({ token: "x".repeat(64), password: PASS, passwordConfirmacion: PASS }));
        expect(res.status).toBe(410);
    });

    // Candado espejo (OBS-1 auditoría #222): un token de registro de COLEGIO no
    // se consume por la ruta del padre — crearía un rector sin colegio y
    // quemaría el correo. 409 y el enlace sigue vivo para su propio flujo.
    it("token SCHOOL_ADMIN por la ruta del padre → 409, no crea usuario y NO consume el enlace", async () => {
        const servicio = new RegistroEnlaceService();
        const r = await servicio.solicitarEnlace("rectora@colegio.example.com", "SCHOOL_ADMIN", {
            nombreColegio: "Colegio Espejo",
            nit: "900123456-7",
        });
        if (!r.ok || r.tipo !== "ok") throw new Error("no se pudo crear el enlace de colegio");

        const res = await POST(makeRequest({ token: r.token, password: PASS, passwordConfirmacion: PASS }));
        expect(res.status).toBe(409);
        expect(await prisma.usuario.findUnique({ where: { email: "rectora@colegio.example.com" } })).toBeNull();
        // El enlace sigue vivo: su flujo correcto (registro-colegio) aún lo valida.
        expect((await servicio.validarEnlace(r.token)).valido).toBe(true);
    });

    it("carrera: la cuenta nació entre pedir y abrir (p.ej. la creó un admin) → 409", async () => {
        const token = await crearEnlace("carrera@example.com");
        await crearUsuario("PARENT", "carrera@example.com");
        const res = await POST(makeRequest({ token, password: PASS, passwordConfirmacion: PASS }));
        expect(res.status).toBe(409);
    });

    it("contraseñas que no coinciden → 400 antes de tocar nada", async () => {
        const token = await crearEnlace("corta@example.com");
        const res = await POST(makeRequest({ token, password: PASS, passwordConfirmacion: "Otra1234" }));
        expect(res.status).toBe(400);
        expect(await prisma.usuario.count({ where: { email: "corta@example.com" } })).toBe(0);
    });

    it("contraseña débil (sin número) → 400", async () => {
        const token = await crearEnlace("debil@example.com");
        const res = await POST(makeRequest({ token, password: "sinnumeros", passwordConfirmacion: "sinnumeros" }));
        expect(res.status).toBe(400);
    });

    // T080 · el fallo de la bienvenida no deshace la cuenta.
    it("BIENVENIDA CAÍDA: la cuenta queda creada y la respuesta sigue siendo 201", async () => {
        mocks.enviarBienvenidaPadre.mockRejectedValue(new Error("proveedor caído"));
        const token = await crearEnlace("igual-entra@example.com");
        const res = await POST(makeRequest({ token, password: PASS, passwordConfirmacion: PASS }));
        expect(res.status).toBe(201);
        expect(await prisma.usuario.count({ where: { email: "igual-entra@example.com" } })).toBe(1);
    });
});
