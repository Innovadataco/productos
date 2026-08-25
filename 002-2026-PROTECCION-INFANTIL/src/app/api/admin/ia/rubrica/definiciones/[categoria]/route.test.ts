import { describe, it, expect, beforeEach, vi } from "vitest";
import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import { DEFINICIONES_CATEGORIA } from "@/lib/ai/rubrica-semilla";
import * as auth from "@/lib/auth";

const URL = "http://localhost/api/admin/ia/rubrica/definiciones";

const DEFINICION_EDITADA = {
    conductaLegal: "Ciberacoso",
    definicionLiteral: "Texto editado en el modal por el ADMIN.",
    referenciaNormativa: "Ley 2564 de 2026 · art. 6.e",
};

function patchCategoria(categoria: string, body: unknown) {
    return PATCH(crearRequestAutenticado("PATCH", `${URL}/${categoria}`, body), {
        params: Promise.resolve({ categoria }),
    });
}

describe("PATCH /api/admin/ia/rubrica/definiciones/[categoria] (SPEC-248 / 002-PI-151)", () => {
    beforeEach(async () => {
        await resetDatabase();
        vi.restoreAllMocks();
    });

    it("ADMIN actualiza una definición y deja las otras 13 intactas + AuditLog", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const res = await patchCategoria("CIBERACOSO", DEFINICION_EDITADA);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.definicionLiteral).toBe(DEFINICION_EDITADA.definicionLiteral);

        const param = await prisma.parametroSistema.findUnique({ where: { clave: "ia.rubrica.definiciones" } });
        const definiciones = JSON.parse(param!.valor);
        expect(definiciones.CIBERACOSO.definicionLiteral).toBe(DEFINICION_EDITADA.definicionLiteral);
        expect(definiciones.STALKING).toEqual(DEFINICIONES_CATEGORIA.STALKING);

        const audit = await prisma.auditLog.findFirst({ where: { accion: "RUBRICA_DEFINICION_UPDATE" } });
        expect(audit).not.toBeNull();
        expect(audit?.metadatos).toMatchObject({ clave: "ia.rubrica.definiciones", categoria: "CIBERACOSO" });
        expect(audit?.usuarioId).toBe(admin.id);
    });

    it("segunda edición parte del parámetro ya existente (lee-modifica-escribe)", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        await patchCategoria("CIBERACOSO", DEFINICION_EDITADA);
        const res = await patchCategoria("STALKING", { ...DEFINICION_EDITADA, conductaLegal: "Stalking" });
        expect(res.status).toBe(200);

        const param = await prisma.parametroSistema.findUnique({ where: { clave: "ia.rubrica.definiciones" } });
        const definiciones = JSON.parse(param!.valor);
        expect(definiciones.CIBERACOSO.definicionLiteral).toBe(DEFINICION_EDITADA.definicionLiteral);
        expect(definiciones.STALKING.conductaLegal).toBe("Stalking");
    });

    it("403 cuando el rol no tiene el módulo ia_rubrica", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        const modulo = await prisma.moduloPermisible.findUnique({ where: { clave: "ia_rubrica" } });
        await prisma.permisoModulo.update({
            where: { rol_moduloId: { rol: "ADMIN", moduloId: modulo!.id } },
            data: { activo: false },
        });

        const res = await patchCategoria("CIBERACOSO", DEFINICION_EDITADA);
        expect(res.status).toBe(403);
    });

    it("404 cuando la categoría no existe en las definiciones", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const res = await PATCH(crearRequestAutenticado("PATCH", `${URL}/OTRO`, DEFINICION_EDITADA), {
            params: Promise.resolve({ categoria: "OTRO" }),
        });
        expect(res.status).toBe(404);
    });

    it("400 cuando falta un campo obligatorio", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const res = await patchCategoria("CIBERACOSO", { conductaLegal: "Ciberacoso" });
        expect(res.status).toBe(400);
    });
});
