import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { syncModulosYGrants } from "../../../../../../../prisma/seed-modulos-grants";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { DEFINICIONES_CATEGORIA } from "@/lib/ai/rubrica-semilla";
import * as auth from "@/lib/auth";

describe("GET /api/admin/ia/rubrica/definiciones (SPEC-248 / 002-PI-151)", () => {
    beforeEach(async () => {
        await resetDatabase();
        // SPEC-452: partir del mapa REAL de grants (no el arnés permisivo I-309):
        // el acceso de OPERADOR/COMITE a estos endpoints depende del seed, no del arnés.
        await prisma.permisoModulo.deleteMany();
        await syncModulosYGrants(prisma);

        vi.restoreAllMocks();
    });

    it("ADMIN recibe las 14 definiciones (fallback a la semilla)", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.definiciones).toEqual(DEFINICIONES_CATEGORIA);
    });

    it("COMITE_VALIDACION también puede leer (solo lectura)", async () => {
        const comite = await crearUsuario("COMITE_VALIDACION");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(comite);

        const res = await GET();
        expect(res.status).toBe(200);
    });

    it("403 cuando el rol no tiene el módulo ia_rubrica", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        const modulo = await prisma.moduloPermisible.findUnique({ where: { clave: "ia_rubrica" } });
        await prisma.permisoModulo.update({
            where: { rol_moduloId: { rol: "ADMIN", moduloId: modulo!.id } },
            data: { activo: false },
        });

        const res = await GET();
        expect(res.status).toBe(403);
    });
});
