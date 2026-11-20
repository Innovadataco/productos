/**
 * SPEC-958 (M5a) · GET /api/colegio/dominio-institucional
 * El dominio institucional se DERIVA server-side del correo del rector
 * (`Colegio.representanteLegalEmail`), solo si no es genérico. Control positivo en
 * las dos direcciones + la puerta de rol.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearUsuario } from "@/lib/reporte-test-utils";
import { crearTokenUsuario } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            (name === "token" || name === "__Host-token") && mockToken ? { name, value: mockToken } : undefined,
    }),
}));

describe("SPEC-958 · GET /api/colegio/dominio-institucional", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("rector con dominio PROPIO → devuelve el dominio del colegio", async () => {
        const { colegio, admin } = await crearColegioConAdmin();
        await prisma.colegio.update({
            where: { id: colegio.id },
            data: { representanteLegalEmail: "rectoria@colegiosanjose.edu.co" },
        });
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        const res = await GET();
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ dominioInstitucional: "colegiosanjose.edu.co" });
    });

    it("rector con dominio GENÉRICO → null (no se inventa institucional)", async () => {
        const { colegio, admin } = await crearColegioConAdmin();
        await prisma.colegio.update({
            where: { id: colegio.id },
            data: { representanteLegalEmail: "rector@gmail.com" },
        });
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        const res = await GET();
        expect(await res.json()).toEqual({ dominioInstitucional: null });
    });

    it("rol NO SCHOOL_ADMIN → 403 (el campo vive dentro del camino del colegio)", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await GET();
        expect(res.status).toBe(403);
    });
});
