/**
 * CANDADO · SPEC-894 — login() NO filtra la existencia de cuentas (anti-enumeración).
 *
 * En una plataforma de protección infantil, confirmar qué correos son cuentas registradas es grave. El
 * defecto tenía DOS oráculos: (1) TIMING — `!user` retornaba ANTES de bcrypt (~ms vs ~100-300ms); (2) MENSAJE
 * — una cuenta bloqueada devolvía `tipo:"bloqueada"` ANTES de validar la clave.
 *
 * Candado CONDUCTUAL (no timing, que es flaky): envuelve `verifyPassword` para probar que se invoca TAMBIÉN
 * con email inexistente (control positivo: sin el hash señuelo no se llamaría → rojo), y afirma que el `tipo`
 * de inexistente == clave-mala, y que "bloqueada" SOLO sale con la contraseña correcta.
 *
 * Integración (BD de test, bcrypt real). NO toca prod.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { AutenticacionService } from "./autenticacion";

// Espía SIN cambiar conducta: envuelve el verifyPassword REAL (bcrypt sigue corriendo, timing preservado).
const { verifySpy } = vi.hoisted(() => ({ verifySpy: vi.fn() }));
vi.mock("@/lib/auth", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/auth")>();
    return {
        ...actual,
        verifyPassword: (password: string, hash: string) => {
            verifySpy(password, hash);
            return actual.verifyPassword(password, hash);
        },
    };
});

const PASSWORD = "TestPass123"; // la que usa crearUsuario por defecto

async function bloquear(id: string) {
    await prisma.usuario.update({
        where: { id },
        data: { estado: "bloqueado", bloqueadoHasta: new Date(Date.now() + 60 * 60 * 1000) },
    });
}

describe("SPEC-894 · login anti-enumeración", () => {
    beforeEach(async () => {
        await resetDatabase();
        verifySpy.mockClear();
    });

    it("corre bcrypt (verifyPassword) TAMBIÉN con email inexistente (mata el oráculo de timing)", async () => {
        const res = await new AutenticacionService().login("no-existe-894@example.com", "cualquiera");
        expect(res).toEqual({ ok: false, tipo: "credenciales" });
        // Control positivo: sin el hash señuelo, login(!user) retornaba ANTES de verifyPassword → 0 llamadas.
        expect(verifySpy).toHaveBeenCalledTimes(1);
    });

    it("mismo tipo 'credenciales' para email inexistente y clave-mala en cuenta existente", async () => {
        const user = await crearUsuario("PARENT");
        const inexistente = await new AutenticacionService().login("no-existe-894@example.com", "x");
        const claveMala = await new AutenticacionService().login(user.email, "ClaveIncorrecta999");
        expect(inexistente).toEqual({ ok: false, tipo: "credenciales" });
        expect(claveMala).toEqual({ ok: false, tipo: "credenciales" });
    });

    it("cuenta bloqueada + clave INCORRECTA → 'credenciales' (NO 'bloqueada'): no filtra existencia", async () => {
        const user = await crearUsuario("PARENT");
        await bloquear(user.id);
        const res = await new AutenticacionService().login(user.email, "ClaveIncorrecta999");
        // Control positivo: antes del fix esto devolvía {tipo:"bloqueada"} PRE-auth (oráculo de existencia).
        expect(res).toEqual({ ok: false, tipo: "credenciales" });
    });

    it("cuenta bloqueada + clave CORRECTA → 'bloqueada' (solo lo ve quien sabe la clave)", async () => {
        const user = await crearUsuario("PARENT");
        await bloquear(user.id);
        const res = await new AutenticacionService().login(user.email, PASSWORD);
        expect(res).toEqual({ ok: false, tipo: "bloqueada" });
    });

    it("login legítimo (cuenta activa + clave correcta) sigue funcionando (sin regresión)", async () => {
        const user = await crearUsuario("PARENT");
        const res = await new AutenticacionService().login(user.email, PASSWORD);
        expect(res.ok).toBe(true);
    });
});
