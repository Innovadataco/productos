import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearColegioConAdmin, crearUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import { enviarEmailBienvenidaColegio } from "@/lib/email";

vi.mock("@/lib/email", () => ({
    enviarEmailBienvenidaColegio: vi.fn(),
}));

const mockEmail = enviarEmailBienvenidaColegio as unknown as ReturnType<typeof vi.fn>;

function ctx(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("POST /api/admin/colegios/[id]/reenviar-email", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        vi.clearAllMocks();
    });

    it("envía el email con nueva contraseña temporal y NO la expone en la respuesta", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        mockEmail.mockResolvedValue(undefined);
        const { colegio, admin: schoolAdmin } = await crearColegioConAdmin();

        const req = crearRequestAutenticado("POST", `http://localhost/api/admin/colegios/${colegio.id}/reenviar-email`, null);
        const res = await POST(req, ctx(colegio.id));
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.emailEnviado).toBe(true);
        expect(body.passwordTemporal).toBeUndefined();
        expect(mockEmail).toHaveBeenCalledWith(schoolAdmin.email, expect.stringMatching(/^[0-9a-f]{12}$/));

        const actualizado = await prisma.usuario.findUnique({ where: { id: schoolAdmin.id } });
        expect(actualizado?.debeCambiarPassword).toBe(true);

        const audit = await prisma.auditLog.findFirst({ where: { accion: "COLEGIO_EMAIL_REENVIADO" } });
        expect(audit?.colegioId).toBe(colegio.id);
    });

    it("si el email falla, devuelve la contraseña temporal para copia manual", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        mockEmail.mockRejectedValue(new Error("Resend caído"));
        const { colegio } = await crearColegioConAdmin();

        const req = crearRequestAutenticado("POST", `http://localhost/api/admin/colegios/${colegio.id}/reenviar-email`, null);
        const res = await POST(req, ctx(colegio.id));
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.emailEnviado).toBe(false);
        expect(body.passwordTemporal).toMatch(/^[0-9a-f]{12}$/);
    });

    it("404 si el colegio no existe", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const req = crearRequestAutenticado("POST", "http://localhost/api/admin/colegios/czzzzzzzzzzzzzzzzzzzzzzzz/reenviar-email", null);
        const res = await POST(req, ctx("czzzzzzzzzzzzzzzzzzzzzzzz"));
        expect(res.status).toBe(404);
    });
});
