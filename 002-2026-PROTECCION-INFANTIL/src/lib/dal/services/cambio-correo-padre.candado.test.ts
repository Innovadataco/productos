/**
 * SPEC-547 · CANDADO de conducta del cambio de correo con verificación.
 *
 * Muere si se rompe cualquiera de las garantías de seguridad:
 *  (happy) el correo cambia SOLO tras validar el código del buzón nuevo.
 *  (A) un código incorrecto NO cambia el correo.
 *  (B) unicidad: no se puede cambiar a un correo que ya tiene otro usuario (ni se
 *      manda código a ese buzón).
 *  (C) el código está atado a quien lo pidió: otro usuario no puede confirmarlo.
 *  (auditoría) el cambio queda registrado (correo anterior → nuevo).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { solicitarCambioCorreoPadre, confirmarCambioCorreoPadre } from "./cambio-correo-padre";
import { enviarCodigoVerificacion } from "@/lib/email";

vi.mock("@/lib/email", () => ({
    enviarCodigoVerificacion: vi.fn().mockResolvedValue(undefined),
}));

function codigoEnviado(): string {
    const calls = vi.mocked(enviarCodigoVerificacion).mock.calls;
    return calls.at(-1)![1];
}
const emailDe = async (id: string) => (await prisma.usuario.findUnique({ where: { id } }))?.email;

describe("SPEC-547 · cambio de correo del padre con verificación", () => {
    beforeEach(async () => {
        await resetDatabase();
        vi.mocked(enviarCodigoVerificacion).mockClear();
    });

    it("(happy) cambia el correo SOLO tras validar el código del buzón nuevo", async () => {
        const padre = await crearUsuario("PARENT", `padre-547h-${Date.now()}@old.local`);
        const nuevo = `nuevo-547h-${Date.now()}@correo.local`;

        const sol = await solicitarCambioCorreoPadre(padre.id, nuevo);
        expect(sol.ok).toBe(true);
        expect(await emailDe(padre.id)).toBe(padre.email); // aún NO cambió

        const conf = await confirmarCambioCorreoPadre(padre.id, nuevo, codigoEnviado());
        expect(conf.ok).toBe(true);
        expect(await emailDe(padre.id)).toBe(nuevo); // ahora sí
    });

    it("(A) un código incorrecto NO cambia el correo", async () => {
        const padre = await crearUsuario("PARENT", `padre-547a-${Date.now()}@old.local`);
        const nuevo = `nuevo-547a-${Date.now()}@correo.local`;
        await solicitarCambioCorreoPadre(padre.id, nuevo);
        const conf = await confirmarCambioCorreoPadre(padre.id, nuevo, "000000");
        expect(conf.ok).toBe(false);
        expect(await emailDe(padre.id)).toBe(padre.email);
    });

    it("(B) unicidad: no se cambia a un correo que ya tiene otro usuario, ni se manda código", async () => {
        const padre = await crearUsuario("PARENT", `padre-547b-${Date.now()}@old.local`);
        const otro = await crearUsuario("PARENT", `ocupado-547b-${Date.now()}@correo.local`);
        const sol = await solicitarCambioCorreoPadre(padre.id, otro.email);
        expect(sol.ok).toBe(false);
        expect(enviarCodigoVerificacion).not.toHaveBeenCalled();
    });

    it("(C) el código está atado a quien lo pidió: otro usuario no lo confirma", async () => {
        const padre = await crearUsuario("PARENT", `padre-547c-${Date.now()}@old.local`);
        const intruso = await crearUsuario("PARENT", `intruso-547c-${Date.now()}@correo.local`);
        const nuevo = `nuevo-547c-${Date.now()}@correo.local`;
        await solicitarCambioCorreoPadre(padre.id, nuevo);
        const conf = await confirmarCambioCorreoPadre(intruso.id, nuevo, codigoEnviado());
        expect(conf.ok).toBe(false);
        expect(await emailDe(intruso.id)).toBe(intruso.email);
    });

    it("(auditoría) el cambio queda registrado con el correo anterior y el nuevo", async () => {
        const padre = await crearUsuario("PARENT", `padre-547d-${Date.now()}@old.local`);
        const nuevo = `nuevo-547d-${Date.now()}@correo.local`;
        await solicitarCambioCorreoPadre(padre.id, nuevo);
        await confirmarCambioCorreoPadre(padre.id, nuevo, codigoEnviado());
        const audit = await prisma.auditLog.findFirst({
            where: { tipoRecurso: "Usuario", recursoId: padre.id, accion: "USER_UPDATE" },
            orderBy: { creadoEn: "desc" },
        });
        expect(audit).not.toBeNull();
        expect(JSON.parse(audit?.valorNuevo ?? "{}").email).toBe(nuevo);
        expect(JSON.parse(audit?.valorAnterior ?? "{}").email).toBe(padre.email);
    });
});
