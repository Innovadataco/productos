import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearColegioConAdmin, crearUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";

function ctx(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("POST /api/admin/colegios/[id]/regenerar-password", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        vi.restoreAllMocks();
    });

    it("ADMIN regenera la contraseña: temporal una sola vez, debeCambiarPassword y auditoría con colegioId", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        const { colegio, admin: schoolAdmin } = await crearColegioConAdmin();
        const hashAntes = schoolAdmin.passwordHash;

        const req = crearRequestAutenticado("POST", `http://localhost/api/admin/colegios/${colegio.id}/regenerar-password`, null);
        const res = await POST(req, ctx(colegio.id));
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.passwordTemporal).toMatch(/^[0-9a-f]{12}$/);
        expect(body.admin.email).toBe(schoolAdmin.email);

        const actualizado = await prisma.usuario.findUnique({ where: { id: schoolAdmin.id } });
        expect(actualizado?.debeCambiarPassword).toBe(true);
        expect(actualizado?.passwordHash).not.toBe(hashAntes);
        // La contraseña temporal NO se persiste en claro
        expect(actualizado?.passwordHash).not.toBe(body.passwordTemporal);

        const audit = await prisma.auditLog.findFirst({ where: { accion: "COLEGIO_PASSWORD_REGENERADA" } });
        expect(audit).not.toBeNull();
        expect(audit?.colegioId).toBe(colegio.id);
        // La auditoría nunca contiene la contraseña
        expect(JSON.stringify(audit)).not.toContain(body.passwordTemporal);
    });

    it("rechaza roles distintos de ADMIN", async () => {
        const operador = await crearUsuario("OPERADOR");
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(
            new (await import("@/lib/errors")).AppError("Permisos insuficientes", "FORBIDDEN" as never, 403)
        );
        const { colegio } = await crearColegioConAdmin();

        const req = crearRequestAutenticado("POST", `http://localhost/api/admin/colegios/${colegio.id}/regenerar-password`, null);
        const res = await POST(req, ctx(colegio.id));
        expect(res.status).toBe(403);
        expect(operador).toBeDefined();
    });

    it("404 si el colegio no existe", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const req = crearRequestAutenticado("POST", "http://localhost/api/admin/colegios/czzzzzzzzzzzzzzzzzzzzzzzz/regenerar-password", null);
        const res = await POST(req, ctx("czzzzzzzzzzzzzzzzzzzzzzzz"));
        expect(res.status).toBe(404);
    });
});
