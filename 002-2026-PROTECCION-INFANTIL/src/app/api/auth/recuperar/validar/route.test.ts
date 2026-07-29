import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { generarTokenRecuperacion, hashToken } from "@/lib/token-recuperacion";

function makeRequest(query: string): Request {
    return new Request(`http://localhost:5005/api/auth/recuperar/validar${query}`);
}

describe("GET /api/auth/recuperar/validar", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("rechaza 400 sin token (mensaje de contrato)", async () => {
        const res = await GET(makeRequest(""));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.message).toBe("Token requerido");
        expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza 400 un token desconocido", async () => {
        const res = await GET(makeRequest("?token=token-que-no-existe"));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.message).toBe("Token inválido o expirado");
    });

    it("valida un token vigente y devuelve el email (contrato 200)", async () => {
        const usuario = await crearUsuario("PARENT", "recuperar-ok@example.com");
        const token = generarTokenRecuperacion();
        await prisma.tokenRecuperacion.create({
            data: {
                email: usuario.email,
                tokenHash: await hashToken(token),
                expiraEn: new Date(Date.now() + 60 * 60 * 1000),
                usuarioId: usuario.id,
            },
        });

        const res = await GET(makeRequest(`?token=${encodeURIComponent(token)}`));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.valido).toBe(true);
        expect(data.email).toBe("recuperar-ok@example.com");
    });
});
