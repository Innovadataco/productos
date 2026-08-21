import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { bloquearIp, desbloquearIp } from "@/lib/anti-abuso/block-list";

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && activeToken ? { name: "token", value: activeToken } : undefined,
        set: vi.fn(),
    }),
}));

const BASE = "http://localhost:5005/api/admin/anti-abuso/desbloquear";

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    activeToken = await crearTokenUsuario(admin.id, "ADMIN");
    return admin;
}

async function postDesbloquear(body: unknown) {
    const req = new Request(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `token=${activeToken}` },
        body: JSON.stringify(body),
    });
    const res = await POST(req);
    return { status: res.status, body: await res.json() };
}

describe("POST /api/admin/anti-abuso/desbloquear (SPEC-196)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        activeToken = null;
    });

    it("401 sin token", async () => {
        const req = new Request(BASE, { method: "POST", headers: { "Content-Type": "application/json" } });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("desbloquea con motivo y registra IP_DESBLOQUEADA_MANUAL", async () => {
        const admin = await autenticarAdmin();
        const bloqueo = await bloquearIp({
            ipHash: "a".repeat(64),
            motivo: "Test",
            duracion: "24h",
            creadoPorId: admin.id,
        });

        const { status, body } = await postDesbloquear({ id: bloqueo.id, motivo: "Falso positivo confirmado por el comité" });

        expect(status).toBe(200);
        expect(body.ok).toBe(true);

        const vigente = await prisma.blockList.findUnique({ where: { id: bloqueo.id } });
        expect(vigente).toBeNull();

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "IP_DESBLOQUEADA_MANUAL", recursoId: bloqueo.id },
        });
        expect(audit).not.toBeNull();
        const meta = JSON.parse(audit!.valorAnterior ?? "{}");
        expect(meta.motivo_desbloqueo).toBe("Falso positivo confirmado por el comité");
        expect(meta.duracion_original).toBeDefined();
    });

    it("rechaza motivo menor a 20 caracteres", async () => {
        const admin = await autenticarAdmin();
        const bloqueo = await bloquearIp({
            ipHash: "b".repeat(64),
            motivo: "Test",
            duracion: "24h",
            creadoPorId: admin.id,
        });

        const { status, body } = await postDesbloquear({ id: bloqueo.id, motivo: "corto" });
        expect(status).toBe(400);
        expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza rol no ADMIN", async () => {
        const admin = await crearUsuario("ADMIN");
        const bloqueo = await bloquearIp({
            ipHash: "c".repeat(64),
            motivo: "Test",
            duracion: "24h",
            creadoPorId: admin.id,
        });
        const parent = await crearUsuario("PARENT");
        activeToken = await crearTokenUsuario(parent.id, "PARENT");

        const { status } = await postDesbloquear({ id: bloqueo.id, motivo: "Falso positivo confirmado por el comité" });
        expect(status).toBe(403);
    });

    it("devuelve 404 si el bloqueo no existe", async () => {
        await autenticarAdmin();
        const { status } = await postDesbloquear({ id: "cuidinexistente1234567890123", motivo: "Motivo de prueba suficientemente largo" });
        expect(status).toBe(404);
    });
});
