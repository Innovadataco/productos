import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { generarTokenRecuperacion, hashToken } from "@/lib/token-recuperacion";

function makeRequest(body: unknown): Request {
    return new Request("http://localhost:5005/api/auth/recuperar/restablecer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("POST /api/auth/recuperar/restablecer", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("restablece la contraseña con token válido", async () => {
        const user = await crearUsuario("PARENT", "restablecer@example.com", "ViejaPass123");
        const token = generarTokenRecuperacion();
        const tokenHash = await hashToken(token);

        await prisma.tokenRecuperacion.create({
            data: {
                email: user.email,
                tokenHash,
                expiraEn: new Date(Date.now() + 60 * 60 * 1000),
                usuarioId: user.id,
            },
        });

        const res = await POST(makeRequest({ token, password: "NuevaPass456" }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.message).toBe("Contraseña actualizada correctamente.");

        const actualizado = await prisma.usuario.findUnique({ where: { id: user.id } });
        expect(actualizado?.intentosFallidos).toBe(0);
        expect(actualizado?.estado).toBe("activo");
    });

    it("rechaza token vacío con VALIDATION_ERROR", async () => {
        const res = await POST(makeRequest({ token: "", password: "NuevaPass456" }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza contraseña débil con VALIDATION_ERROR", async () => {
        const res = await POST(makeRequest({ token: "token-valido", password: "corta" }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza contraseña sin número con VALIDATION_ERROR", async () => {
        const res = await POST(makeRequest({ token: "token-valido", password: "SoloLetras" }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza campos adicionales con VALIDATION_ERROR", async () => {
        const res = await POST(makeRequest({ token: "token-valido", password: "NuevaPass456", extra: "campo" }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza token inválido después de validación", async () => {
        const res = await POST(makeRequest({ token: "token-inventado", password: "NuevaPass456" }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.code).toBe("AUTH_INVALID");
    });
});
