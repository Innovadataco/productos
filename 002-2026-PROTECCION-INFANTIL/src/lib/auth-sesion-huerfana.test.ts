/**
 * SPEC-603 (hotfix) · sesión huérfana: JWT con firma válida cuyo `sub` ya no
 * existe en BD (usuario purgado). Regla de industria: en el servidor esa sesión
 * se trata como NO autenticada.
 *
 * Candados por conducta contra BD real:
 *   · getSessionUser con usuario eliminado → null (como si no hubiera token);
 *     NUNCA devuelve el `sub` huérfano para que nadie lo propague a una FK.
 *   · verifyAuth con usuario eliminado → 401 (comportamiento ya existente en
 *     /api/**; acá queda fijado para que nadie lo "relaje").
 *   · getSessionUser con usuario activo → lo devuelve (no rompe el flujo sano).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { createToken, getSessionUser, verifyAuth } from "@/lib/auth";
import { AppError } from "@/lib/errors";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            (name === "token" || name === "__Host-token") && mockToken
                ? { name, value: mockToken }
                : undefined,
        set: vi.fn(),
    }),
}));

describe("getSessionUser / verifyAuth · sesión huérfana (SPEC-603)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("usuario activo: getSessionUser devuelve el usuario", async () => {
        const padre = await crearUsuario("PARENT", "sesion-sana@example.com");
        mockToken = await createToken({ sub: padre.id, rol: padre.rol });

        const user = await getSessionUser();
        expect(user?.id).toBe(padre.id);
    });

    it("usuario eliminado (purga): getSessionUser devuelve null, no el sub huérfano", async () => {
        const padre = await crearUsuario("PARENT", "sesion-huerfana@example.com");
        mockToken = await createToken({ sub: padre.id, rol: padre.rol });
        await prisma.usuario.delete({ where: { id: padre.id } });

        expect(await getSessionUser()).toBeNull();
    });

    it("usuario inactivo: getSessionUser devuelve null", async () => {
        const padre = await crearUsuario("PARENT", "sesion-inactiva@example.com");
        await prisma.usuario.update({ where: { id: padre.id }, data: { estado: "inactivo" } });
        mockToken = await createToken({ sub: padre.id, rol: padre.rol });

        expect(await getSessionUser()).toBeNull();
    });

    it("sin cookie o con token inválido: getSessionUser devuelve null", async () => {
        expect(await getSessionUser()).toBeNull();
        mockToken = "token-basura";
        expect(await getSessionUser()).toBeNull();
    });

    it("usuario eliminado: verifyAuth lanza 401 (contrato /api/**)", async () => {
        const padre = await crearUsuario("PARENT", "sesion-huerfana-api@example.com");
        mockToken = await createToken({ sub: padre.id, rol: padre.rol });
        await prisma.usuario.delete({ where: { id: padre.id } });

        const error = await verifyAuth().catch((e: unknown) => e);
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(401);
    });
});
