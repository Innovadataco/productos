import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { GET as GETConsulta } from "@/app/api/consulta/route";
import { PATCH as PATCHVigencia } from "@/app/api/admin/padres/[id]/vigencia/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearUsuario,
    crearTokenUsuario,
    crearPlataforma,
    crearColegioConAdmin,
} from "@/lib/reporte-test-utils";
import { normalizarFechaServicio } from "@/lib/colegio/vigencia";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
        set: vi.fn(),
    }),
}));

function login(email: string, password: string) {
    return POST(
        new Request("http://localhost:5005/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        })
    );
}

function diasDesdeHoy(dias: number): Date {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return normalizarFechaServicio(d);
}

describe("POST /api/auth/login — validación del payload (SPEC-125)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    function loginRaw(body: string) {
        return POST(
            new Request("http://localhost:5005/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body,
            })
        );
    }

    it("rechaza 400 sin password con el mensaje de contrato", async () => {
        const res = await loginRaw(JSON.stringify({ email: "padre@example.com" }));
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.message).toBe("Email y contraseña requeridos");
        expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza 400 sin email", async () => {
        const res = await loginRaw(JSON.stringify({ password: "TestPass123" }));
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.message).toBe("Email y contraseña requeridos");
    });

    it("rechaza 400 un body que no es un objeto (antes: 500)", async () => {
        const res = await loginRaw(JSON.stringify("no-soy-un-objeto"));
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("normaliza el email (trim + lowercase) como antes", async () => {
        const padre = await crearUsuario("PARENT", "normaliza@example.com");
        const res = await login("  NORMALIZA@example.com ", "TestPass123");
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.user.id).toBe(padre.id);
    });
});

describe("POST /api/auth/login — vigencia del cliente (SPEC-119)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("padre sin vigencia definida entra (200)", async () => {
        const padre = await crearUsuario("PARENT", "padre@example.com");
        const res = await login("padre@example.com", "TestPass123");
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.user.id).toBe(padre.id);
    });

    it("padre vencido recibe 403 con mensaje claro (qué pasó y a quién acudir)", async () => {
        await crearUsuario("PARENT", "vencido@example.com");
        const padre = await prisma.usuario.findUnique({ where: { email: "vencido@example.com" } });
        await prisma.usuario.update({
            where: { id: padre!.id },
            data: { finServicio: diasDesdeHoy(-1) },
        });

        const res = await login("vencido@example.com", "TestPass123");
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.error.message).toMatch(/vencido/i);
        expect(json.error.message).toMatch(/soporte/i);
    });

    it("padre con servicio no iniciado recibe 403 con mensaje claro", async () => {
        const padre = await crearUsuario("PARENT", "noiniciado@example.com");
        await prisma.usuario.update({
            where: { id: padre.id },
            data: { inicioServicio: diasDesdeHoy(3) },
        });

        const res = await login("noiniciado@example.com", "TestPass123");
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.error.message).toMatch(/soporte/i);
    });

    it("colegio vencido se bloquea por el MISMO mecanismo (403 con mensaje)", async () => {
        const { admin, colegio } = await crearColegioConAdmin();
        await prisma.colegio.update({
            where: { id: colegio.id },
            data: { finServicio: diasDesdeHoy(-1) },
        });

        const res = await login(admin.email, "TestPass123");
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.error.message).toMatch(/vencido/i);
    });

    it("admin extiende la ventana del padre vencido y el acceso vuelve (login 200)", async () => {
        const padre = await crearUsuario("PARENT", "extendido@example.com");
        await prisma.usuario.update({
            where: { id: padre.id },
            data: { finServicio: diasDesdeHoy(-1) },
        });
        expect((await login("extendido@example.com", "TestPass123")).status).toBe(403);

        const admin = await crearUsuario("ADMIN", "admin@example.com");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const patch = await PATCHVigencia(
            new Request(`http://localhost:5005/api/admin/padres/${padre.id}/vigencia`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
                body: JSON.stringify({ finServicio: diasDesdeHoy(30).toISOString() }),
            }),
            { params: Promise.resolve({ id: padre.id }) }
        );
        expect(patch.status).toBe(200);

        const res = await login("extendido@example.com", "TestPass123");
        expect(res.status).toBe(200);
    });

    it("vencer NO borra nada: los reportes del padre vencido siguen intactos", async () => {
        const padre = await crearUsuario("PARENT", "conreportes@example.com");
        const plataforma = await crearPlataforma();
        await prisma.reporte.create({
            data: {
                identificador: "+573009990001",
                plataformaId: plataforma.id,
                texto: "Texto original del reporte de prueba",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                usuarioId: padre.id,
            },
        });

        await prisma.usuario.update({
            where: { id: padre.id },
            data: { finServicio: diasDesdeHoy(-1) },
        });
        expect((await login("conreportes@example.com", "TestPass123")).status).toBe(403);

        const reportes = await prisma.reporte.findMany({ where: { usuarioId: padre.id } });
        expect(reportes).toHaveLength(1);
        expect(reportes[0].texto).toBe("Texto original del reporte de prueba");
        expect(reportes[0].eliminado).toBe(false);
    });

    it("la consulta pública sin sesión sigue 200 aunque el reportante esté vencido", async () => {
        const padre = await crearUsuario("PARENT", "reportante@example.com");
        const plataforma = await crearPlataforma();
        await prisma.reporte.create({
            data: {
                identificador: "+573009990002",
                plataformaId: plataforma.id,
                texto: "Reporte cuyo autor vencerá",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                usuarioId: padre.id,
            },
        });
        await prisma.usuario.update({
            where: { id: padre.id },
            data: { finServicio: diasDesdeHoy(-1) },
        });

        const res = await GETConsulta(
            new Request("http://localhost:5005/api/consulta?identificador=%2B573009990002")
        );
        expect(res.status).toBe(200);
    });
});
